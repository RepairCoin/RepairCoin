// docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/replay-fixtures.ts
//
// Phase 6 router-accuracy + cost harness. For each clip in fixtures.ts that
// actually exists under ./pre-recorded-audio/, this:
//   1. POSTs the audio to /api/ai/voice/transcribe (Whisper STT).
//   2. POSTs the transcript to /api/ai/dispatch (Haiku 4-way router).
//   3. Asserts the returned domain == fixture.expectedDomain.
//   4. (optional) reads the two audit rows by session_id to report the real
//      STT cost / router cost / latency for the v1-cost-report.md.
//
// It prints a per-clip table, an accuracy summary, and exits non-zero if
// accuracy drops below ROUTER_ACCURACY_TARGET — so it can run in CI / a
// weekly cron as a regression guard (risk row in implementation.md §9:
// "router accuracy degrades over time as language drifts").
//
// ── How to run ────────────────────────────────────────────────────────────
//   cd backend
//   # the backend dev server must be running (default :4000) OR point
//   # VOICE_QA_API_BASE at staging.
//   VOICE_QA_SHOP_ID=peanut \
//   npx ts-node ../docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/replay-fixtures.ts
//
// CWD must be backend/ so Node resolves pg / dotenv / jsonwebtoken from
// backend/node_modules (same convention as the business-data-insights
// fixtures). The folder tsconfig.json extends backend/tsconfig.json.
//
// ── Auth ──────────────────────────────────────────────────────────────────
// The endpoints are JWT shop-scoped. This script mints a short-lived shop
// access token signed with the same JWT_SECRET the backend uses (read from
// backend/.env), with the exact issuer/audience the auth middleware checks.
// The token's shopId must reference a shop that EXISTS and is active —
// auth.ts validateUserInDatabase() rejects tokens for unknown shops. Set
// VOICE_QA_SHOP_ID to your seeded test shop (default 'peanut').
//
// Alternatively, paste a real access token into VOICE_QA_JWT to skip minting.
//
// ── Requires real audio ────────────────────────────────────────────────────
// The ./pre-recorded-audio/ clips are NOT committed (binary). See that
// folder's README.md to record the 10 clips. Clips that are missing are
// SKIPPED (and reported) — the harness still runs against whatever is present
// so you can iterate one clip at a time.

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import * as dotenv from "dotenv";
import type { Pool } from "pg";

// This script lives under docs/, so a bare `require('jsonwebtoken')` resolves
// from the docs tree and can't see backend/node_modules. Resolve it (and any
// other backend dep) against the backend package instead.
const backendRequire = createRequire(
  path.resolve(__dirname, "../../../../../backend/package.json")
);
const jwt = backendRequire("jsonwebtoken");
import {
  getSharedPool,
  closeSharedPool,
} from "../../../../../backend/src/utils/database-pool";
import { VOICE_FIXTURES, VoiceFixture, VoiceDomain } from "./fixtures";

dotenv.config(); // CWD=backend → loads backend/.env

// Local backend port comes from backend/.env PORT (loaded via -r dotenv/config);
// it's 3002 in this repo, not the 4000 in CLAUDE.md. Honor it so local runs work
// without passing VOICE_QA_API_BASE. Override with VOICE_QA_API_BASE for staging.
const API_BASE =
  process.env.VOICE_QA_API_BASE ?? `http://localhost:${process.env.PORT || 4000}`;
const SHOP_ID = process.env.VOICE_QA_SHOP_ID ?? "peanut";
const AUDIO_DIR = path.resolve(__dirname, "pre-recorded-audio");
const ROUTER_ACCURACY_TARGET = 0.95; // implementation.md §4 Phase 6 acceptance
const READ_AUDIT = process.env.VOICE_QA_SKIP_AUDIT !== "1"; // set to 1 to skip DB reads

interface ClipResult {
  file: string;
  status: "pass" | "fail" | "skipped" | "error";
  expected: VoiceDomain;
  got?: VoiceDomain;
  transcript?: string;
  transcriptOk?: boolean;
  sessionId?: string;
  sttCostUsd?: number;
  sttLatencyMs?: number;
  routerCostUsd?: number;
  routerLatencyMs?: number;
  note?: string;
}

async function mintToken(pool: Pool | null): Promise<string> {
  const fromEnv = process.env.VOICE_QA_JWT;
  if (fromEnv) return fromEnv;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET not set (backend/.env). Either run with CWD=backend so .env loads, or set VOICE_QA_JWT to a real shop access token."
    );
  }

  // address isn't used by the voice endpoints (they key off shopId), but the
  // auth middleware shape expects it. Pull the shop's wallet if we can.
  let address = "0x0000000000000000000000000000000000000000";
  if (pool) {
    try {
      const r = await pool.query(
        "SELECT wallet_address FROM shops WHERE shop_id = $1 LIMIT 1",
        [SHOP_ID]
      );
      if (r.rows[0]?.wallet_address) address = r.rows[0].wallet_address;
    } catch {
      /* non-fatal — address is cosmetic for these endpoints */
    }
  }

  return jwt.sign(
    { address, role: "shop", shopId: SHOP_ID, type: "access" },
    secret,
    { expiresIn: "1h", issuer: "repaircoin-api", audience: "repaircoin-users" }
  );
}

/** Content-type for a clip from its extension. OpenAI Whisper detects the
 *  format from the uploaded filename, so the extension + mime must match the
 *  real bytes. The transcribe endpoint accepts webm/ogg/mp4/wav/mp3. */
function mimeFor(file: string): string {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "audio/webm";
    case ".ogg":
      return "audio/ogg";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
    case ".m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

/** Duration of a PCM WAV by walking its RIFF chunks (byteRate from `fmt `,
 *  byte count from `data`). Fixed offsets don't work — SAPI and others insert
 *  extra chunks (e.g. `fact`) that shift `data`. Returns null for non-WAV or
 *  an implausible result so the caller falls back to an estimate. The backend
 *  bills Whisper off the durationMs we send, so this keeps the cost honest. */
function wavDurationMs(buffer: Buffer): number | null {
  if (
    buffer.length < 12 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return null;
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt " && body + 12 <= buffer.length) {
      byteRate = buffer.readUInt32LE(body + 8); // avg bytes/sec
    } else if (id === "data") {
      dataSize = size;
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (!byteRate || !dataSize) return null;
  const ms = Math.round((dataSize / byteRate) * 1000);
  return ms > 0 && ms <= 600_000 ? ms : null;
}

async function transcribe(
  token: string,
  buffer: Buffer,
  sessionId: string,
  durationMs: number,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append(
    "audio",
    // Wrap in a fresh Uint8Array so the type is a clean BlobPart (Buffer's
    // backing ArrayBufferLike doesn't satisfy the DOM Blob typing).
    new Blob([new Uint8Array(buffer)], { type: mimeFor(filename) }),
    filename
  );
  form.append("durationMs", String(durationMs));
  form.append("sessionId", sessionId);
  form.append("language", "en");

  const res = await fetch(`${API_BASE}/api/ai/voice/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json();
  if (!res.ok || !body?.success) {
    throw new Error(
      `transcribe ${res.status}: ${body?.error ?? "unknown error"}`
    );
  }
  return (body.data?.transcript ?? "").trim();
}

async function dispatch(
  token: string,
  transcript: string,
  sessionId: string
): Promise<VoiceDomain> {
  const res = await fetch(`${API_BASE}/api/ai/dispatch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript, sessionId, source: "voice" }),
  });
  const body = await res.json();
  if (!res.ok || !body?.success) {
    throw new Error(`dispatch ${res.status}: ${body?.error ?? "unknown error"}`);
  }
  return body.data.domain as VoiceDomain;
}

/** Read the STT + router audit rows for one session for the cost report. */
async function readAudit(
  pool: Pool,
  sessionId: string
): Promise<Partial<ClipResult>> {
  const stt = await pool.query(
    `SELECT cost_usd, latency_ms FROM ai_voice_transcriptions
       WHERE shop_id = $1 AND session_id = $2
       ORDER BY created_at DESC LIMIT 1`,
    [SHOP_ID, sessionId]
  );
  const router = await pool.query(
    `SELECT router_cost_usd, latency_ms FROM ai_dispatch_audit
       WHERE shop_id = $1 AND session_id = $2
       ORDER BY created_at DESC LIMIT 1`,
    [SHOP_ID, sessionId]
  );
  return {
    sttCostUsd: stt.rows[0] ? Number(stt.rows[0].cost_usd) : undefined,
    sttLatencyMs: stt.rows[0] ? Number(stt.rows[0].latency_ms) : undefined,
    routerCostUsd: router.rows[0]
      ? Number(router.rows[0].router_cost_usd)
      : undefined,
    routerLatencyMs: router.rows[0]
      ? Number(router.rows[0].latency_ms)
      : undefined,
  };
}

async function runClip(
  token: string,
  pool: Pool | null,
  fx: VoiceFixture
): Promise<ClipResult> {
  const filePath = path.join(AUDIO_DIR, fx.file);
  if (!fs.existsSync(filePath)) {
    return {
      file: fx.file,
      status: "skipped",
      expected: fx.expectedDomain,
      note: "clip not found — record it (see pre-recorded-audio/README.md)",
    };
  }

  const sessionId = randomUUID();
  try {
    const buffer = fs.readFileSync(filePath);
    // Prefer the real WAV duration (drives the audited Whisper cost). Fall
    // back to a ~10s estimate for non-WAV / non-canonical clips.
    const durationMs = wavDurationMs(buffer) ?? 10_000;

    const transcript = await transcribe(
      token,
      buffer,
      sessionId,
      durationMs,
      fx.file
    );
    const got = await dispatch(token, transcript, sessionId);

    const transcriptOk = fx.expectTranscriptIncludes
      ? transcript
          .toLowerCase()
          .includes(fx.expectTranscriptIncludes.toLowerCase())
      : undefined;

    const audit = pool && READ_AUDIT ? await readAudit(pool, sessionId) : {};

    return {
      file: fx.file,
      status: got === fx.expectedDomain ? "pass" : "fail",
      expected: fx.expectedDomain,
      got,
      transcript,
      transcriptOk,
      sessionId,
      ...audit,
    };
  } catch (err) {
    return {
      file: fx.file,
      status: "error",
      expected: fx.expectedDomain,
      sessionId,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

function fmtUsd(n?: number): string {
  return n === undefined ? "—" : `$${n.toFixed(5)}`;
}

async function main(): Promise<void> {
  // Reuse the backend's own pool (handles DATABASE_URL *and* the
  // DB_HOST/DB_NAME/... env style + DigitalOcean SSL). null when the caller
  // opted out of audit reads with VOICE_QA_SKIP_AUDIT=1 — then routing still
  // runs, but the cost/latency columns stay blank.
  const pool = READ_AUDIT ? getSharedPool() : null;

  const token = await mintToken(pool);

  console.log(`\nVoice Dispatcher — Phase 6 replay`);
  console.log(`  API:    ${API_BASE}`);
  console.log(`  Shop:   ${SHOP_ID}`);
  console.log(`  Clips:  ${VOICE_FIXTURES.length} in manifest\n`);

  const results: ClipResult[] = [];
  for (const fx of VOICE_FIXTURES) {
    const r = await runClip(token, pool, fx);
    results.push(r);
    const icon =
      r.status === "pass"
        ? "✅"
        : r.status === "fail"
          ? "❌"
          : r.status === "skipped"
            ? "⏭️ "
            : "💥";
    const route =
      r.got !== undefined ? `${r.expected} → got ${r.got}` : r.expected;
    const cost =
      r.sttCostUsd !== undefined || r.routerCostUsd !== undefined
        ? ` | stt ${fmtUsd(r.sttCostUsd)} router ${fmtUsd(r.routerCostUsd)}`
        : "";
    console.log(
      `${icon} ${r.file.padEnd(38)} ${route}${cost}${r.note ? ` | ${r.note}` : ""}`
    );
    if (r.transcript) console.log(`     ↳ "${r.transcript}"`);
  }

  const scored = results.filter(
    (r) => r.status === "pass" || r.status === "fail"
  );
  const passed = scored.filter((r) => r.status === "pass").length;
  const accuracy = scored.length ? passed / scored.length : 0;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errored = results.filter((r) => r.status === "error").length;

  console.log("\n── Summary ──────────────────────────────────────────────");
  console.log(`  Routed:    ${scored.length}/${VOICE_FIXTURES.length} clips`);
  console.log(
    `  Accuracy:  ${(accuracy * 100).toFixed(1)}%  (${passed}/${scored.length})  target ≥ ${(ROUTER_ACCURACY_TARGET * 100).toFixed(0)}%`
  );
  if (skipped) console.log(`  Skipped:   ${skipped} (clip not recorded yet)`);
  if (errored) console.log(`  Errored:   ${errored} (transcribe/dispatch failed)`);

  // Cost rollup (STT + router only — downstream Sonnet cost is per-panel and
  // gets reconciled in v1-cost-report.md via session_id joins).
  const withCost = scored.filter((r) => r.sttCostUsd !== undefined);
  if (withCost.length) {
    const totalStt = withCost.reduce((s, r) => s + (r.sttCostUsd ?? 0), 0);
    const totalRouter = withCost.reduce((s, r) => s + (r.routerCostUsd ?? 0), 0);
    console.log(
      `  Avg STT:   ${fmtUsd(totalStt / withCost.length)} | Avg router: ${fmtUsd(totalRouter / withCost.length)}  (n=${withCost.length})`
    );
  }
  console.log("");

  if (pool) await closeSharedPool();

  // Non-zero exit when below target OR any clip errored — so CI/cron flags it.
  if (scored.length > 0 && (accuracy < ROUTER_ACCURACY_TARGET || errored > 0)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("replay-fixtures fatal:", err);
  process.exit(1);
});

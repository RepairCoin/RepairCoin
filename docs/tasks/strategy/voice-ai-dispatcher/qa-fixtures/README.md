# QA fixtures — Voice-first AI Dispatcher Phase 6

Scaffolding for the Phase 6 acceptance pass in
`../implementation.md` §4: router-accuracy + cost calibration before
declaring voice v1 stable. Companion human checklist: `../qa-test-guide.md`.
Results get written up in `../v1-cost-report.md`.

All scripts:
- Connect to the database the backend's `.env` is pointed at (DigitalOcean
  Postgres). **There is no separate staging DB** — same caveat as every other
  fixture folder in this repo.
- Are read-only against the DB (COUNTs + audit-row reads). They do NOT insert
  synthetic rows. The only writes are the audit rows the live endpoints create
  as a normal side effect of being called.
- Run from `backend/` so Node resolves `pg` / `dotenv` / `jsonwebtoken` from
  `backend/node_modules`. The `tsconfig.json` here extends `backend/tsconfig.json`.

## Files

| File | What it does |
|---|---|
| `fixtures.ts` | The 10-clip manifest: filename → spoken phrase → expected router domain (3 insights / 3 marketing / 2 help / 2 out_of_scope). Source of truth for both scripts. |
| `seed-test-shop.ts` | Read-only readiness check — verifies the test shop exists/active and has enough customers, transactions, and inventory that each routed panel responds meaningfully. Points you at the right seeder when something's thin. |
| `replay-fixtures.ts` | The harness — POSTs each present clip through `/transcribe` then `/dispatch`, asserts the returned domain, reports STT/router cost + latency from the audit tables, and exits non-zero if accuracy < 95%. CI/cron-ready. |
| `pre-recorded-audio/README.md` | How to record the 10 `.webm` clips (not committed — binary + personal voice). |
| `tsconfig.json` | Extends `backend/tsconfig.json` so `npx ts-node` resolves cleanly. |

## How to run a full pass

```bash
cd backend

# 1. Confirm the test shop has data for each domain.
VOICE_QA_SHOP_ID=peanut \
  npx ts-node ../docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/seed-test-shop.ts

# 2. Record the 10 clips → pre-recorded-audio/ (see that folder's README).

# 3. Start the backend (another terminal):  npm run dev

# 4. Replay all clips against the running server and score routing + cost.
VOICE_QA_SHOP_ID=peanut \
  npx ts-node ../docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/replay-fixtures.ts

# 5. Paste the cost/latency numbers into ../v1-cost-report.md and resolve
#    the decision matrix there.
```

### Environment knobs (replay-fixtures.ts)

| Var | Default | Purpose |
|---|---|---|
| `VOICE_QA_API_BASE` | `http://localhost:4000` | Point at staging instead of local. |
| `VOICE_QA_SHOP_ID` | `peanut` | Test shop. Must exist + be active (minted JWT is validated against the DB). |
| `VOICE_QA_JWT` | — | Paste a real shop access token to skip minting. |
| `VOICE_QA_SKIP_AUDIT` | — | Set `1` to skip the DB audit-row reads (routing-only, no cost numbers). |

`JWT_SECRET` and `DATABASE_URL` come from `backend/.env` automatically when
CWD is `backend/`.

## Status

**Scaffold only.** The harness and manifest are complete and runnable; the
10 audio clips still need recording (binary, intentionally uncommitted), and
`../v1-cost-report.md` is an empty skeleton awaiting a real replay run.

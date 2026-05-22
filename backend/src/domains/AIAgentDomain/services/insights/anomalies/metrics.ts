// backend/src/domains/AIAgentDomain/services/insights/anomalies/metrics.ts
//
// The 5 starter metrics the nightly AnomalyDetector watches. Each
// metric provides a `compute(pool, shopId)` function that returns
// {current, prior} values for this-week vs last-week (calendar-aligned,
// reuses windowBoundsFor()).
//
// Adding a new metric: append to METRIC_DEFINITIONS. No SQL changes
// elsewhere — the detector's loop is metric-agnostic.

import { Pool } from "pg";
import { windowBoundsFor } from "../ranges";
import { MetricDefinition } from "./types";

/**
 * Pull a single scalar from the DB, defaulting to 0 on empty result
 * or null. Centralized so every metric compute fn stays a one-liner.
 */
async function scalar(
  pool: Pool,
  sql: string,
  params: unknown[]
): Promise<number> {
  const r = await pool.query<{ v: string | null }>(sql, params);
  return Number(r.rows[0]?.v ?? 0);
}

function weekBounds() {
  return {
    current: windowBoundsFor("this_week"),
    prior: windowBoundsFor("last_week"),
  };
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "weekly_revenue",
    label: "Revenue",
    upIsGood: true,
    minPriorSignal: 50, // $50 — below this, a swing is statistical noise.
    async compute(pool, shopId) {
      const w = weekBounds();
      const sumSql = (from: Date, to: Date | null) => {
        const conds = [`shop_id = $1`, `status IN ('paid', 'completed')`, `created_at >= $2`];
        const params: unknown[] = [shopId, from];
        if (to) {
          conds.push(`created_at < $3`);
          params.push(to);
        }
        return {
          sql: `SELECT COALESCE(SUM(total_amount), 0)::text AS v FROM service_orders WHERE ${conds.join(" AND ")}`,
          params,
        };
      };
      const cur = sumSql(w.current.from!, w.current.to);
      const pri = sumSql(w.prior.from!, w.prior.to);
      return {
        current: await scalar(pool, cur.sql, cur.params),
        prior: await scalar(pool, pri.sql, pri.params),
      };
    },
  },
  {
    key: "weekly_no_shows",
    label: "No-shows",
    upIsGood: false,
    minPriorSignal: 1, // need at least 1 prior to compare.
    async compute(pool, shopId) {
      const w = weekBounds();
      const cnt = (from: Date, to: Date | null) => {
        const conds = [`shop_id = $1`, `status = 'no_show'`, `created_at >= $2`];
        const params: unknown[] = [shopId, from];
        if (to) {
          conds.push(`created_at < $3`);
          params.push(to);
        }
        return {
          sql: `SELECT COUNT(*)::text AS v FROM service_orders WHERE ${conds.join(" AND ")}`,
          params,
        };
      };
      const cur = cnt(w.current.from!, w.current.to);
      const pri = cnt(w.prior.from!, w.prior.to);
      return {
        current: await scalar(pool, cur.sql, cur.params),
        prior: await scalar(pool, pri.sql, pri.params),
      };
    },
  },
  {
    key: "weekly_cancellations",
    label: "Cancellations",
    upIsGood: false,
    minPriorSignal: 1,
    async compute(pool, shopId) {
      const w = weekBounds();
      const cnt = (from: Date, to: Date | null) => {
        const conds = [`shop_id = $1`, `status = 'cancelled'`, `created_at >= $2`];
        const params: unknown[] = [shopId, from];
        if (to) {
          conds.push(`created_at < $3`);
          params.push(to);
        }
        return {
          sql: `SELECT COUNT(*)::text AS v FROM service_orders WHERE ${conds.join(" AND ")}`,
          params,
        };
      };
      const cur = cnt(w.current.from!, w.current.to);
      const pri = cnt(w.prior.from!, w.prior.to);
      return {
        current: await scalar(pool, cur.sql, cur.params),
        prior: await scalar(pool, pri.sql, pri.params),
      };
    },
  },
  {
    key: "weekly_ai_conversations",
    label: "AI conversations",
    upIsGood: true,
    minPriorSignal: 3, // small shops can swing wildly; 3 is a floor.
    async compute(pool, shopId) {
      const w = weekBounds();
      const cnt = (from: Date, to: Date | null) => {
        const conds = [`shop_id = $1`, `created_at >= $2`];
        const params: unknown[] = [shopId, from];
        if (to) {
          conds.push(`created_at < $3`);
          params.push(to);
        }
        return {
          sql: `SELECT COUNT(DISTINCT conversation_id)::text AS v FROM ai_agent_messages WHERE ${conds.join(" AND ")}`,
          params,
        };
      };
      const cur = cnt(w.current.from!, w.current.to);
      const pri = cnt(w.prior.from!, w.prior.to);
      return {
        current: await scalar(pool, cur.sql, cur.params),
        prior: await scalar(pool, pri.sql, pri.params),
      };
    },
  },
  {
    key: "weekly_bookings",
    label: "Bookings",
    upIsGood: true,
    minPriorSignal: 3,
    async compute(pool, shopId) {
      const w = weekBounds();
      const cnt = (from: Date, to: Date | null) => {
        const conds = [`shop_id = $1`, `created_at >= $2`];
        const params: unknown[] = [shopId, from];
        if (to) {
          conds.push(`created_at < $3`);
          params.push(to);
        }
        return {
          sql: `SELECT COUNT(*)::text AS v FROM service_orders WHERE ${conds.join(" AND ")}`,
          params,
        };
      };
      const cur = cnt(w.current.from!, w.current.to);
      const pri = cnt(w.prior.from!, w.prior.to);
      return {
        current: await scalar(pool, cur.sql, cur.params),
        prior: await scalar(pool, pri.sql, pri.params),
      };
    },
  },
];

export function getMetricByKey(key: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS.find((m) => m.key === key);
}

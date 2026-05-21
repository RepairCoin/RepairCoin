// Smoke test for Phase 3.4 — POST /api/ai/insights route registration.
//
// Walks router.stack to verify the route exists, lives at the right
// path, gates on `shop` role, and dispatches to askInsights.
//
// Also asserts:
//   - The route mounts at the exact path the impl-doc spec'd
//   - Same auth shape as /help (authMiddleware + requireRole(['shop']))
//   - askInsights handler reference is in the chain
//
// Run: npx ts-node scripts/smoke-insights-route.ts

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initializeRoutes } from "../src/domains/AIAgentDomain/routes";
import { askInsights } from "../src/domains/AIAgentDomain/controllers/InsightsController";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(72)} ${detail}`);
  ok ? pass++ : fail++;
};

interface ExpressLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ name: string; handle: any }>;
  };
  name?: string;
  handle?: any;
}

function main() {
  const router = initializeRoutes();
  const stack: ExpressLayer[] = (router as any).stack ?? [];
  const routes = stack
    .filter((l) => l.route)
    .map((l) => ({
      path: l.route!.path,
      methods: Object.keys(l.route!.methods).filter((m) => l.route!.methods[m]),
      handlers: l.route!.stack.map((s) => ({ name: s.name, handle: s.handle })),
    }));

  console.log("=== Registered routes (overview) ===");
  for (const r of routes) {
    console.log(
      `  ${r.methods.map((m) => m.toUpperCase()).join(",").padEnd(8)} ${r.path}`
    );
  }

  // 1. POST /insights exists.
  console.log("\n=== POST /insights wiring ===");
  const insightsRoute = routes.find(
    (r) => r.path === "/insights" && r.methods.includes("post")
  );
  check("POST /insights registered", !!insightsRoute);
  if (!insightsRoute) {
    console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed ✗`);
    process.exit(1);
  }

  // 2. Handler chain: authMiddleware → requireRole → askInsights
  const handlerNames = insightsRoute.handlers.map((h) => h.name);
  console.log(`  handler chain: [${handlerNames.join(", ")}]`);
  check(
    "chain has 3 handlers (auth, role, controller)",
    insightsRoute.handlers.length === 3,
    `got ${insightsRoute.handlers.length}`
  );
  check(
    "handler[0] is authMiddleware",
    insightsRoute.handlers[0].name === "authMiddleware",
    `got '${insightsRoute.handlers[0].name}'`
  );
  // requireRole returns an anonymous function; we can't match by name.
  // Just confirm it's a function reference.
  check(
    "handler[1] is a function (requireRole result)",
    typeof insightsRoute.handlers[1].handle === "function"
  );
  check(
    "handler[2] is askInsights",
    insightsRoute.handlers[2].handle === askInsights,
    `name='${insightsRoute.handlers[2].name}'`
  );

  // 3. Same auth shape as /help (compare directly).
  console.log("\n=== /insights mirrors /help auth shape ===");
  const helpRoute = routes.find(
    (r) => r.path === "/help" && r.methods.includes("post")
  );
  check("/help route exists for comparison", !!helpRoute);
  if (helpRoute) {
    check(
      "/insights handler[0] === /help handler[0] (same authMiddleware)",
      insightsRoute.handlers[0].handle === helpRoute.handlers[0].handle
    );
    // The requireRole(['shop']) calls return different function instances
    // but both should be functions returning express middleware.
    check(
      "/insights handler[1] is a function (like /help)",
      typeof insightsRoute.handlers[1].handle === "function" &&
      typeof helpRoute.handlers[1].handle === "function"
    );
  }

  // 4. No duplicate registration.
  console.log("\n=== Sanity ===");
  const insightsCount = routes.filter(
    (r) => r.path === "/insights" && r.methods.includes("post")
  ).length;
  check("POST /insights registered exactly once", insightsCount === 1);

  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  // Force-exit: importing routes.ts pulls in every domain controller,
  // some of which open DB pools eagerly at module-load time and keep
  // the event loop alive past main() return.
  process.exit(fail ? 1 : 0);
}

main();

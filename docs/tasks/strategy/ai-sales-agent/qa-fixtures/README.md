# QA fixtures — AI Sales Agent reschedule + cancel

Synthetic-data scripts for testing the reschedule + cancel chat flow
(Phase 5.6 of `reschedule-cancel-implementation.md`). Use these to
re-run the QA scenarios in
`docs/tasks/strategy/ai-sales-agent/reschedule-cancel-scope.md` §4
without waiting for real customers to book.

All scripts:
- Connect to the database the backend's `.env` is pointed at (i.e.
  the live DigitalOcean Postgres — there is no separate staging DB
  for this repo). Run cleanup when finished.
- Default to `SHOP_ID = 'peanut'` and a single `CUSTOMER_ADDRESS`
  constant at the top of each script — edit if testing as a
  different customer or shop.
- Tag every created row with a `qa_marker` in `service_orders.notes`
  (`AISA-RC-QA-<timestamp>` style) so cleanup can target only the
  rows this session inserted.

## How to run

```bash
cd backend
npx ts-node ../docs/tasks/strategy/ai-sales-agent/qa-fixtures/<script>.ts
```

The nested `tsconfig.json` extends `backend/tsconfig.json` so
`ts-node` resolves correctly from this location.

## Scripts

| Script | Scenario | Sets up |
|---|---|---|
| `setup-cancellable-appointment.ts` | Happy-path cancellation | One paid order 48h+ out for `peanut` × `CUSTOMER_ADDRESS`, with a real `conversation_id` pulled from an existing chat between them (so the Phase 5 confirmation message hook fires). |
| `setup-within-window-appointment.ts` | 24h guard rejection | One paid order ~12h out. Banner's "within 24h cancellation window" marker should appear; tool should refuse to fire; if forced via stale client, endpoint 400s. |
| `setup-pending-reschedule-request.ts` | Pending-request collision (Q2) | One paid order + a corresponding `pending` row in `appointment_reschedule_requests`. The `propose_reschedule_request` tool's order_id enum should exclude this order; if forced through, server-side validation rejects with `reschedule_tool_pending_request_exists`. |
| `cleanup.ts` | Removes all QA rows | Hard-deletes orders + reschedule requests with the `AISA-RC-QA-` marker. Real production rows are matched by neither pattern and stay intact. |

## End-to-end test path

1. Run `setup-cancellable-appointment.ts`.
2. Open the customer's chat thread with the test shop (via the
   shop's marketplace page or by tapping the chat icon on the
   shop's service card).
3. Customer message: "cancel my appointment".
4. Expect: AI replies with `CancellationConfirmCard` rendered below
   the bubble. The card shows the service name, day/time, and a
   red "Tap to cancel" CTA.
5. Tap the card → modal opens. Confirm.
6. Expect: card flips to emerald "Cancelled" state in place.
7. Within ~1s, a second AI message lands: "Got it — your
   appointment at <shop> on <slot> has been cancelled."
8. Run `cleanup.ts`.

Repeat the same flow with `setup-within-window-appointment.ts` to
verify the 24h-guard path, and with
`setup-pending-reschedule-request.ts` to verify the pending-request
refusal.

## Cleanup safety

`cleanup.ts` matches on `service_orders.notes LIKE 'AISA-RC-QA-%'`
and `appointment_reschedule_requests.customer_reason LIKE
'AISA-RC-QA-%'`. Real customer cancellations + reschedule requests
have no such marker (the AI cancel modal trims/caps free-form text
but doesn't inject prefixes), so cleanup is collision-free.

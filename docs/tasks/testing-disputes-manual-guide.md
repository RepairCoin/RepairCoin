# Manual Testing Guide: No-Show Disputes

## Date: 2026-03-18

## Feature: `/shop?tab=disputes`

---

## Step 1: Create a No-Show (Shop Side)

1. Log in as **shop** (e.g. peanut)
2. Go to `/shop?tab=bookings`
3. Find a completed or paid booking
4. Mark the customer as **No Show** (there should be a no-show button/option on the booking)
5. This creates a `no_show_history` record for that customer

---

## Step 2: Submit a Dispute (Customer Side)

1. Log in as the **customer** who was marked no-show
2. Go to `/customer?tab=orders`
3. Find the order that was marked as no-show
4. There should be a "Dispute" button or option on that order
5. Enter a reason (10+ characters, e.g. "I arrived on time but the shop was closed early")
6. Submit — you should see either:
   - **"Auto-approved"** (if first offense and shop has auto-approve enabled)
   - **"Pending review"** (waiting for shop to decide)
7. Customer should receive an email notification

---

## Step 3: Review the Dispute (Shop Side)

1. Log back in as the **shop**
2. Go to `/shop?tab=disputes`
3. You should see the pending dispute in the list
4. Expand it to see customer details and reason
5. Test both actions:
   - **Approve** — click approve, optionally add notes, confirm
   - **Reject** — click reject, add required notes (10+ chars), confirm
6. Customer receives email with the decision

---

## Step 4: Admin Oversight (Admin Side)

1. Log in as **admin**
2. The admin disputes view should be accessible from the admin dashboard (check if there's a disputes section)
3. You can see all platform disputes across all shops
4. Test the admin override — resolve a dispute that the shop already decided on

---

## Verification Checklist

| #   | Check                                | Where                        | Expected                                 |
| --- | ------------------------------------ | ---------------------------- | ---------------------------------------- |
| 1   | No-show creates a record             | Shop bookings → mark no-show | Record in `no_show_history`              |
| 2   | Customer sees dispute option         | Customer orders tab          | "Dispute" button visible                 |
| 3   | Dispute reason validation            | Customer dispute form        | Rejects < 10 chars                       |
| 4   | Auto-approve works for first offense | Customer submits dispute     | Auto-approved if first offense           |
| 5   | Pending disputes show in shop tab    | `/shop?tab=disputes`         | Dispute listed as pending                |
| 6   | Filter tabs work                     | Shop disputes tab            | Pending/Approved/Rejected/All            |
| 7   | Approve reverses penalty             | Approve dispute              | No-show count decremented, tier updated  |
| 8   | Reject requires notes                | Try rejecting without notes  | Validation error                         |
| 9   | Emails sent                          | Check customer email         | On submit, approve, and reject           |
| 10  | Admin can view all disputes          | Admin dashboard              | All platform disputes visible            |
| 11  | Admin can override decision          | Admin resolve dispute        | Resolution recorded with `admin:` prefix |

---

## Quick Test Path (Minimum)

1. **Shop**: Mark a customer as no-show on any booking
2. **Customer**: Open that order → submit dispute
3. **Shop**: Go to disputes tab → approve or reject
4. **Verify**: Customer email received, no-show count updated

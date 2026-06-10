# Campaign Rewards — QA Test Guide

Manual test plan for the Campaign Rewards feature (RCN rewards + bonus-RCN coupons
attached to marketing campaigns). Run on **staging**. Spec/impl:
`campaign-rcn-auto-issue.md` / `campaign-rewards-implementation.md`.

Branch: `deo/campaign-rewards`.

---

## 0. What you're testing

A marketing campaign can carry a real reward:
- **Flat RCN** issued to everyone on send
- **Variable RCN** by loyalty tier or by spend
- **Redeem-on-return** RCN (issued only when the customer next completes an order)
- **Bonus-RCN coupon** (a code redeemed on the next visit)

Gated per-shop by an admin flag. RCN is drawn from the shop's purchased RCN balance.

---

## 1. Setup (do this once)

Use a **test shop** (e.g. `peanut` or `1111`) and **test customers** — never real ones.

> ⚠️ Sends deliver real emails to whatever addresses are on the audience. Use a shop
> whose customers are test accounts you control.

**1.1 Enable the feature for the shop (admin gate).**
- As an **admin**: dashboard → **AI settings** tab → find the shop → flip **Campaign Rewards** ON. Reload; confirm it stuck and the "X with rewards on" count went up.
- (Or SQL: `UPDATE ai_shop_settings SET campaign_rewards_enabled = true WHERE shop_id = 'peanut';`)

**1.2 Give the shop an RCN balance to spend.**
- Check: `SELECT shop_id, purchased_rcn_balance FROM shops WHERE shop_id = 'peanut';`
- If low, top up for testing: `UPDATE shops SET purchased_rcn_balance = purchased_rcn_balance + 1000 WHERE shop_id = 'peanut';`

**1.3 Confirm there are registered test customers** for the shop's audience (with wallets + emails) so an audience resolves non-empty. "Lapsed" needs customers whose last booking is 90+ days old.

**1.4 Note on on-chain minting.** If `ENABLE_BLOCKCHAIN_MINTING` is NOT `true` on staging, issuance is **off-chain**: the DB still debits the shop, credits the customer, and records a transaction, but `reward_tx_hash` will start with `offchain_`. That's expected and fine for QA.

---

## 2. Test cases

Tick each. For each campaign you draft, grab its `campaign_id` from the draft card / DB to run the verify queries.

### T1 — Admin toggle gates the feature
- [ ] With the flag **OFF** for a shop, open the shop's assistant and ask: *"Draft a win-back email and give each customer 25 RCN."*
- **Expected:** the draft is created **without** a reward; the assistant says campaign rewards aren't enabled for the shop yet (it should mention an admin enables them). The draft card shows **no** 🎁 reward line.
- [ ] Turn the flag **ON** (step 1.1) and repeat — now the reward should attach (see T2).

### T2 — Flat RCN, issued on send
- [ ] Assistant: *"Draft a thank-you email to my active customers and give each 10 RCN, send it now."* (or draft, then tap Send in the review modal)
- **Expected (draft card):** 🎁 **Reward: 10 RCN each · N0 RCN total · (issued on send)**.
- [ ] Note the shop balance before. Tap **Send**.
- **Expected (after send):** each registered recipient's RCN goes up by 10; shop balance drops by `10 × eligible`; the send result mentions issued count.
- **Verify:**
  - Recipients: `SELECT customer_address, reward_kind, reward_amount, reward_status, reward_tx_hash FROM marketing_campaign_recipients WHERE campaign_id = '<id>';` → rows `rcn` / `issued`.
  - A recipient: `SELECT address, current_rcn_balance, lifetime_earnings FROM customers WHERE LOWER(address)=LOWER('<addr>');` → increased.
  - Shop: `SELECT purchased_rcn_balance FROM shops WHERE shop_id='peanut';` → decreased by the total.
  - Transactions: `SELECT type, amount, reason FROM transactions WHERE LOWER(customer_address)=LOWER('<addr>') ORDER BY timestamp DESC LIMIT 3;`

### T3 — Balance gate blocks an unaffordable send
- [ ] Temporarily lower the shop balance below a reward total (e.g. `UPDATE shops SET purchased_rcn_balance = 5 WHERE shop_id='peanut';`).
- [ ] Draft a flat reward whose total exceeds 5 RCN and tap **Send**.
- **Expected:** the send is **blocked** with a clear "needs X RCN, balance is Y" message; **no** emails go out and **no** RCN is issued (check recipients have no `issued` rows; balance unchanged). Restore the balance afterward.

### T4 — Redeem-on-return RCN
- [ ] Assistant: *"Send a win-back email to customers who haven't booked in 90 days, and give them 30 RCN when they come back, valid 30 days."*
- **Expected (draft card):** 🎁 **Reward: 30 RCN each · up to N RCN total · (when they return, 30 days)**. Tap Send.
- **Expected (after send):** **no RCN issued yet**; recipients are `pending` with a `reward_expires_at`.
  - Verify: recipients rows `reward_status = 'pending'`, `reward_expires_at` ~30 days out; shop balance **unchanged**.
- [ ] As one of those test customers, **complete an order** at the shop (book + pay + complete through the normal flow) → fires `service.order_completed`.
- **Expected:** that customer's pending reward flips to `redeemed`, RCN is issued now, shop balance drops by 30, transaction recorded.
- [ ] Complete a **second** order for the same customer → **no** second issue (still one `redeemed` row; balance unchanged).

### T5 — Variable RCN by tier
- [ ] Assistant: *"Reward my customers by tier: Gold 50, Silver 25, Bronze 10 RCN, on send."*
- **Expected (card):** 🎁 **Reward: Gold 50 / Silver 25 / Bronze 10 RCN each**. Tap Send.
- **Verify:** each recipient's `reward_amount` matches **their** tier (`SELECT c.tier, r.reward_amount FROM marketing_campaign_recipients r JOIN customers c ON LOWER(c.address)=LOWER(r.customer_address) WHERE r.campaign_id='<id>';`). A customer with no tier mapping is `skipped` (amount 0).

### T6 — Variable RCN by spend
- [ ] Assistant: *"Give more to bigger spenders: 10 RCN under $500, 25 at $500+, 50 at $1000+, on send."*
- **Expected (card):** 🎁 **Reward: 10–50 RCN by spend**. Tap Send.
- **Verify:** each recipient gets the highest band they qualify for (cross-check against their shop spend).

### T7 — Bonus-RCN coupon
- [ ] Assistant: *"Send a come-back email with a code worth 20 bonus RCN, valid 60 days."*
- **Expected (card):** 🎟️ **Coupon: `CODE` · +20 RCN (redeemed on next visit)**. The email body contains the code.
  - Verify the code exists: `SELECT code, bonus_type, bonus_value, end_date FROM promo_codes WHERE shop_id='peanut' ORDER BY created_at DESC LIMIT 1;`
- [ ] As the **shop**, issue a reward to a test customer **using that code** (the normal issue-reward flow with the promo code) → the customer gets the base reward **+ 20 bonus RCN**; the code's `times_used` increments.

### T8 — Edge cases
- [ ] **Unregistered / no-wallet recipient:** still gets the email, but no RCN — recipient row `reward_status = 'skipped'`. Reported in the result, not silently dropped.
- [ ] **Shop's own wallet** in the audience: excluded from issuance.
- [ ] **Retry failed:** if any recipient is `failed` (e.g. a transient issue), `POST /api/marketing/campaigns/:id/retry-rewards` re-issues only the failed ones, idempotently.

---

## 3. Cleanup
- Turn the flag back OFF if the shop shouldn't keep it: `UPDATE ai_shop_settings SET campaign_rewards_enabled = false WHERE shop_id='peanut';`
- Restore any balance you changed.
- The test campaigns + their recipient/reward rows can stay (they're scoped to the test shop) or be removed.

## 4. Quick DB reference (read-only)
```sql
-- flag
SELECT shop_id, campaign_rewards_enabled FROM ai_shop_settings WHERE shop_id='peanut';
-- shop balance
SELECT shop_id, purchased_rcn_balance FROM shops WHERE shop_id='peanut';
-- reward ledger for a campaign
SELECT customer_address, reward_kind, reward_amount, reward_status,
       reward_tx_hash, reward_expires_at, reward_redeemed_at, reward_error
  FROM marketing_campaign_recipients WHERE campaign_id='<id>' ORDER BY reward_status;
-- a customer's balance
SELECT address, current_rcn_balance, lifetime_earnings, tier FROM customers WHERE LOWER(address)=LOWER('<addr>');
-- coupons
SELECT code, bonus_value, end_date, times_used FROM promo_codes WHERE shop_id='peanut' ORDER BY created_at DESC;
```

## 5. Pass criteria
- Flag gates everything; reward only attaches when ON.
- On-send issues exactly the right amounts, debits the shop, credits customers, records transactions.
- Balance gate blocks unaffordable sends with nothing issued.
- Redeem-on-return issues once, only on the customer's return, within the window; no double-issue.
- Variable amounts match each customer's tier/spend.
- Coupon code is generated, emailed, and grants the bonus on redemption.
- Unregistered → skipped (emailed, no RCN); shop wallet excluded.

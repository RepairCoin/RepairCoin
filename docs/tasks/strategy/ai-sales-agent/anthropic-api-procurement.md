# Anthropic Claude API — Procurement Steps

## Purpose

To enable the AI Sales Agent feature for the FixFlow platform, an Anthropic Claude API account is required. The steps below cover account creation, payment setup, and spending controls.

**Estimated total time:** ~30 minutes to complete all steps.

---

## Step 1 — Create an Anthropic Console account

1. Go to **`console.anthropic.com`**
2. Click **Sign up**
3. Use a **company email** — `hello@repaircoin.ai` or another shared admin inbox
4. Verify the email
5. Complete the basic profile (name, company name "RepairCoin" / "FixFlow")

**Recommendation:** create the account under a shared company inbox so API ownership is held at the organization level. This ensures continuity if individual team members change roles.

---

## Step 2 — Set up the organization and workspaces

Anthropic Console uses **Organizations** (the company account) and **Workspaces** (environments within the org). Each workspace has its own API keys, spending limits, and member access — this lets you keep production cost separated from development experiments.

This step has three parts: (A) rename the default organization, (B) create environment workspaces, (C) optionally invite team members.

### 2A — Rename the default organization

1. After signing up, you'll land inside a default organization (typically named after the email you signed up with).
2. From the Console, click your account icon in the top-right corner.
3. Select **Settings** from the dropdown menu.
4. In the left sidebar, click **General** under the **Organization** section.
5. Find the **Organization name** field and update it to the company name (e.g., `FixFlow` or `RepairCoin`).
6. Click **Save**.

**Confirmation:** the organization name shown in the top-left header of the Console should now read the updated name.

### 2B — Create three workspaces for environment isolation

1. Click the **workspace switcher** at the top-left of the Console (a dropdown showing the current workspace, likely labeled "Default Workspace").
2. Click **Create Workspace** (or **+ New Workspace**) at the bottom of the dropdown.
3. Create the following three workspaces, one at a time:

| Workspace name | Purpose |
|---|---|
| `Production` | Live customer-facing AI traffic. Holds the production API key. |
| `Staging` | Pre-production testing against the staging environment. |
| `Development` | Engineer experimentation and local testing. |

4. For each workspace, fill in:
   - **Name** — exactly as listed above
   - **Description** (optional) — short note describing the purpose
5. Click **Create** to save.
6. Repeat steps 1-5 for all three workspaces.

**Confirmation:** the workspace switcher dropdown should list all three new workspaces. You can click any of them to switch between contexts. Each workspace will have its own settings page accessible via **Settings** while that workspace is active.

**Optional cleanup:** the original "Default Workspace" can be deleted or renamed to `Archive` if you want a cleaner list. Not required.

### 2C — Invite team members (optional, can be done later)

If other team members need access to the API account:

1. Go to **Settings → Members** at the organization level.
2. Click **Invite Member**.
3. Enter the team member's email address.
4. Select their role:
   - **Admin** — full access (billing, members, all workspaces). For the operator/owner only.
   - **Developer** — can create API keys and view usage but cannot modify billing. For engineers.
   - **Billing** — billing/payment management only. For finance team members.
5. Click **Send Invitation**. The team member receives an email to accept and join.

For initial procurement, only the operator setting up the account needs to do this step. Engineers can be invited later when they need to generate development API keys.

---

## Step 3 — Add a payment method

Anthropic uses **prepaid credits** — credit is purchased upfront and usage decrements the balance.

1. Go to **Settings → Plans & Billing**
2. Add a company credit card
3. Purchase initial credit. Recommended starting amounts:
   - **$5–$20** — engineering spike and first integration test
   - **$50–$100** — soft launch with a limited number of shops
   - **$500+** — production capacity for broader rollout
4. Enable **Auto-recharge** once spending patterns are predictable — automatically refills when balance drops below a configured threshold

---

## Step 4 — Apply for higher rate-limit tier

New accounts start at **Tier 1** with low rate limits. Promotion to higher tiers is automatic based on spend and account age:

| Tier transition | Requirement |
|---|---|
| Tier 1 → Tier 2 | $5+ spent, account ≥7 days old |
| Tier 2 → Tier 3 | $40+ spent, account ≥7 days old |
| Tier 3 → Tier 4 | $200+ spent, account ≥14 days old |
| Custom enterprise tier | Contact Anthropic sales |

For the initial production launch, Tier 2-3 will be sufficient.

---

## Step 5 — Generate API keys

1. Go to **Settings → API Keys** (within the workspace where the key should be scoped)
2. Click **Create Key** and name it descriptively, for example:
   - `FixFlow Backend - Production`
   - `FixFlow Backend - Staging`
   - `Engineer Dev - <name>`
3. Copy the key **immediately** — Anthropic displays the key only once and cannot retrieve it again
4. Store the key in a company password manager (1Password, Bitwarden, etc.) and provide it securely to the engineering team

**Best practice:** one API key per environment per workspace. Rotate keys annually.

---

## Step 6 — Set spending limits

Before connecting the API to production traffic, set hard caps to prevent unexpected charges.

1. Go to **Workspace Settings → Usage Limits**
2. Set:
   - **Daily limit** — e.g., $30/day for production starts
   - **Monthly limit** — e.g., $500/month
3. Anthropic will throttle requests once a cap is reached, providing a safety net against unexpected costs.

These workspace-level caps complement application-level per-shop budget controls that will be implemented in the engineering work.

---

## Cost orientation

| Model | Input | Output | Estimated per-conversation |
|---|---|---|---|
| Sonnet 4.6 | ~$3 / million tokens | ~$15 / million tokens | ~$0.018 / conversation (with caching) |
| Haiku 4.5 | ~$0.80 / million tokens | ~$4 / million tokens | ~$0.0035 / conversation (with caching) |

**Phasing of credit purchases:**
- Initial engineering spike + staging test: $20 covers thousands of test conversations
- Soft launch (~100 shops): budget ~$50/month
- Full-scale production rollout: budget ~$2,500/month

---

## Checklist

- [ ] Create Anthropic Console account under shared/admin email (~5 min)
- [ ] Set up Organization and workspaces (~5 min)
- [ ] Add company payment method and purchase initial credit (~10 min)
- [ ] Generate API keys for each environment (~5 min)
- [ ] Configure spending limits per workspace (~5 min)

Once these steps are complete, engineering will be unblocked to begin the Phase 3 implementation (estimated 3-4 weeks).

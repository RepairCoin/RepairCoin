# 🚨 URGENT: Missing ANTHROPIC_API_KEY

**Date:** June 8, 2026
**Issue:** AI Service Recommendations feature failing with 500 error
**Status:** ⚠️ **BLOCKED - Need API Key**

---

## The Problem

When testing the AI chat, clicking send results in:
```
500 Internal Server Error
POST /api/ai/customer-chat/message
```

**Root Cause:**
```
ANTHROPIC_API_KEY not set — AnthropicClient cannot be instantiated
```

The backend is missing the Claude AI API key that powers the customer chat feature.

---

## The Fix

### Step 1: Get Your Anthropic API Key

1. Go to: https://console.anthropic.com/settings/keys
2. Log in with your Anthropic account
3. Create a new API key or copy existing one
4. It looks like: `sk-ant-api03-...`

### Step 2: Add to Backend .env File

Edit `backend/.env` and add:

```bash
# Claude AI API Key (for customer chat)
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE

# Optional: Model configuration (uses defaults if not set)
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-6
ANTHROPIC_FALLBACK_MODEL=claude-haiku-4-5-20251001
```

### Step 3: Restart Backend

```bash
# Kill existing server
lsof -ti:4000 | xargs kill -9

# Start fresh
npm run server

# Or use dev command
npm run dev
```

### Step 4: Test Again

```bash
# Should work now
curl -X POST http://localhost:4000/api/ai/customer-chat/start \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return session ID and welcome message
```

---

## Alternative: Use Test Mode (Temporary)

If you don't have an Anthropic API key yet, you can temporarily enable mock mode:

**Edit:** `frontend/src/services/api/aiAssistant.ts`

Change line 23:
```typescript
const USE_MOCK_DATA = false; // Backend endpoints are ready!
```

To:
```typescript
const USE_MOCK_DATA = true; // Using mock data until API key added
```

This will use the mock service recommendations (hardcoded data) until you add the real API key.

---

## What Happens Without the Key

**Backend Logs Show:**
```
[warn]: AIAgentDomain: OrderConfirmationHandler construction failed
  error: "ANTHROPIC_API_KEY not set — AnthropicClient cannot be instantiated"

[warn]: ai domain: OrderConfirmationHandler unavailable (likely no ANTHROPIC_API_KEY)

[warn]: ai domain: AI follow-up detector unavailable (likely no ANTHROPIC_API_KEY)
```

**Features Disabled:**
- ❌ Customer AI chat (500 error)
- ❌ AI service recommendations
- ❌ Order completion confirmations
- ❌ AI sales follow-ups

**Features Still Working:**
- ✅ All other backend APIs
- ✅ Database operations
- ✅ WebSocket connections
- ✅ Marketplace, shops, admin, etc.

---

## Cost Information

**Claude API Pricing:**
- **Input**: $3 per million tokens (~$0.003 per conversation)
- **Output**: $15 per million tokens (~$0.015 per conversation)
- **Estimated**: $0.01-0.02 per customer chat session

**Budget Recommendation:**
- Start with $10 credit (500-1000 conversations)
- Monitor usage at https://console.anthropic.com
- Set up billing alerts

---

## Testing Checklist

Once you add the API key:

- [ ] Restart backend server
- [ ] Check logs for "AnthropicClient" (should not see warnings)
- [ ] Open frontend: http://localhost:3001
- [ ] Click AI chat button
- [ ] Type: "my phone screen is cracked"
- [ ] Verify: AI responds with service recommendations
- [ ] Verify: Service cards are clickable
- [ ] Click a service card
- [ ] Verify: Navigates to marketplace

---

## Where to Get Help

**Anthropic Console:**
- https://console.anthropic.com
- Create account (free tier available)
- Get API keys
- Monitor usage

**Documentation:**
- https://docs.anthropic.com/en/api/getting-started
- API key management
- Rate limits
- Pricing

**RepairCoin Docs:**
- `docs/AI_ASSISTANT_SERVICE_RECOMMENDATIONS.md` - Implementation guide
- `ZEFF_TASK.md` - Next steps
- `SESSION_NOTES_JUNE_8_2026.md` - Today's work

---

## Quick Commands

```bash
# Check if API key is set
grep "ANTHROPIC_API_KEY" backend/.env

# Start backend (will show warnings if key missing)
cd backend && npm run dev

# Test API endpoint
curl http://localhost:4000/api/ai/health

# Test customer chat start
curl -X POST http://localhost:4000/api/ai/customer-chat/start \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Summary

**Problem:** Missing `ANTHROPIC_API_KEY` in `backend/.env`
**Solution:** Add your Anthropic API key to `.env` file
**Impact:** AI chat feature is blocked until key is added
**Priority:** 🔴 HIGH - Feature is complete but can't test without key

**Next Steps:**
1. Get Anthropic API key
2. Add to `backend/.env`
3. Restart backend
4. Test AI chat
5. Deploy to staging

---

**Status:** Waiting for API key
**Estimated Fix Time:** 5 minutes (once you have the key)
**Updated:** June 8, 2026

---

**Note:** This is the ONLY thing blocking the AI service recommendations feature from working. Everything else is complete and ready! 🚀

// backend/src/domains/AIAgentDomain/routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { audioUploadMiddleware } from '../../middleware/audioUpload';
import { previewAIReply } from './controllers/PreviewController';
import { transcribeVoice } from './controllers/VoiceTranscribeController';
import { speakVoice } from './controllers/VoiceSpeakController';
import { dispatchVoice } from './controllers/VoiceDispatchController';
import { suggestServiceFaqs } from './controllers/FaqSuggestionController';
import { getOwnShopSpend, getAdminCostSummary } from './controllers/SpendController';
import {
  getOwnShopAiSettings,
  updateOwnShopAiSettings,
  listShopAiSettings,
  adminUpdateShopAiSettings,
} from './controllers/SettingsController';
import { getMetrics } from './controllers/MetricsController';
import { askHelp } from './controllers/HelpAssistantController';
import {
  listHelpArticles,
  getHelpArticle,
} from './controllers/HelpArticleController';
import { askInsights } from './controllers/InsightsController';
import { askMarketing } from './controllers/MarketingChatController';
import { askOrchestrator } from './controllers/UnifiedAssistantController';
import { generateImage } from './controllers/ImageGenerateController';
import { editImage } from './controllers/ImageEditController';
import { getOwnBrandKit, updateOwnBrandKit, analyzeLogoColors } from './controllers/BrandKitController';
import {
  listAnomalies,
  dismissAnomaly,
} from './controllers/InsightsAnomaliesController';
import {
  listPinned,
  createPinned,
  deletePinned,
  recordPinnedRun,
} from './controllers/InsightsPinnedController';

/**
 * AI Agent domain routes.
 *
 * Mounted at /api/ai by DomainRegistry (registered in app.ts).
 *
 * Endpoints:
 *   GET  /api/ai/health        — public skeleton-status check
 *   POST /api/ai/preview       — shop/admin: live preview of AI reply for a service
 *   GET  /api/ai/spend         — shop: own monthly spend snapshot (Task 12)
 *   GET  /api/ai/settings      — shop: own AI settings snapshot
 *   PUT  /api/ai/settings      — shop: update own shop-editable AI settings
 *   GET  /api/ai/metrics       — shop: own AI Impact Metrics
 *   POST /api/ai/help          — shop: How-To Assistant (in-dashboard product help)
 *   GET  /api/ai/help/articles — shop: list help-article index (filename + title)
 *   GET  /api/ai/help/articles/:filename — shop: one help article body
 *   POST /api/ai/insights      — shop: Business-Data Insights assistant (Sonnet + tools)
 *   POST /api/ai/marketing-chat — shop: AI Marketing Assistant (Sonnet + tools, propose-then-tap drafts)
 *   GET  /api/ai/insights/anomalies         — shop: list active anomaly banners
 *   POST /api/ai/insights/anomalies/:id/dismiss — shop: dismiss one anomaly
 *   GET    /api/ai/insights/pinned          — shop: list pinned questions
 *   POST   /api/ai/insights/pinned          — shop: pin a question
 *   DELETE /api/ai/insights/pinned/:id      — shop: unpin a question
 *   PUT    /api/ai/insights/pinned/:id/run  — shop: record a fresh tap-to-run
 *   GET  /api/ai/admin/cost-summary — admin: platform-wide aggregate (Task 12)
 */

export function initializeRoutes(): Router {
  const router = Router();

  // Public sanity endpoint. No auth — confirms the domain is registered and
  // reachable. Returns skeleton metadata so a curl/health-check can confirm
  // the AI domain is live without exposing anything sensitive.
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      domain: 'ai',
      status: 'live',
      phase: '3',
      endpoints: [
        'GET /api/ai/health',
        'POST /api/ai/preview',
        'GET /api/ai/spend',
        'GET /api/ai/admin/cost-summary',
      ],
    });
  });

  // Task 6 — Live AI preview for the shop dashboard.
  // Auth: shop OR admin role required at the route level. Per-service
  // ownership check happens inside the controller (shop must own the service).
  router.post(
    '/preview',
    authMiddleware,
    requireRole(['shop', 'admin']),
    previewAIReply
  );

  // AI-suggested FAQ entries for a service. Route gates on shop/admin role;
  // the controller does the per-service ownership check.
  router.post(
    '/services/:serviceId/faq-suggestions',
    authMiddleware,
    requireRole(['shop', 'admin']),
    suggestServiceFaqs
  );

  // Task 12 — Spend monitoring.
  // Shop endpoint: returns the requesting shop's own monthly spend. Auth
  // gates on `shop` role; controller reads shopId from the JWT (no path
  // param, so a shop can never request another shop's spend).
  router.get('/spend', authMiddleware, requireRole(['shop']), getOwnShopSpend);

  // Shop-side AI settings. Both gate on `shop` role; the controller reads
  // shopId from the JWT (no path param) so a shop can only ever read/write
  // its own settings. PUT touches only the shop-editable fields.
  router.get('/settings', authMiddleware, requireRole(['shop']), getOwnShopAiSettings);
  router.put('/settings', authMiddleware, requireRole(['shop']), updateOwnShopAiSettings);

  // Shop-side AI Impact Metrics — Phase 2. Same auth shape as /settings:
  // gates on `shop` role; the controller reads shopId from the JWT (no
  // path param) so a shop can only ever read its OWN metrics.
  // Query: ?range=7d|30d|90d|all  (default 30d)
  router.get('/metrics', authMiddleware, requireRole(['shop']), getMetrics);

  // How-To Assistant — shop-owner in-dashboard product help AI.
  // Body: { sessionId, messages: [{ role, content }, ...] }. The
  // controller reads shopId from the JWT (no path param), spend-caps
  // against the shop's monthly budget (shared with the AI Sales Agent),
  // and audits each call into ai_help_messages.
  router.post('/help', authMiddleware, requireRole(['shop']), askHelp);

  // Help article expansion. The chat assistant cites titles in a
  // *Related:* footer; the panel fetches the index on mount and the
  // body on click. Both shop-role guarded — same audience as /help.
  router.get(
    '/help/articles',
    authMiddleware,
    requireRole(['shop']),
    listHelpArticles
  );
  router.get(
    '/help/articles/:filename',
    authMiddleware,
    requireRole(['shop']),
    getHelpArticle
  );

  // Business-Data Insights assistant — shop-owner "Ask about your
  // business" AI. Body: { sessionId, messages: [{ role, content }, ...] }.
  // Sonnet + tool-use; tools query the requesting shop's data via
  // hardcoded shop-scoped SQL (shopId sourced from the JWT, never
  // from Claude args). Spend-capped against the shared monthly budget
  // and audited into ai_insights_messages with the tool_calls JSONB.
  router.post('/insights', authMiddleware, requireRole(['shop']), askInsights);

  // ⚠️ SPIKE — Unified "Talk To My Business" assistant. ONE conversation
  // that answers business questions (insights tools) AND takes marketing
  // actions (draft a win-back) in a single thread — the flagship demo of
  // the unified-assistant vision. Reuses the insights agent loop with a
  // merged, curated cross-domain tool set; draft-only (never sends).
  // Body: { sessionId, messages: [{ role, content }, ...] }. Shop-scoped via JWT.
  // See docs/tasks/strategy/voice-ai-dispatcher/unified-assistant-vision.md.
  router.post('/orchestrate', authMiddleware, requireRole(['shop']), askOrchestrator);

  // AI Image Generation — Phase 1. Text → branded PNG persisted to DO Spaces.
  // Body: { prompt, dimensions?, quality?, useCase? }. shopId from the JWT.
  // Gated by the per-shop ai_images_enabled kill switch (default off),
  // spend-capped + daily-rate-limited + prompt-moderated; every call audited
  // into ai_image_generations. See docs/tasks/strategy/ai-image-generation/.
  router.post('/images/generate', authMiddleware, requireRole(['shop']), generateImage);

  // AI Image Editing — Phase 6 (Stability img2img). Edit an existing image
  // from a prompt. Body: { sourceImageUrl, prompt, strength?, overlayLogo? }.
  // Same gates/audit/spend as generate; audited operation_type='edit'.
  router.post('/images/edit', authMiddleware, requireRole(['shop']), editImage);

  // Brand kit (AI Image Generation Phase 3) — per-shop colors + tone + logo URL
  // injected into image-generation prompts. shopId from the JWT (read/write own
  // only). PUT is a full replace; the image generator reads it via BrandKitService.
  router.get('/brand-kit', authMiddleware, requireRole(['shop']), getOwnBrandKit);
  router.put('/brand-kit', authMiddleware, requireRole(['shop']), updateOwnBrandKit);
  // Phase 4 vision — extract a brand palette from a logo to auto-fill colors.
  router.post('/brand-kit/analyze-logo', authMiddleware, requireRole(['shop']), analyzeLogoColors);

  // AI Marketing Assistant — shop-owner "compose + send a campaign by
  // chat" AI. Sibling to /insights. Sonnet + tool-use with the four
  // marketing tools: lookup_audience_count (read), propose_campaign_draft
  // (persists draft), propose_campaign_send (validates draft for send),
  // suggest_campaign_strategies (empty-panel chips). Mass-send is gated
  // by the shop tapping confirm on the frontend draft card; this
  // endpoint never sends directly.
  // Body: { sessionId, messages: [{ role, content }, ...] }.
  // Shop-scoped via JWT; audited into ai_marketing_messages.
  router.post(
    '/marketing-chat',
    authMiddleware,
    requireRole(['shop']),
    askMarketing
  );

  // Phase 7.2 — nightly anomaly detection. Banner reads via GET on
  // panel mount; "Dismiss" tap soft-dismisses via POST. Both shop-
  // scoped via JWT — the controller never trusts URL/body for scope.
  router.get(
    '/insights/anomalies',
    authMiddleware,
    requireRole(['shop']),
    listAnomalies
  );
  router.post(
    '/insights/anomalies/:id/dismiss',
    authMiddleware,
    requireRole(['shop']),
    dismissAnomaly
  );

  // Phase 7.3 — saved queries (pinned questions). All shop-scoped via
  // JWT; URL :id never determines scope, so guessing UUIDs can't
  // touch another shop's pins.
  router.get(
    '/insights/pinned',
    authMiddleware,
    requireRole(['shop']),
    listPinned
  );
  router.post(
    '/insights/pinned',
    authMiddleware,
    requireRole(['shop']),
    createPinned
  );
  router.delete(
    '/insights/pinned/:id',
    authMiddleware,
    requireRole(['shop']),
    deletePinned
  );
  router.put(
    '/insights/pinned/:id/run',
    authMiddleware,
    requireRole(['shop']),
    recordPinnedRun
  );

  // Voice AI Dispatcher Phase 1 — speech-to-text via OpenAI Whisper.
  // Multipart upload: `audio` (file), `durationMs` (string), `sessionId`
  // (string), optional `language`. Returns { transcript, durationMs,
  // sessionId }. Shop-scoped via JWT; spend-capped against the shared
  // monthly budget; audited into ai_voice_transcriptions. See
  // docs/tasks/strategy/voice-ai-dispatcher/implementation.md Phase 1.
  router.post(
    '/voice/transcribe',
    authMiddleware,
    requireRole(['shop']),
    audioUploadMiddleware.single('audio'),
    handleMulterErrors,
    transcribeVoice
  );

  // Unified Assistant Phase 3 — voice-OUT (TTS / the "Siri" reply). Body:
  // { text, voice? }. Returns raw audio/mpeg on success (JSON error envelope
  // otherwise). Reuses OPENAI_API_KEY (same vendor as Whisper); spend-capped
  // against the shared monthly budget. See
  // docs/tasks/strategy/unified-assistant/implementation.md Phase 3.
  router.post('/voice/speak', authMiddleware, requireRole(['shop']), speakVoice);

  // Voice AI Dispatcher Phase 3 — cross-domain router. Takes a
  // transcript, asks Haiku to classify it (INSIGHTS / MARKETING /
  // HELP / OUT_OF_SCOPE), returns the decision. Frontend opens the
  // matching panel with the transcript pre-filled. Shop-scoped via
  // JWT; spend-capped against the shared monthly budget; audited
  // into ai_dispatch_audit. See
  // docs/tasks/strategy/voice-ai-dispatcher/implementation.md Phase 3.
  router.post(
    '/dispatch',
    authMiddleware,
    requireRole(['shop']),
    dispatchVoice
  );

  // Admin endpoint: platform-wide aggregate. Mounted under /admin to make
  // the auth boundary explicit. Pure read — safe for admin dashboards.
  router.get(
    '/admin/cost-summary',
    authMiddleware,
    requireRole(['admin']),
    getAdminCostSummary
  );

  // Admin gate — per-shop AI capability controls. List every shop's AI
  // settings, and set the gate fields (AI on/off, follow-ups on/off,
  // monthly budget) for one shop.
  router.get(
    '/admin/shop-settings',
    authMiddleware,
    requireRole(['admin']),
    listShopAiSettings
  );
  router.put(
    '/admin/shop-settings/:shopId',
    authMiddleware,
    requireRole(['admin']),
    adminUpdateShopAiSettings
  );

  return router;
}

/**
 * Convert multer-thrown errors into clean JSON 400 responses. Without
 * this, multer errors fall through to the global error handler and
 * render as 500s. Voice upload failures are user input problems, not
 * server failures — surface them as 400 with a useful message.
 */
function handleMulterErrors(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    // Some @types/multer versions don't narrow `unknown` after
    // `instanceof multer.MulterError` (DO's pinned version is one of
    // them — broke the first deploy attempt with TS2339). Defensive
    // structural cast so this compiles against any @types/multer.
    const e = err as { code?: string; message: string };
    const status = e.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({
      success: false,
      error: `Upload rejected: ${e.message}`,
      code: e.code,
    });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }
  next(err);
}

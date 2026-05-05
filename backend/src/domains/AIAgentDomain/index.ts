// backend/src/domains/AIAgentDomain/index.ts
import { Router } from 'express';
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';

/**
 * AI Sales Agent domain.
 *
 * Phase 3 Task 1: skeleton registration. No functional behaviour yet — just
 * proves the domain mounts cleanly alongside the existing domains. Real
 * services (AnthropicClient, ContextBuilder, AgentOrchestrator, etc.) land
 * in Tasks 3-5 per `docs/tasks/strategy/ai-sales-agent/ai-sales-agent-claude-integration-plan.md`.
 *
 * Required env vars (validated at startup by StartupValidationService):
 *   - ANTHROPIC_API_KEY              (required in production)
 *   - ANTHROPIC_DEFAULT_MODEL        (default: claude-sonnet-4-6)
 *   - ANTHROPIC_FALLBACK_MODEL       (default: claude-haiku-4-5-20251001)
 *
 * Mount path: /api/ai  (DomainRegistry mounts at /api/${domain.name})
 */
export class AIAgentDomain implements DomainModule {
  name = 'ai';
  routes: Router;

  constructor() {
    this.routes = initializeRoutes();
  }

  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized — AI Sales Agent (skeleton)`);
  }
}

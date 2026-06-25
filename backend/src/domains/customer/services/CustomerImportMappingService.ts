// Phase 2 — AI column-mapping for customer import ("just give the file"). Given a file's headers +
// a few sample rows, asks the LLM to map them to our canonical customer fields, regardless of the
// source POS/spreadsheet (Square, Vagaro, Mindbody, …). The mapping is HUMAN-CONFIRMED in the UI
// before import (D4/D8); the deterministic parser/importer still does the actual ingest. Cheap
// (Haiku, one short call); spend-capped per shop. Hallucinated headers are dropped.

import { logger } from '../../../utils/logger';
import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { ClaudeModel } from '../../AIAgentDomain/types';

const MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

export type ImportSchema = 'customers' | 'services';

// Target fields + what each means, per schema (steers the model).
const FIELD_GUIDES: Record<ImportSchema, string> = {
  customers: `
- firstName: customer's given/first name
- lastName: customer's family/last name
- name: full name (only if first/last are NOT separate columns)
- email: email address
- phone: phone / mobile / cell number
- walletAddress: crypto wallet address starting 0x (rare; usually none — do NOT map a street/physical address here)
- tier: loyalty tier (Bronze/Silver/Gold), if present
- externalRef: the source system's own customer id (e.g. "Square Customer ID", "Reference ID")
- marketingEmailConsent: email subscription / opt-in status column
- lifetimeSpendUsd: total MONEY spent (currency amount) — NOT loyalty points/rewards
- firstVisitAt: date of first visit / first transaction
- lastVisitAt: date of last visit / most recent transaction
- visitCount: number of visits / transactions
- referralCode, referredBy, active, lifetimeEarnings: only if clearly present`,
  services: `
- serviceName: the service/item name (e.g. "Item Name", "Service")
- description: description / details
- priceUsd: price (a currency amount)
- durationMinutes: duration in minutes, if present
- category: service/item category (free text — it will be normalized; unknown values become "other")
- imageUrl: an image/photo URL, if present
- tags: comma-separated tags/keywords
- active: whether the service is active/enabled / available online`,
};

const SCHEMA_NOUN: Record<ImportSchema, string> = { customers: 'customer-list', services: 'service/catalog' };

function systemPrompt(schema: ImportSchema): string {
  return (
    `You map columns from a ${SCHEMA_NOUN[schema]} export (from POS/CRM software like Square, Vagaro, ` +
    'Mindbody, or a spreadsheet) to a fixed set of target fields. You are given the source HEADERS and a ' +
    'few SAMPLE rows. Return STRICT JSON only — an object whose keys are target field names and whose ' +
    'values are the EXACT source header string that best matches (copy it verbatim from the provided ' +
    'headers). Omit a field entirely if no column matches. Use ONLY headers from the provided list — ' +
    'never invent one. ' +
    (schema === 'customers' ? 'Never map a street/physical address to walletAddress. Prefer splitting first/last name over a single "name" when both exist. ' : '') +
    'Target fields:\n' + FIELD_GUIDES[schema] +
    '\nOutput shape: {"mapping": {"<field>": "<source header>"}, "notes": "<one short sentence>"}. JSON only.'
  );
}

export interface MappingSuggestion {
  mapping: Record<string, string>; // ourField -> source header (validated to exist)
  unmapped: string[];              // source headers not used by any field
  notes?: string;
  costUsd: number;
}

/** Generic AI column-mapper for file imports (customers OR services). One Haiku call, spend-capped,
 *  validated against the real headers. Used by both domains' import flows. */
export class ImportMappingService {
  constructor(
    private readonly schema: ImportSchema,
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer()
  ) {}

  async suggestMapping(
    headers: string[],
    samples: Record<string, string>[],
    shopId?: string | null
  ): Promise<MappingSuggestion> {
    if (!headers.length) return { mapping: {}, unmapped: [], costUsd: 0 };

    if (shopId) {
      const spend = await this.spendCap.canSpend(shopId);
      if (!spend.allowed) {
        throw Object.assign(new Error('Monthly AI budget exhausted. Try again next month.'), { status: 429 });
      }
    }

    const userMsg =
      `HEADERS: ${JSON.stringify(headers)}\n\n` +
      `SAMPLE ROWS (up to 5):\n${JSON.stringify(samples.slice(0, 5), null, 2)}\n\n` +
      `Return the JSON mapping.`;

    let resp;
    try {
      resp = await this.anthropic.complete({
        systemPrompt: [{ text: systemPrompt(this.schema), cache: true }],
        messages: [{ role: 'user', content: userMsg }],
        model: MODEL,
        maxTokens: 700,
      });
    } catch (err) {
      logger.error('ImportMappingService.suggestMapping LLM call failed', { schema: this.schema, err });
      throw Object.assign(new Error("Couldn't suggest a mapping right now. Map the columns manually or try again."), { status: 503 });
    }

    if (shopId) await this.spendCap.recordSpend(shopId, resp.costUsd).catch(() => {});

    const { mapping, notes } = parseAndValidate(resp.text, headers);
    const used = new Set(Object.values(mapping).map((h) => h.toLowerCase()));
    const unmapped = headers.filter((h) => !used.has(h.trim().toLowerCase()));
    return { mapping, unmapped, notes, costUsd: resp.costUsd };
  }
}

/** Extract the JSON object from the model output (tolerates code fences / prose) and keep only
 *  entries whose value is an actual header in the file. */
function parseAndValidate(text: string, headers: string[]): { mapping: Record<string, string>; notes?: string } {
  const headerByLower = new Map(headers.map((h) => [h.trim().toLowerCase(), h.trim()]));
  let obj: any = {};
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) obj = JSON.parse(text.slice(start, end + 1));
  } catch { /* fall through to empty */ }

  const rawMapping = (obj && typeof obj === 'object' && obj.mapping && typeof obj.mapping === 'object') ? obj.mapping : {};
  const mapping: Record<string, string> = {};
  for (const [field, srcHeader] of Object.entries(rawMapping)) {
    if (typeof srcHeader !== 'string') continue;
    const actual = headerByLower.get(srcHeader.trim().toLowerCase());
    if (actual) mapping[field] = actual; // validated — drop hallucinated headers
  }
  const notes = typeof obj?.notes === 'string' ? obj.notes.slice(0, 280) : undefined;
  return { mapping, notes };
}

export const customerImportMappingService = new ImportMappingService('customers');
export const serviceImportMappingService = new ImportMappingService('services');

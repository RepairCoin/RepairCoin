// backend/src/domains/AIAgentDomain/services/HelpCorpusLoader.ts
//
// Reads `docs/help/*.md` once and exposes the concatenated corpus block
// for the How-To Assistant's system prompt. Spec:
//   docs/help/README.md → "Loader contract (locked spec — Phase 1.3)"
//
// Lifecycle: lazy singleton via `getDefaultHelpCorpusLoader()`. The
// loader instantiates on first access and caches the corpus block for
// the lifetime of the process — there is no hot-reload in v1, restart
// the backend to pick up edits. Lazy (vs eager-at-import) keeps tests,
// migrations, and unrelated scripts from crashing on a missing
// `docs/help/` directory.
//
// The loader returns ONLY the corpus block. The system-prompt guardrails
// ("answer ONLY from the corpus", out-of-domain decline copy) belong to
// the controller (Phase 2.3), not here.

import * as fs from "fs";
import * as path from "path";
import { logger } from "../../../utils/logger";

const README_FILENAME = "README.md";
const ARTICLE_SEPARATOR_PREFIX = "--- ARTICLE: ";
const ARTICLE_SEPARATOR_SUFFIX = " ---";

// Size budget per spec. Approximation is intentional — we don't pull in
// a tokenizer dep just for a startup-time budget check. English averages
// ~4 chars/token; a conservative 4 gives us a safe upper bound for the
// warning + hard-limit gates.
const APPROX_CHARS_PER_TOKEN = 4;
const WARN_TOKEN_THRESHOLD = 15_000;
const HARD_TOKEN_LIMIT = 50_000;

export interface CorpusStats {
  articleCount: number;
  byteCount: number;
  approxTokens: number;
  filenames: string[];
}

/**
 * One article's discoverable shape — filename + title (extracted from
 * the first `# heading` line) + raw body. Used by the `/api/ai/help/
 * articles` endpoints so the frontend can render clickable "Related:"
 * citations that expand to the full article inline.
 */
export interface ArticleEntry {
  filename: string;
  title: string;
  body: string;
}

export class HelpCorpusLoader {
  private readonly corpusBlock: string;
  private readonly stats: CorpusStats;
  private readonly articles: ArticleEntry[];

  constructor(corpusDir: string = HelpCorpusLoader.defaultCorpusDir()) {
    const { block, stats, articles } = HelpCorpusLoader.buildFromDir(corpusDir);
    this.corpusBlock = block;
    this.stats = stats;
    this.articles = articles;
  }

  /**
   * Default location of the corpus.
   *
   * The corpus lives at `backend/help/` (alongside `backend/migrations/`
   * and other backend-authored runtime assets). On build, the postbuild
   * step copies it into `backend/dist/help/` so it ships with the
   * compiled JS in the deploy artifact.
   *
   * Path resolution from `backend/(src|dist)/src/domains/AIAgentDomain/
   * services/` walks up 4 segments to reach `backend/(src|dist)/`, then
   * `help/`. The same expression works in both dev (running ts-node
   * from `src/`, so `../../../../help` resolves to `backend/help/`)
   * and production (compiled file inside `dist/src/.../`, so
   * `../../../../help` resolves to `backend/dist/help/`).
   *
   * Override with `HELP_CORPUS_DIR` env var for unusual deploy layouts.
   */
  static defaultCorpusDir(): string {
    if (process.env.HELP_CORPUS_DIR) return process.env.HELP_CORPUS_DIR;
    return path.resolve(__dirname, "../../../..", "help");
  }

  /**
   * Pure builder — separated from the constructor so tests can exercise
   * loading behavior without going through the singleton path.
   */
  static buildFromDir(
    corpusDir: string
  ): { block: string; stats: CorpusStats; articles: ArticleEntry[] } {
    if (!fs.existsSync(corpusDir)) {
      throw new Error(
        `HelpCorpusLoader: corpus directory not found at ${corpusDir}. ` +
          `Set HELP_CORPUS_DIR or ensure docs/help/ exists at the expected path.`
      );
    }

    const entries = fs.readdirSync(corpusDir);
    const articleFiles = entries
      .filter((name) => name.endsWith(".md") && name !== README_FILENAME)
      .sort(); // alphabetical = cache stability

    if (articleFiles.length === 0) {
      throw new Error(
        `HelpCorpusLoader: no corpus articles found in ${corpusDir}. ` +
          `The How-To Assistant cannot operate with an empty corpus.`
      );
    }

    const parts: string[] = [];
    const loaded: string[] = [];
    const articles: ArticleEntry[] = [];
    for (const filename of articleFiles) {
      const filePath = path.join(corpusDir, filename);
      try {
        const body = fs.readFileSync(filePath, "utf-8").trim();
        parts.push(
          `${ARTICLE_SEPARATOR_PREFIX}${filename}${ARTICLE_SEPARATOR_SUFFIX}\n\n${body}\n`
        );
        loaded.push(filename);
        articles.push({
          filename,
          title: extractTitle(body, filename),
          body,
        });
      } catch (err) {
        // Skip-and-log per spec — one bad file shouldn't take the
        // endpoint down. Loud log so it gets noticed.
        logger.error("HelpCorpusLoader: skipping unreadable article", {
          filename,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (loaded.length === 0) {
      throw new Error(
        `HelpCorpusLoader: every article in ${corpusDir} failed to read. ` +
          `Check filesystem permissions / encoding.`
      );
    }

    const block = parts.join("\n");
    const byteCount = Buffer.byteLength(block, "utf-8");
    const approxTokens = Math.ceil(block.length / APPROX_CHARS_PER_TOKEN);
    const stats: CorpusStats = {
      articleCount: loaded.length,
      byteCount,
      approxTokens,
      filenames: loaded,
    };

    if (approxTokens > HARD_TOKEN_LIMIT) {
      throw new Error(
        `HelpCorpusLoader: corpus is ~${approxTokens} tokens, exceeds hard ` +
          `limit of ${HARD_TOKEN_LIMIT}. Trim articles before deploying.`
      );
    }
    if (approxTokens > WARN_TOKEN_THRESHOLD) {
      logger.warn(
        `HelpCorpusLoader: corpus size ~${approxTokens} tokens is above ` +
          `the soft warning threshold of ${WARN_TOKEN_THRESHOLD}. ` +
          `Consider trimming articles.`,
        stats
      );
    }

    logger.info("HelpCorpusLoader: loaded help corpus", stats);

    return { block, stats, articles };
  }

  /**
   * The concatenated corpus block, ready to drop into a system prompt.
   * The controller is responsible for wrapping this with guardrail text.
   */
  getCorpusBlock(): string {
    return this.corpusBlock;
  }

  /** Startup-log / debugging shape. */
  getCorpusStats(): CorpusStats {
    return this.stats;
  }

  /**
   * Index of every article: filename + extracted title + raw body.
   * Used by the `/api/ai/help/articles` endpoints for the clickable
   * "Related:" expansion UX. Returns a fresh array (callers can't
   * mutate the cached internal state).
   */
  getArticleIndex(): ArticleEntry[] {
    return [...this.articles];
  }

  /**
   * Look up one article body by filename. Returns null if no article
   * matches — important guard against path traversal: a request that
   * isn't in the loaded set won't return anything regardless of what
   * `..` tricks the filename string contains.
   */
  getArticleBody(filename: string): ArticleEntry | null {
    return this.articles.find((a) => a.filename === filename) ?? null;
  }
}

/**
 * Extract the article's display title from its body. We require the
 * first non-empty line to be a `# Heading`. Falls back to the filename
 * (without `.md`) if the article doesn't follow the template.
 */
function extractTitle(body: string, filename: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const m = trimmed.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1];
    break;
  }
  return filename.replace(/\.md$/, "");
}

// Lazy singleton — instantiated on first access by the help-assistant
// controller. Importing this file does NOT trigger corpus load, so unit
// tests or scripts that import the AIAgentDomain don't crash on a
// missing docs/help/ directory.
let _defaultLoader: HelpCorpusLoader | null = null;
export function getDefaultHelpCorpusLoader(): HelpCorpusLoader {
  if (!_defaultLoader) _defaultLoader = new HelpCorpusLoader();
  return _defaultLoader;
}

/** Reset the cached singleton — test-only helper. */
export function __resetDefaultHelpCorpusLoaderForTests(): void {
  _defaultLoader = null;
}

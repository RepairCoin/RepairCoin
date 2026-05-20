// backend/src/domains/AIAgentDomain/controllers/HelpArticleController.ts
//
// GET /api/ai/help/articles            → list (filename + title for every article)
// GET /api/ai/help/articles/:filename  → one article (filename + title + body)
//
// Used by the help panel's "Related:" expansion UX: the frontend
// resolves the article titles Claude cited back to filenames via the
// list endpoint, then fetches the body on click.
//
// Path-traversal-safe: filename lookups go through the loader's
// in-memory article set. A request that doesn't match a loaded
// filename returns 404 regardless of any `..` tricks in the string.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import {
  HelpCorpusLoader,
  getDefaultHelpCorpusLoader,
} from "../services/HelpCorpusLoader";

export interface HelpArticleControllerDeps {
  corpusLoader?: HelpCorpusLoader;
}

export function makeHelpArticleController(
  deps: HelpArticleControllerDeps = {}
) {
  // Lazy default — same pattern as HelpAssistantController: deferring
  // construction avoids crashing unrelated imports if docs/help/
  // happens to be unavailable in a test/migration script context.
  let corpusLoader = deps.corpusLoader ?? null;
  const getLoader = (): HelpCorpusLoader => {
    if (!corpusLoader) corpusLoader = getDefaultHelpCorpusLoader();
    return corpusLoader;
  };

  return {
    /** Index of every article — filename + title only. Cheap to call
        on every help-panel mount; no bodies sent here so the payload
        stays small even when the corpus grows. */
    listArticles: async (_req: Request, res: Response): Promise<void> => {
      try {
        const index = getLoader().getArticleIndex().map((a) => ({
          filename: a.filename,
          title: a.title,
        }));
        res.json({ success: true, data: index });
      } catch (err) {
        logger.error("HelpArticleController.listArticles failed", err);
        res.status(500).json({
          success: false,
          error: "Failed to load help articles",
        });
      }
    },

    /** One article's body, looked up by filename. 404 if not found —
        this is also the path-traversal guard: any filename that isn't
        in the loaded set returns nothing. */
    getArticle: async (req: Request, res: Response): Promise<void> => {
      try {
        const filename = req.params?.filename;
        if (!filename || typeof filename !== "string") {
          res.status(400).json({
            success: false,
            error: "filename param required",
          });
          return;
        }
        const article = getLoader().getArticleBody(filename);
        if (!article) {
          res.status(404).json({
            success: false,
            error: "Article not found",
          });
          return;
        }
        res.json({
          success: true,
          data: {
            filename: article.filename,
            title: article.title,
            body: article.body,
          },
        });
      } catch (err) {
        logger.error("HelpArticleController.getArticle failed", err);
        res.status(500).json({
          success: false,
          error: "Failed to load help article",
        });
      }
    },
  };
}

// Lazy default singleton.
let _defaultController: ReturnType<typeof makeHelpArticleController> | null =
  null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeHelpArticleController();
  }
  return _defaultController;
}

export function listHelpArticles(req: Request, res: Response): Promise<void> {
  return getDefaults().listArticles(req, res);
}

export function getHelpArticle(req: Request, res: Response): Promise<void> {
  return getDefaults().getArticle(req, res);
}

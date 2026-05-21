// backend/tests/ai-agent/HelpArticleController.test.ts
//
// Covers the index + per-article endpoints used by the help panel's
// "Related:" expansion UX:
//   - listArticles strips bodies from the response payload
//   - getArticle returns the requested article
//   - getArticle 404s on unknown filenames (path-traversal guard)
//   - getArticle 400s when the filename param is missing
//   - 500 on loader failure
//
// Real filesystem reads are not exercised — the corpus loader is
// injected as a mock via the factory.

import { makeHelpArticleController } from "../../src/domains/AIAgentDomain/controllers/HelpArticleController";
import { ArticleEntry } from "../../src/domains/AIAgentDomain/services/HelpCorpusLoader";

// ----- Test doubles -----

const makeReq = (opts: { params?: any } = {}) =>
  ({ params: opts.params ?? {} } as any);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const fakeArticles: ArticleEntry[] = [
  {
    filename: "create-a-service.md",
    title: "How do I create a service?",
    body: "# How do I create a service?\n\nBody text 1.",
  },
  {
    filename: "issue-a-reward.md",
    title: "How do I issue an RCN reward to a customer?",
    body: "# How do I issue an RCN reward to a customer?\n\nBody text 2.",
  },
];

const makeLoader = (articles: ArticleEntry[] = fakeArticles): any => ({
  getArticleIndex: jest.fn().mockReturnValue(articles),
  getArticleBody: jest.fn().mockImplementation((filename: string) => {
    return articles.find((a) => a.filename === filename) ?? null;
  }),
  // Unused by this controller — stubbed so the type satisfies the interface.
  getCorpusBlock: () => "",
  getCorpusStats: () => ({
    articleCount: articles.length,
    byteCount: 0,
    approxTokens: 0,
    filenames: articles.map((a) => a.filename),
  }),
});

// ----- listArticles -----

describe("HelpArticleController.listArticles", () => {
  it("returns each article's filename + title (NO body in the payload)", async () => {
    const controller = makeHelpArticleController({
      corpusLoader: makeLoader(),
    });
    const res = makeRes();
    await controller.listArticles(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          filename: "create-a-service.md",
          title: "How do I create a service?",
        },
        {
          filename: "issue-a-reward.md",
          title: "How do I issue an RCN reward to a customer?",
        },
      ],
    });

    // Explicit guard: a `body` field would inflate the index payload
    // unnecessarily and leak the full corpus on every panel mount.
    const sentData = (res.json as jest.Mock).mock.calls[0][0].data;
    for (const entry of sentData) {
      expect(entry).not.toHaveProperty("body");
    }
  });

  it("returns 500 + does not throw when the loader fails", async () => {
    const loader: any = {
      getArticleIndex: jest.fn().mockImplementation(() => {
        throw new Error("loader broken");
      }),
      getArticleBody: jest.fn(),
      getCorpusBlock: () => "",
      getCorpusStats: () => ({
        articleCount: 0,
        byteCount: 0,
        approxTokens: 0,
        filenames: [],
      }),
    };
    const controller = makeHelpArticleController({ corpusLoader: loader });
    const res = makeRes();
    await controller.listArticles(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ----- getArticle -----

describe("HelpArticleController.getArticle", () => {
  it("returns the article when filename matches a loaded entry", async () => {
    const controller = makeHelpArticleController({
      corpusLoader: makeLoader(),
    });
    const res = makeRes();
    await controller.getArticle(
      makeReq({ params: { filename: "create-a-service.md" } }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        filename: "create-a-service.md",
        title: "How do I create a service?",
        body: "# How do I create a service?\n\nBody text 1.",
      },
    });
  });

  it("returns 400 when the filename param is missing", async () => {
    const controller = makeHelpArticleController({
      corpusLoader: makeLoader(),
    });
    const res = makeRes();
    await controller.getArticle(makeReq({ params: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when the filename is not in the loaded corpus", async () => {
    const controller = makeHelpArticleController({
      corpusLoader: makeLoader(),
    });
    const res = makeRes();
    await controller.getArticle(
      makeReq({ params: { filename: "does-not-exist.md" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects path-traversal attempts with 404 (in-memory filename set is the guard)", async () => {
    const controller = makeHelpArticleController({
      corpusLoader: makeLoader(),
    });
    // These all resolve to files that exist on disk somewhere on the
    // server, but NONE of them are in the loaded corpus — so the
    // in-memory lookup returns null and the handler 404s. The
    // controller never touches the filesystem with the supplied
    // string; this is the structural guarantee against ../ tricks.
    const traversalAttempts = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\config\\SAM",
      "/etc/passwd",
      "create-a-service.md/../../../etc/passwd",
    ];
    for (const attempt of traversalAttempts) {
      const res = makeRes();
      await controller.getArticle(
        makeReq({ params: { filename: attempt } }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });

  it("returns 500 + does not throw when the loader fails", async () => {
    const loader: any = {
      getArticleIndex: jest.fn(),
      getArticleBody: jest.fn().mockImplementation(() => {
        throw new Error("loader broken");
      }),
      getCorpusBlock: () => "",
      getCorpusStats: () => ({
        articleCount: 0,
        byteCount: 0,
        approxTokens: 0,
        filenames: [],
      }),
    };
    const controller = makeHelpArticleController({ corpusLoader: loader });
    const res = makeRes();
    await controller.getArticle(
      makeReq({ params: { filename: "create-a-service.md" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

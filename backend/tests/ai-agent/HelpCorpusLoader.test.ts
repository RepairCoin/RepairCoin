// backend/tests/ai-agent/HelpCorpusLoader.test.ts
//
// Tests `HelpCorpusLoader.buildFromDir` against tmp-dir corpora —
// file discovery rules (`README.md` excluded), alphabetical order,
// separator format, hard-error vs skip-and-log paths, size budgets.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { HelpCorpusLoader } from "../../src/domains/AIAgentDomain/services/HelpCorpusLoader";

const makeTempCorpus = (files: Record<string, string>): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "help-corpus-test-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, "utf-8");
  }
  return dir;
};

const cleanup = (dir: string) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

describe("HelpCorpusLoader.buildFromDir", () => {
  it("reads all .md files alphabetically by filename", () => {
    const dir = makeTempCorpus({
      "z.md": "Zee body",
      "a.md": "Alpha body",
      "m.md": "Mike body",
    });
    try {
      const { stats, block } = HelpCorpusLoader.buildFromDir(dir);
      expect(stats.filenames).toEqual(["a.md", "m.md", "z.md"]);
      expect(block.indexOf("Alpha body")).toBeLessThan(block.indexOf("Mike body"));
      expect(block.indexOf("Mike body")).toBeLessThan(block.indexOf("Zee body"));
    } finally {
      cleanup(dir);
    }
  });

  it("excludes README.md from the corpus", () => {
    const dir = makeTempCorpus({
      "README.md": "engineering notes — should NOT be in corpus",
      "article.md": "real article body",
    });
    try {
      const { stats, block } = HelpCorpusLoader.buildFromDir(dir);
      expect(stats.filenames).toEqual(["article.md"]);
      expect(block).toContain("real article body");
      expect(block).not.toContain("engineering notes");
    } finally {
      cleanup(dir);
    }
  });

  it("ignores non-.md files", () => {
    const dir = makeTempCorpus({
      "article.md": "in corpus",
      "scratch.txt": "should be ignored",
      "image.png": "binary-ish",
    });
    try {
      const { stats, block } = HelpCorpusLoader.buildFromDir(dir);
      expect(stats.filenames).toEqual(["article.md"]);
      expect(block).not.toContain("should be ignored");
    } finally {
      cleanup(dir);
    }
  });

  it("prefixes each article with --- ARTICLE: <filename> --- separator", () => {
    const dir = makeTempCorpus({
      "first.md": "first body",
      "second.md": "second body",
    });
    try {
      const { block } = HelpCorpusLoader.buildFromDir(dir);
      expect(block).toContain("--- ARTICLE: first.md ---");
      expect(block).toContain("--- ARTICLE: second.md ---");
      // Separator comes BEFORE the body of each article.
      expect(block.indexOf("--- ARTICLE: first.md ---")).toBeLessThan(
        block.indexOf("first body")
      );
    } finally {
      cleanup(dir);
    }
  });

  it("throws when the corpus directory does not exist", () => {
    expect(() =>
      HelpCorpusLoader.buildFromDir("/definitely/not/a/real/path/xyz")
    ).toThrow(/not found/i);
  });

  it("throws when the directory has no .md files (only README)", () => {
    const dir = makeTempCorpus({ "README.md": "just the readme" });
    try {
      expect(() => HelpCorpusLoader.buildFromDir(dir)).toThrow(
        /no corpus articles/i
      );
    } finally {
      cleanup(dir);
    }
  });

  it("throws when the corpus exceeds the hard token limit", () => {
    // ~4 chars/token. 50K tokens → 200K chars. 250K chars guarantees
    // the hard limit triggers.
    const dir = makeTempCorpus({ "huge.md": "x".repeat(250_000) });
    try {
      expect(() => HelpCorpusLoader.buildFromDir(dir)).toThrow(
        /exceeds hard limit/i
      );
    } finally {
      cleanup(dir);
    }
  });

  it("returns accurate stats (article count, bytes, approx tokens)", () => {
    const dir = makeTempCorpus({
      "a.md": "x".repeat(40),
      "b.md": "x".repeat(40),
    });
    try {
      const { stats } = HelpCorpusLoader.buildFromDir(dir);
      expect(stats.articleCount).toBe(2);
      expect(stats.byteCount).toBeGreaterThan(80); // bodies plus separators
      expect(stats.approxTokens).toBeGreaterThan(0);
      expect(stats.filenames).toEqual(["a.md", "b.md"]);
    } finally {
      cleanup(dir);
    }
  });
});

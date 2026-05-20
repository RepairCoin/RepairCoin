// backend/tests/ai-agent/HelpPromptBuilder.test.ts
//
// Structural checks on the system prompt — guardrails, citation
// instruction, support fallback copy, ordering (rules above articles).
// Verifying the *content* of model replies is Phase 4.2 manual QA,
// but the prompt's shape is testable here.

import {
  buildHelpSystemPrompt,
  SUPPORT_FALLBACK_COPY,
} from "../../src/domains/AIAgentDomain/services/HelpPromptBuilder";

describe("buildHelpSystemPrompt", () => {
  const fakeCorpus = "--- ARTICLE: example.md ---\n\n# How do I X?\nBody.\n";

  it("includes the provided corpus block verbatim", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toContain(fakeCorpus);
  });

  it("contains the exact SUPPORT_FALLBACK_COPY decline string", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toContain(SUPPORT_FALLBACK_COPY);
  });

  it("places the rules ABOVE the articles section", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    const rulesIdx = prompt.indexOf("Hard rules");
    const articlesIdx = prompt.indexOf("Help articles");
    expect(rulesIdx).toBeGreaterThan(-1);
    expect(articlesIdx).toBeGreaterThan(-1);
    expect(rulesIdx).toBeLessThan(articlesIdx);
  });

  it("places the corpus block AFTER the articles section header", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    const articlesIdx = prompt.indexOf("Help articles");
    const corpusIdx = prompt.indexOf(fakeCorpus);
    expect(corpusIdx).toBeGreaterThan(articlesIdx);
  });

  it("instructs the model to end with a *Related:* footer using the article TITLE (not filename)", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    // The example citation in the prompt uses an article title.
    expect(prompt).toMatch(/\*Related:[^*]+\*/);
    // Negative — must NOT instruct filename citation.
    expect(prompt).not.toMatch(/\*\(from\s+`<filename>`\)\*/);
    // Positive — must explicitly say titles, not filenames.
    expect(prompt.toLowerCase()).toContain("title");
    expect(prompt.toLowerCase()).toContain("never filenames");
  });

  it("instructs the model to decline business-data questions", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toMatch(/business-data questions/i);
  });

  it("instructs the model to refuse acting on the user's behalf", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toMatch(/actions on the user/i);
  });

  it("instructs the model to ask a clarifying question on ambiguity", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toMatch(/ambiguous/i);
    expect(prompt).toMatch(/clarifying question/i);
  });

  it("references the --- ARTICLE: separator so the model can cite by filename", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toContain("--- ARTICLE:");
  });

  it("acknowledges the audience is shop owners (not customers)", () => {
    const prompt = buildHelpSystemPrompt(fakeCorpus);
    expect(prompt).toMatch(/shop owners/i);
  });
});

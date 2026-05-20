# Help corpus

This folder is the source of truth for the **shop-owner-facing How-To
Assistant** — an in-dashboard AI that answers *"how do I do X?"* using
**only** the markdown articles in this folder. Nothing in `docs/help/`
is customer-facing; this is shop-side product help.

For the *why* behind the feature, see
[`docs/tasks/strategy/how-to-assistant/how-to-assistant-scope.md`](../tasks/strategy/how-to-assistant/how-to-assistant-scope.md).

---

## The corpus contract

1. **One topic per file.** Filename uses kebab-case and matches the
   topic (`create-a-service.md`, `set-appointment-hours.md`, etc.). The
   filename without the extension is the article's stable identifier —
   don't rename casually.

2. **Articles must stay current with the UI.** Out-of-date instructions
   are worse than no instructions because the assistant repeats them
   confidently. Two enforcement mechanisms:
   - **PR Definition-of-Done:** any PR that changes a shop-facing flow
     (a tab, a form, a button label, a setting) MUST update the
     matching help article(s) in the same PR. Treat this as part of
     the change, not an afterthought.
   - **Periodic audit:** a named owner (product or support lead) does a
     quarterly accuracy pass against the live UI.

3. **Authoring style — short, scannable, accurate.**
   - Lead with what the article answers (one sentence under the title).
   - Numbered steps for procedures. Each step references a real visible
     UI element ("click the **AI Assistant** tab" — not "go to the AI
     settings somewhere").
   - Use exact label text in **bold**. If the label changes, the
     article must change too (see rule 2).
   - Keep articles **under ~300 words** when possible. The assistant
     prompt-stuffs the entire corpus on every call; bloat costs money
     and dilutes attention.

4. **Don't write about things the assistant shouldn't answer.** The
   assistant declines questions outside the corpus on purpose. If a
   topic isn't covered here, the user gets routed to support — that's
   safer than the assistant hallucinating UI that doesn't exist.

5. **No business-data answers in articles.** Articles explain *how to
   use the software*. They never reference specific shops, customers,
   numbers, or anything that depends on the live database. Business-
   data Q&A is a separate, larger feature (see scope doc).

---

## Article template

Use this shape for every article so the assistant's grounding is
predictable:

```markdown
# <Title — the user's question phrased plainly>

<One-sentence answer / summary.>

## When to do this

<Optional: a sentence on the situation that prompts this task.>

## Steps

1. <First action with exact UI label in bold.>
2. <Second action…>
3. <…>

## Common pitfalls

- <Optional: one to three gotchas with how to avoid them.>

## See also

- <Optional: links to related articles in this folder.>
```

The `# Title` is what the assistant cites when it answers. Keep it
specific enough that a shop owner reading the citation knows they're
in the right place.

---

## How the assistant consumes the corpus

(Internal note for engineers — Phase 2 of the How-To Assistant build.)

### Loader contract (locked spec — Phase 1.3, 2026-05-20)

The `HelpCorpusLoader` service (lands in Phase 2.1) follows this spec
exactly. Don't deviate without amending this section first — the
delimiter shape is part of the citation contract the assistant relies
on.

**File discovery**
- Read every `*.md` file in `docs/help/` **except `README.md`**.
- `README.md` is engineer-facing — never part of the corpus.
- Anything else in this folder that ends in `.md` IS corpus content.

**Read order**
- Alphabetical by filename. Deterministic order is what makes the
  Anthropic prompt cache hit consistently — randomizing or shuffling
  would defeat caching.

**Concatenation format**
- Each article is preceded by a separator line of the exact form:
  ```
  --- ARTICLE: <filename> ---
  ```
- Article body follows verbatim (no munging beyond UTF-8 read).
- One blank line between the separator and the body, one blank line
  between the previous article's body and the next separator.
- Example block:
  ```
  --- ARTICLE: create-a-service.md ---

  # How do I create a service?
  ...article body...

  --- ARTICLE: issue-a-reward.md ---

  # How do I issue an RCN reward to a customer?
  ...article body...
  ```

**Loader return shape**
- `getCorpusBlock(): string` — the concatenated block, ready to drop
  into a system prompt. The loader returns ONLY the corpus block.
- Wrapping guardrail text (the "answer ONLY from the corpus" prompt,
  the out-of-domain decline copy) is the controller's responsibility
  in Phase 2.3, NOT the loader's.
- Recommended companion: `getCorpusStats(): { articleCount, byteCount,
  filenames: string[] }` — startup logs print these so the team can
  see what's loaded.

**Anthropic prompt caching**
- The corpus block is identical for every call (no per-shop
  personalization in v1) — perfect cache shape.
- The controller (Phase 2.3) injects the block into the system prompt
  with `cache_control: { type: "ephemeral" }` so Anthropic caches it.
  Warmup cost = one full read; subsequent calls hit the cache and pay
  10% of the input-token rate for that block.

**Refresh model**
- Read once at module-load. **No hot-reload in v1.**
- To pick up new articles or edits: restart the backend (in dev
  `npm run dev` does this on save; in prod the next deploy does it).

**Citation contract**
- The `--- ARTICLE: <filename> ---` separator is what lets Claude cite
  the source file in answers ("From `create-a-service.md`: …").
- The Phase 2.3 system prompt tells the model to cite the article it
  quoted from using this exact form, so a shop owner reading a reply
  can trace it back to a specific file in this folder.

**Size budget**
- Soft target: **< 20K tokens total**. With 8 starter articles at ~400
  tokens each, we're around 3K tokens — plenty of headroom for the
  corpus to grow to ~50 articles before we worry.
- Loader logs a WARNING if the corpus exceeds 15K tokens at startup.
- Loader **refuses to start** if the corpus exceeds 50K tokens —
  forces someone to look before runaway bloat hits prompt limits.

**Error handling**
- Missing `docs/help/` directory → log error and refuse to start.
- Zero `*.md` files (excluding README) → log error and refuse to
  start. A working corpus is a hard requirement for the endpoint.
- Any individual file unreadable → log the filename + reason, skip it,
  continue loading the rest. Best-effort so one bad file doesn't take
  the whole endpoint down.

---

## Out of scope for this folder

- Customer-facing help (lives elsewhere when it exists).
- Admin-only operations (admin audience is a fast-follow after the
  shop-side v1 ships).
- Anything that requires live business-data lookup.

---

## Ownership

`docs/help/` is owned collectively via the PR Definition-of-Done rule
above, plus a named owner for periodic audits. The owner is recorded in
the team's project tracker, not in this README, so it stays current as
people change roles.

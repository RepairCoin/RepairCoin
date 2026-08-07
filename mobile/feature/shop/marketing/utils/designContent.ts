import { MarketingTemplate } from "../services/marketing.interface";

// Pure block transforms for the mobile composer — no React, no I/O. Mirrors the shape
// backend/src/services/MarketingService.ts (renderBlock) and
// frontend/src/components/shop/marketing/CampaignBuilderModal.tsx (defaultBlocks.custom +
// buildDesignContent) expect, so mobile-authored campaigns open cleanly in web's builder.

export type DesignBlockType =
  | "headline"
  | "text"
  | "button"
  | "image"
  | "coupon"
  | "service_card"
  | "divider"
  | "spacer";

export interface DesignBlock {
  id: string;
  type: DesignBlockType;
  content?: string;
  style?: Record<string, string>;
  src?: string;
  href?: string;
  url?: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number;
  serviceImage?: string;
  [key: string]: unknown;
}

export interface DesignContent {
  header?: { enabled?: boolean; showLogo?: boolean; backgroundColor?: string };
  blocks: DesignBlock[];
  footer?: { showSocial?: boolean; showUnsubscribe?: boolean };
  [key: string]: unknown;
}

/** Only these block types are rendered as FormInputs; everything else is a locked chip. */
const EDITABLE_TYPES: DesignBlockType[] = ["headline", "text", "button"];

// Web's `text` blocks are authored with a TipTap rich-text editor and can carry markup beyond
// <p>/<br> (bold, lists, links, ...). Mobile has no rich-text editor, so a block whose markup goes
// beyond that is shown read-only ("Formatted on web") rather than risk mangling it on save.
function hasRichMarkup(html: string): boolean {
  const stripped = html.replace(/<\/?(p|br)\s*\/?>/gi, "");
  return /<[a-z][\s\S]*>/i.test(stripped);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** For display: decode entities and turn <br>/paragraph breaks back into \n. */
export function htmlToPlainText(html: string | undefined | null): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "");
  return unescapeHtml(withBreaks);
}

/** For save: escape first so raw `&`/`<`/`>` survive renderBlock's UNESCAPED interpolation as
 *  literal text, then turn \n into <br> — matches renderBlock's own `<p>${content}</p>` wrapper,
 *  so this must NOT add its own <p> tags. */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

export function isMobileEditable(block: DesignBlock): boolean {
  if (!EDITABLE_TYPES.includes(block.type)) return false;
  if (block.type === "text") return !hasRichMarkup(block.content ?? "");
  return true;
}

/** Mirrors web's `defaultBlocks.custom` + the header/footer wrapper from `buildDesignContent`. */
export function blankDesignContent(): DesignContent {
  const now = Date.now();
  return {
    header: { enabled: true, showLogo: true, backgroundColor: "#1a1a2e" },
    blocks: [
      {
        id: `default-${now}-0`,
        type: "headline",
        content: "Your Message Here",
        style: { fontSize: "24px", textAlign: "center", color: "#111827" },
      },
      {
        id: `default-${now}-1`,
        type: "text",
        content: "Add your custom message content...",
        style: { color: "#666666", fontSize: "14px" },
      },
    ],
    footer: { showSocial: true, showUnsubscribe: true },
  };
}

/** Clone a template's blocks with fresh ids so editing a campaign started from a template never
 *  collides with the template's own block ids (mirrors web's `template-${Date.now()}-${index}`). */
export function fromTemplate(template: Pick<MarketingTemplate, "designContent">): DesignContent {
  const source = (template.designContent || {}) as Partial<DesignContent>;
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  const now = Date.now();

  return {
    header: source.header ?? { enabled: true, showLogo: true, backgroundColor: "#1a1a2e" },
    blocks: blocks.map((block, index) => ({ ...block, id: `template-${now}-${index}` })),
    footer: source.footer ?? { showSocial: true, showUnsubscribe: true },
  };
}

export interface EditableField {
  index: number;
  type: "headline" | "text" | "button";
  value: string;
}

/** Index-keyed so `applyEdits` can write back without ever add/remove/reordering blocks. */
export function toEditableFields(design: DesignContent): EditableField[] {
  return design.blocks.reduce<EditableField[]>((fields, block, index) => {
    if (isMobileEditable(block)) {
      fields.push({
        index,
        type: block.type as "headline" | "text" | "button",
        value: htmlToPlainText(block.content),
      });
    }
    return fields;
  }, []);
}

/** Index-keyed edits (block position → new plain-text value). Non-editable and unedited blocks
 *  come back byte-identical (same object reference); `...design` preserves header/footer/any
 *  unknown top-level keys untouched. */
export function applyEdits(design: DesignContent, edits: Record<number, string>): DesignContent {
  const blocks = design.blocks.map((block, index) => {
    const edit = edits[index];
    if (edit === undefined || !isMobileEditable(block)) return block;
    return { ...block, content: plainTextToHtml(edit) };
  });

  return { ...design, blocks };
}

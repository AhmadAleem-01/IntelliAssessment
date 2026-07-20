/**
 * Tiny allowlist HTML sanitizer for the letter builder's rich-text blocks.
 *
 * The text / heading / signature blocks store HTML produced by a
 * `contentEditable` field (bold, italic, underline, font size, colour,
 * alignment, lists) plus answer-reference chips (`<span class="tok-chip"
 * data-level=…>`). That HTML is both saved to `dnx_letter_template_json` and
 * re-rendered via `dangerouslySetInnerHTML`, so it MUST be sanitized on the way
 * in and out. We hand-roll a strict allowlist rather than pull in a dependency:
 *
 *   - only the tags below survive; everything else is unwrapped (kept text) or
 *     dropped (script/style),
 *   - only the inline style properties below survive; all other attributes are
 *     stripped, EXCEPT the tok-chip span keeps its `class` + `data-level`,
 *   - no event handlers, no `javascript:` URLs (no href/src allowed at all).
 *
 * Sanitizing happens in the browser via DOMParser, so this is client-only —
 * which is fine, both call sites (editor + renderer) run in the browser.
 */

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'SPAN',
  'BR',
  'DIV',
  'P',
  'UL',
  'OL',
  'LI',
]);

// Inline style properties we keep. Values are additionally screened for
// `url(` / `expression(` / javascript to defend against CSS-based injection.
const ALLOWED_STYLE_PROPS = new Set([
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'font-size',
  'color',
  'text-align',
]);

function safeStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) continue;
    // Clamp font-size to a sane range so a pasted `font-size: 900px` can't
    // blow up the letter layout.
    if (prop === 'font-size') {
      const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
      if (px) {
        const n = Math.min(48, Math.max(9, Number(px[1])));
        out.push(`font-size: ${n}px`);
        continue;
      }
    }
    out.push(`${prop}: ${value}`);
  }
  return out.join('; ');
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName;

  // script/style and anything not allowed: drop the element but keep its text
  // children (so stripping <font> etc. doesn't lose the words).
  const dropEntirely = tag === 'SCRIPT' || tag === 'STYLE';

  const cleanChildren = (): Node[] => {
    const kids: Node[] = [];
    el.childNodes.forEach((c) => {
      const cleaned = cleanNode(c, doc);
      if (cleaned) kids.push(cleaned);
    });
    return kids;
  };

  if (dropEntirely) return null;

  if (!ALLOWED_TAGS.has(tag)) {
    // Unwrap: return a fragment of the cleaned children.
    const frag = doc.createDocumentFragment();
    cleanChildren().forEach((k) => frag.appendChild(k));
    return frag;
  }

  const out = doc.createElement(tag.toLowerCase());

  // The answer chip keeps its class + data-level so the renderer can resolve it.
  if (el.classList.contains('tok-chip')) {
    out.setAttribute('class', 'tok-chip');
    const level = el.getAttribute('data-level');
    if (level) out.setAttribute('data-level', level);
  }

  const style = el.getAttribute('style');
  if (style) {
    const safe = safeStyle(style);
    if (safe) out.setAttribute('style', safe);
  }

  cleanChildren().forEach((k) => out.appendChild(k));
  return out;
}

/** Sanitize an HTML string to the allowlist above. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;
  const container = doc.createElement('div');
  body.childNodes.forEach((c) => {
    const cleaned = cleanNode(c, doc);
    if (cleaned) container.appendChild(cleaned);
  });
  return container.innerHTML;
}

/** True when a string looks like it contains HTML markup (has a tag). */
export function looksLikeHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s);
}

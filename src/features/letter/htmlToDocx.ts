/**
 * Convert sanitized letter-block HTML (see `sanitizeHtml.ts`) into `docx`
 * Paragraph/TextRun trees for the Word export.
 *
 * Mirrors the allowlist in `sanitizeHtml.ts` exactly — this only ever receives
 * output from `resolveLetterHtml`, which has already been through that
 * sanitizer, so we don't re-validate here, just map tags/styles we know can
 * occur: B/STRONG → bold, I/EM → italic, U → underline, SPAN inline styles
 * (font-weight/style/text-decoration/font-size/color), BR → line break,
 * DIV/P → paragraph boundaries, UL/OL/LI → bulleted/numbered paragraphs.
 */

import { Paragraph, TextRun, AlignmentType } from 'docx';

/** Accumulated run formatting while walking down the DOM. */
interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  color?: string;
  /** Half-points, per `docx`'s `size` unit (1 pt = 2 half-points). */
  size?: number;
}

const DEFAULT_FONT_SIZE_HALFPT = 22; // 11pt body text, matches the on-screen 13px-ish body copy.

function mergeStyleFromElement(el: HTMLElement, base: RunStyle): RunStyle {
  const tag = el.tagName;
  const next: RunStyle = { ...base };
  if (tag === 'B' || tag === 'STRONG') next.bold = true;
  if (tag === 'I' || tag === 'EM') next.italics = true;
  if (tag === 'U') next.underline = true;

  const style = el.getAttribute('style');
  if (style) {
    for (const decl of style.split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (prop === 'font-weight' && (value === 'bold' || Number(value) >= 600)) next.bold = true;
      if (prop === 'font-style' && value === 'italic') next.italics = true;
      if (prop === 'text-decoration' || prop === 'text-decoration-line') {
        if (value.includes('underline')) next.underline = true;
      }
      if (prop === 'color') {
        const hex = cssColorToHex(value);
        if (hex) next.color = hex;
      }
      if (prop === 'font-size') {
        const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
        if (px) next.size = Math.round(Number(px[1]) * 1.5); // px → half-points (≈ px * 0.75pt * 2)
      }
    }
  }
  return next;
}

/** `rgb(r, g, b)` or `#rrggbb` → `RRGGBB` (docx wants hex without '#'). Returns null for anything else. */
function cssColorToHex(value: string): string | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return hex[1].toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value.trim());
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0'));
    return `${r}${g}${b}`.toUpperCase();
  }
  return null;
}

/**
 * Shared walker: converts one HTML fragment into a flat list of paragraph
 * "lines", each a `TextRun[]`. A DIV/P boundary or a list item starts a new
 * line; everything else (SPAN/B/STRONG/I/EM/U, text, BR) accumulates runs
 * within the current line. Both `htmlToDocxRuns` (single-line callers, e.g.
 * a heading) and `htmlToDocxParagraphs` (multi-line callers) build on this so
 * there's one place that knows the sanitizer's tag/style allowlist.
 */
function htmlToDocxLines(html: string, baseStyle: RunStyle): TextRun[][] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines: TextRun[][] = [];
  let current: TextRun[] = [];

  function flush() {
    if (current.length > 0) {
      lines.push(current);
      current = [];
    }
  }

  function walk(node: Node, style: RunStyle, listPrefix?: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text) return;
      current.push(
        new TextRun({
          text: listPrefix ? listPrefix + text : text,
          bold: style.bold,
          italics: style.italics,
          underline: style.underline ? {} : undefined,
          color: style.color,
          size: style.size,
        }),
      );
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === 'BR') {
      current.push(new TextRun({ text: '', break: 1 }));
      return;
    }
    if (tag === 'DIV' || tag === 'P') {
      flush();
      el.childNodes.forEach((c) => walk(c, style));
      flush();
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      flush();
      let i = 1;
      el.childNodes.forEach((li) => {
        if (li.nodeType === Node.ELEMENT_NODE && (li as HTMLElement).tagName === 'LI') {
          const prefix = tag === 'OL' ? `${i}. ` : '• ';
          i += 1;
          (li as HTMLElement).childNodes.forEach((c) => walk(c, style, prefix));
          flush();
        }
      });
      return;
    }
    // SPAN / B / STRONG / I / EM / U — accumulate style, recurse into children.
    const nextStyle = mergeStyleFromElement(el, style);
    el.childNodes.forEach((c) => walk(c, nextStyle));
  }

  doc.body.childNodes.forEach((n) => walk(n, baseStyle));
  flush();
  return lines;
}

/**
 * Convert one HTML fragment into a single flat list of `TextRun`s (all lines
 * concatenated with a line break between them). For single-line callers like
 * a heading or signature block where the caller wants to build its own
 * `Paragraph` (e.g. with a heading style) rather than get one back.
 */
export function htmlToDocxRuns(html: string, baseSize?: number): TextRun[] {
  const lines = htmlToDocxLines(html, { size: baseSize ?? DEFAULT_FONT_SIZE_HALFPT });
  const runs: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) runs.push(new TextRun({ text: '', break: 1 }));
    runs.push(...line);
  });
  return runs;
}

/**
 * Convert one HTML fragment into a list of `docx` Paragraphs, one per DIV/P/
 * list-item boundary. `align` applies to every paragraph produced.
 */
export function htmlToDocxParagraphs(
  html: string,
  opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; baseSize?: number } = {},
): Paragraph[] {
  const lines = htmlToDocxLines(html, { size: opts.baseSize ?? DEFAULT_FONT_SIZE_HALFPT });
  if (lines.length === 0) return [new Paragraph({ children: [] })];
  return lines.map((runs) => new Paragraph({ children: runs, alignment: opts.align }));
}

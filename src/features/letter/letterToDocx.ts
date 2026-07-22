/**
 * Build a real Word (.docx) document from the same data `LetterPreview`
 * renders on screen. Walks the letter's blocks exactly like
 * `LetterPreview`'s render switch, consuming the shared `LetterData` (see
 * `letterData.ts`) so the two outputs can never disagree on WHAT the letter
 * contains — only on how each medium presents it.
 *
 * Rich-text blocks (heading / text / signature) go through
 * `resolveLetterHtml` (same token/placeholder resolution as the screen
 * renderer) and then `htmlToDocxParagraphs`, which maps the sanitizer's
 * allowlisted tags/styles onto `docx` runs.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  ImageRun,
} from 'docx';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Criteria } from '../rules/types';
import { buildLetterData, buildGroupedSubsections, type CollectedQuestion } from './letterData';
import {
  DEFAULT_LAYOUT,
  META_FIELD_LABEL,
  resolveLetterHtml,
  type LetterLayout,
} from './letterLayout';
import { sanitizeHtml } from './sanitizeHtml';
import { htmlToDocxParagraphs, htmlToDocxRuns } from './htmlToDocx';

const OUTCOME_COLOR = { pass: '3E6313', fail: '962A29', pending: '666666' } as const;
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { after: 120 } });
}

function labelValueRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
      }),
    ],
  });
}

function questionRows(questions: CollectedQuestion[]): TableRow[] {
  return questions.map((q) => labelValueRow(q.label, q.answer || '—'));
}

/** Build the ordered list of docx block-level children for the whole letter. */
export function buildLetterDocxChildren(
  assessment: Dnx_assessment_instances,
  levels: Dnx_assessment_levels[],
  responses: Dnx_assessment_responses[],
  criteriaByLevelId: Map<string, Criteria> | undefined,
  layout: LetterLayout | undefined,
): (Paragraph | Table)[] {
  const data = buildLetterData(assessment, levels, responses, criteriaByLevelId);
  const blocks = (layout ?? DEFAULT_LAYOUT).blocks;
  // A custom page header becomes a repeating docx page header (see
  // buildLetterDocxBlob), so we drop the inline brand strip when one is set.
  const children: (Paragraph | Table)[] = layout?.page?.header
    ? []
    : [
        new Paragraph({
          children: [
            new TextRun({ text: 'IntelliAssessment', bold: true, size: 18, color: '7F77DD' }),
          ],
          spacing: { after: 80 },
        }),
      ];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const html = resolveLetterHtml(block.text, data.values, data.answerByLevelId, sanitizeHtml);
        const align =
          block.align === 'center'
            ? AlignmentType.CENTER
            : block.align === 'right'
              ? AlignmentType.RIGHT
              : AlignmentType.LEFT;
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: align,
            children: htmlToDocxRuns(html, 32),
            spacing: { after: 160 },
          }),
        );
        break;
      }
      case 'text': {
        const html = resolveLetterHtml(block.text, data.values, data.answerByLevelId, sanitizeHtml);
        children.push(...htmlToDocxParagraphs(html, { baseSize: 22 }));
        break;
      }
      case 'signature': {
        const html = resolveLetterHtml(block.text, data.values, data.answerByLevelId, sanitizeHtml);
        children.push(...htmlToDocxParagraphs(html, { baseSize: 20 }));
        break;
      }
      case 'spacer':
        children.push(new Paragraph({ text: '', spacing: { after: block.size * 1.5 } }));
        break;
      case 'meta': {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: block.fields.map((f) => labelValueRow(META_FIELD_LABEL[f], data.metaValueFor(f))),
          }),
          new Paragraph({ text: '', spacing: { after: 160 } }),
        );
        break;
      }
      case 'outcome': {
        const color = OUTCOME_COLOR[data.outcomeKind];
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'OUTCOME', bold: true, size: 18, color: '666666' })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.outcomeLabel, bold: true, size: 32, color })],
            spacing: { after: 80 },
          }),
        );
        if (data.liveOutcome.explanation && !data.persistedLabel) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: data.liveOutcome.explanation, size: 18, color: '444444' })],
              spacing: { after: 160 },
            }),
          );
        }
        break;
      }
      case 'reviewerNotes':
        if (data.notes) {
          children.push(
            heading('Reviewer notes', HeadingLevel.HEADING_3),
            new Paragraph({
              children: [new TextRun({ text: data.notes, size: 20 })],
              spacing: { after: 160 },
            }),
          );
        }
        break;
      case 'responses':
        if (data.sections.length === 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text:
                    'No questions marked "Include in outcome letter" — the letter has no response detail.',
                  italics: true,
                  size: 18,
                  color: '999999',
                }),
              ],
            }),
          );
        } else {
          for (const s of data.sections) {
            children.push(heading(s.level.dnx_name, HeadingLevel.HEADING_2));
            if (s.directQuestions.length > 0) {
              children.push(
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: questionRows(s.directQuestions),
                }),
              );
            }
            for (const sub of s.subsections) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: sub.level.dnx_name, bold: true, size: 20 })],
                  spacing: { before: 120, after: 60 },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: questionRows(sub.questions),
                }),
              );
            }
            children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
          }
        }
        break;
      case 'groupedSubsections': {
        const groups = buildGroupedSubsections(
          data.tree,
          block.sectionLevelId,
          block.groupByQuestionName,
          // Rebuilt inside buildLetterData already, but buildGroupedSubsections
          // needs the raw responsesByLevelId map — reconstruct cheaply here.
          reindex(responses),
        );
        if (groups.length > 0) {
          if (block.heading) children.push(heading(block.heading, HeadingLevel.HEADING_2));
          for (const g of groups) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: g.groupValue, bold: true, size: 24 })],
                spacing: { before: 120, after: 80 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E3E3E3' } },
              }),
            );
            for (const sub of g.subsections) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: sub.name, bold: true, size: 20 })],
                  spacing: { before: 80, after: 60 },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: questionRows(sub.questions),
                }),
              );
            }
          }
          children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        }
        break;
      }
    }
  }

  // The built-in trailing "Generated by…" line is only rendered inline when
  // there's no custom page footer. A custom footer becomes a repeating page
  // footer instead (see buildLetterDocxBlob), so we omit it here.
  if (!layout?.page?.footer) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Generated by IntelliAssessment', size: 16, color: '888888' }),
          new TextRun({ text: `    v${assessment.dnx_version ?? 1}`, size: 16, color: '888888' }),
        ],
        spacing: { before: 240 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D4D4D4' } },
      }),
    );
  }

  return children;
}

/** Re-derive the level-id → response map without re-running the whole letterData build. */
function reindex(responses: Dnx_assessment_responses[]) {
  const map = new Map<string, Dnx_assessment_responses>();
  for (const r of responses) {
    const rec = r as unknown as Record<string, unknown>;
    const levelId = rec._dnx_assessment_level_value as string | undefined;
    if (levelId) map.set(levelId, r);
  }
  return map;
}

/** Optional letterhead assets resolved by the caller (needs SDK access). */
export interface DocxLetterhead {
  /** Raw background image bytes from the template's Image column. */
  backgroundBytes?: Uint8Array;
  /** Image type for the docx ImageRun. */
  backgroundType?: 'png' | 'jpg' | 'gif' | 'bmp';
  /** Intrinsic pixel dimensions of the image (for aspect-ratio-correct sizing). */
  backgroundWidth?: number;
  backgroundHeight?: number;
  /** How the image should fill the page — mirrors the on-screen preview. */
  backgroundMode?: 'contain' | 'cover' | 'tile';
  /** Fraction of page width (0.1–1) the image occupies. Default 1. */
  backgroundScale?: number;
  /** 9-point anchor, e.g. 'top-left', 'center'. Default 'center'. */
  backgroundPosition?: string;
  /** Fit-mode background bleeds to the paper edge instead of the margin box. */
  backgroundBleed?: boolean;
}

// A4 page area in CSS px at 96 DPI (docx ImageRun transformation is in px).
const A4_PAGE_W = 794;
const A4_PAGE_H = 1123;
// Page margin (docx uses 1134 twips ≈ 20mm ≈ 76px at 96 DPI). A positioned
// (contain) background anchors inside this margin box so its corners line up
// with the text — matching the preview, which insets by the page padding.
const PAGE_MARGIN = 76;

const EMU = 9525; // 1 CSS px = 9525 EMU (docx floating offsets are in EMU).

/**
 * Size + place a background image for the Word page without distorting it,
 * mirroring the on-screen preview:
 *  - contain: scale to fit inside the page's MARGIN box (whole image visible,
 *             corners aligned to the text margins), then anchored 9-point
 *  - cover:   scale to fill the whole page edge-to-edge (cropped)
 * then multiply by `scale` (fraction of the box width). Aspect ratio is always
 * preserved. Falls back to a full-page fit when we don't know the intrinsic size.
 */
function backgroundTransformation(
  mode: 'contain' | 'cover',
  imgW: number | undefined,
  imgH: number | undefined,
  scale: number,
  position: string,
  bleed: boolean,
): { width: number; height: number; hOffset: number; vOffset: number } {
  // Cover always fills the whole paper. Contain lives inside the margin box
  // unless the bleed toggle is on, in which case it uses the full paper too.
  const useMargins = mode === 'contain' && !bleed;
  const boxX = useMargins ? PAGE_MARGIN : 0;
  const boxY = useMargins ? PAGE_MARGIN : 0;
  const boxW = useMargins ? A4_PAGE_W - PAGE_MARGIN * 2 : A4_PAGE_W;
  const boxH = useMargins ? A4_PAGE_H - PAGE_MARGIN * 2 : A4_PAGE_H;

  let w: number;
  let h: number;
  if (!imgW || !imgH || imgW <= 0 || imgH <= 0) {
    w = boxW;
    h = boxH;
  } else {
    const boxRatio = boxW / boxH;
    const imgRatio = imgW / imgH;
    const fitToWidth = mode === 'contain' ? imgRatio > boxRatio : imgRatio < boxRatio;
    if (fitToWidth) {
      w = boxW;
      h = Math.round(boxW / imgRatio);
    } else {
      h = boxH;
      w = Math.round(boxH * imgRatio);
    }
  }
  // Apply the author's scale (fraction of the box width).
  const s = Math.min(1, Math.max(0.1, scale || 1));
  w = Math.round(w * s);
  h = Math.round(h * s);

  // Anchor within the box per the 9-point position, then shift by the box origin.
  const [v, hh] = position.split('-');
  const freeX = boxW - w;
  const freeY = boxH - h;
  const px = boxX + (hh === 'left' ? 0 : hh === 'right' ? freeX : freeX / 2);
  const py = boxY + (v === 'top' ? 0 : v === 'bottom' ? freeY : freeY / 2);
  return {
    width: w,
    height: h,
    hOffset: Math.round(px * EMU),
    vOffset: Math.round(py * EMU),
  };
}

/**
 * Assemble the full `docx.Document` and return it as a `Blob`, ready for
 * download. One A4-ish "section" (docx's page-size concept) matches the PDF
 * export's paper size.
 *
 * A custom `layout.page.header` / `.footer` becomes a **real repeating page
 * header/footer** (unlike the on-screen letter, where they render once). A
 * background image (bytes supplied via `letterhead`) is placed as a floating,
 * behind-text, full-page image on the header so it shows on every page.
 */
export async function buildLetterDocxBlob(
  assessment: Dnx_assessment_instances,
  levels: Dnx_assessment_levels[],
  responses: Dnx_assessment_responses[],
  criteriaByLevelId: Map<string, Criteria> | undefined,
  layout: LetterLayout | undefined,
  letterhead?: DocxLetterhead,
): Promise<Blob> {
  const children = buildLetterDocxChildren(assessment, levels, responses, criteriaByLevelId, layout);
  const data = buildLetterData(assessment, levels, responses, criteriaByLevelId);

  // Resolve the header/footer rich text the same way the screen renderer does.
  const headerParagraphs =
    layout?.page?.header
      ? htmlToDocxParagraphs(
          resolveLetterHtml(layout.page.header, data.values, data.answerByLevelId, sanitizeHtml),
          { baseSize: 20 },
        )
      : [];
  const footerParagraphs =
    layout?.page?.footer
      ? htmlToDocxParagraphs(
          resolveLetterHtml(layout.page.footer, data.values, data.answerByLevelId, sanitizeHtml),
          { baseSize: 18 },
        )
      : [];

  // Background: a floating image anchored behind the text, placed on the header
  // so docx repeats it on every page. Sized to the image's real aspect ratio
  // per the fit mode (docx has no CSS background-size), then centred — so it
  // never stretches. `tile` has no clean docx equivalent for a floating image,
  // so it falls back to `contain`.
  let bgImage: Paragraph | null = null;
  if (layout?.page?.image && letterhead?.backgroundBytes) {
    const mode = letterhead.backgroundMode === 'cover' ? 'cover' : 'contain';
    const t = backgroundTransformation(
      mode,
      letterhead.backgroundWidth,
      letterhead.backgroundHeight,
      letterhead.backgroundScale ?? 1,
      letterhead.backgroundPosition ?? 'center',
      letterhead.backgroundBleed ?? false,
    );
    bgImage = new Paragraph({
      children: [
        new ImageRun({
          data: letterhead.backgroundBytes,
          type: letterhead.backgroundType ?? 'png',
          transformation: { width: t.width, height: t.height },
          floating: {
            horizontalPosition: { offset: Math.max(0, t.hOffset) },
            verticalPosition: { offset: Math.max(0, t.vOffset) },
            behindDocument: true,
            allowOverlap: true,
          },
        }),
      ],
    });
  }

  const headerChildren = [
    ...(bgImage ? [bgImage] : []),
    ...(headerParagraphs.length > 0 ? headerParagraphs : []),
  ];

  const doc = new Document({
    // Match the on-screen letter's sans-serif look. Inter isn't a Word-installed
    // font, so we use Calibri (ships with Word everywhere) as the document
    // default — otherwise Word falls back to Times New Roman. Individual runs
    // don't set a font, so they all inherit this.
    styles: {
      default: {
        document: { run: { font: 'Calibri' } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips (210mm x 297mm)
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // ~20mm
          },
        },
        headers:
          headerChildren.length > 0
            ? { default: new Header({ children: headerChildren }) }
            : undefined,
        footers:
          footerParagraphs.length > 0
            ? { default: new Footer({ children: footerParagraphs }) }
            : undefined,
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

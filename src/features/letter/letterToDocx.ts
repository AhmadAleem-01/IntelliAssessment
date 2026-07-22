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
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: 'IntelliAssessment', bold: true, size: 18, color: '7F77DD' })],
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

/**
 * Assemble the full `docx.Document` and return it as a `Blob`, ready for
 * download. One A4-ish "section" (docx's page-size concept) matches the PDF
 * export's paper size.
 */
export async function buildLetterDocxBlob(
  assessment: Dnx_assessment_instances,
  levels: Dnx_assessment_levels[],
  responses: Dnx_assessment_responses[],
  criteriaByLevelId: Map<string, Criteria> | undefined,
  layout: LetterLayout | undefined,
): Promise<Blob> {
  const children = buildLetterDocxChildren(assessment, levels, responses, criteriaByLevelId, layout);
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips (210mm x 297mm)
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // ~20mm
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

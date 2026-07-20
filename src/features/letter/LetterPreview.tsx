import { makeStyles } from '@fluentui/react-components';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Criteria, EvaluationOutcome } from '../rules/types';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import { indexResponses, readResponseValue } from '../assessments/responseHelpers';
import { evaluateAssessment, findRootCriteria } from '../rules/engine';
import { lookupName } from '../../lib/dataverse';
import {
  DEFAULT_LAYOUT,
  META_FIELD_LABEL,
  resolveLetterHtml,
  type LetterLayout,
  type MetaFieldKey,
  type PlaceholderValues,
} from './letterLayout';
import { sanitizeHtml } from './sanitizeHtml';

const useStyles = makeStyles({
  // Letter is a fixed-width page so the printed PDF doesn't shift based on
  // viewport. 740px ≈ A4 minus margins at 96 DPI.
  page: {
    width: '740px',
    maxWidth: '100%',
    margin: '0 auto',
    padding: '40px 48px',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '13px',
    lineHeight: 1.55,
  },
  header: {
    paddingBottom: '14px',
    borderBottom: '1px solid #d4d4d4',
    marginBottom: '20px',
  },
  brand: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7F77DD',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginTop: '6px',
    color: '#0d0d0d',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '24px',
    rowGap: '6px',
    marginTop: '12px',
    fontSize: '12px',
  },
  metaLabel: {
    color: '#666',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '1px',
  },
  metaValue: { color: '#1a1a1a' },
  outcomeBlock: {
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    padding: '14px 16px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  outcomeBlockPass: {
    backgroundColor: '#e4efd2',
    border: '1px solid #639922',
  },
  outcomeBlockFail: {
    backgroundColor: '#fbdedd',
    border: '1px solid #c4302b',
  },
  outcomeBlockPending: {
    backgroundColor: '#f6f6f6',
  },
  outcomeLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#666',
  },
  outcomeValue: {
    fontSize: '18px',
    fontWeight: 700,
    marginTop: '2px',
  },
  outcomeValuePass: { color: '#3e6313' },
  outcomeValueFail: { color: '#962a29' },
  outcomeValuePending: { color: '#666' },
  outcomeExplanation: {
    fontSize: '11px',
    color: '#444',
    marginTop: '2px',
  },
  reviewerNotes: {
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    padding: '12px 14px',
    backgroundColor: '#fafafa',
    marginBottom: '24px',
  },
  reviewerNotesLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#666',
    marginBottom: '4px',
  },
  reviewerNotesBody: {
    fontSize: '12px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    color: '#1a1a1a',
  },
  section: {
    marginBottom: '20px',
    breakInside: 'avoid',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0d0d0d',
    marginBottom: '8px',
    paddingBottom: '4px',
    borderBottom: '1px solid #e3e3e3',
  },
  subsection: {
    marginTop: '8px',
    marginBottom: '8px',
    paddingLeft: '8px',
    borderLeft: '2px solid #e3e3e3',
  },
  subsectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#444',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  questionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '0.5px solid #f0f0f0',
    breakInside: 'avoid',
    ':last-child': { borderBottom: 'none' },
  },
  questionLabel: {
    fontSize: '12px',
    color: '#1a1a1a',
    fontWeight: 500,
  },
  questionAnswer: {
    fontSize: '12px',
    color: '#1a1a1a',
    fontWeight: 400,
  },
  questionAnswerEmpty: {
    color: '#999',
    fontStyle: 'italic',
  },
  emptyHint: {
    fontSize: '11px',
    color: '#999',
    fontStyle: 'italic',
    padding: '12px 0',
  },
  footer: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #d4d4d4',
    fontSize: '10px',
    color: '#888',
    display: 'flex',
    justifyContent: 'space-between',
  },
  // --- authored blocks (M8b) ---
  blockText: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#1a1a1a',
    whiteSpace: 'pre-wrap',
    marginBottom: '16px',
  },
  signature: {
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#444',
    whiteSpace: 'pre-wrap',
    marginTop: '24px',
    paddingTop: '12px',
    borderTop: '1px solid #e3e3e3',
  },
  reasonGroup: { marginTop: '10px', marginBottom: '12px', breakInside: 'avoid' },
  reasonLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0d0d0d',
    marginBottom: '4px',
    paddingBottom: '3px',
    borderBottom: '1px solid #e3e3e3',
  },
});

interface Props {
  assessment: Dnx_assessment_instances;
  levels: Dnx_assessment_levels[];
  responses: Dnx_assessment_responses[];
  criteriaByLevelId: Map<string, Criteria> | undefined;
  /** Author-defined block layout. Falls back to DEFAULT_LAYOUT when omitted. */
  layout?: LetterLayout;
}

/**
 * Read-only HTML render of the outcome letter sent to the candidate.
 * Pulls every question marked `dnx_include_in_letter = true` and shows
 * its label + the assessor's answer, grouped by section / subsection.
 * The whole component is print-friendly: when `window.print()` is called
 * with the `.letter-print-root` class applied to a wrapper, the print
 * stylesheet in index.css hides every other page chrome so the PDF
 * comes out clean.
 */
export function LetterPreview({
  assessment,
  levels,
  responses,
  criteriaByLevelId,
  layout,
}: Props) {
  const styles = useStyles();
  const blocks = (layout ?? DEFAULT_LAYOUT).blocks;
  const tree = buildTree(levels);
  const responsesByLevelId = indexResponses(responses);
  const rootCriteria = findRootCriteria(levels, criteriaByLevelId);
  const liveOutcome: EvaluationOutcome = evaluateAssessment(
    tree,
    criteriaByLevelId,
    responsesByLevelId,
    rootCriteria,
  );

  // Prefer the persisted outcome over live preview when the assessment
  // has been submitted or approved — the candidate's letter should
  // reflect the recorded verdict, not "this is what it would be if you
  // edited it now".
  const persisted = assessment.dnx_outcome;
  const persistedLabel =
    persisted === 0 ? 'Suitable' : persisted === 1 ? 'Not suitable' : null;

  const outcomeLabel =
    persistedLabel ??
    (liveOutcome.kind === 'pass'
      ? 'Suitable'
      : liveOutcome.kind === 'fail'
        ? 'Not suitable'
        : 'Pending');

  const outcomeKind =
    persisted === 0 || liveOutcome.kind === 'pass'
      ? 'pass'
      : persisted === 1 || liveOutcome.kind === 'fail'
        ? 'fail'
        : 'pending';

  const projectName = lookupName(assessment, 'dnx_project');
  const templateName = lookupName(assessment, 'dnx_assessmenttemplate');
  const candidateName = lookupName(assessment, 'ownerid');

  const submittedOn = assessment.dnx_submittedon
    ? new Date(assessment.dnx_submittedon).toLocaleDateString()
    : null;
  const today = new Date().toLocaleDateString();
  const notes = assessment.dnx_outcome_notes?.trim();

  // Walk the tree once collecting all questions with include_in_letter +
  // their resolved answer string. Returns a structured map for rendering.
  const sections = tree
    .map((sectionNode) => ({
      level: sectionNode.level,
      directQuestions: collectIncluded(sectionNode, false, responsesByLevelId),
      subsections: sectionNode.children
        .filter((c) => (c.level.dnx_assessment_level_type as LevelType) === 2)
        .map((subNode) => ({
          level: subNode.level,
          questions: collectIncluded(subNode, true, responsesByLevelId),
        }))
        .filter((s) => s.questions.length > 0),
    }))
    .filter((s) => s.directQuestions.length > 0 || s.subsections.length > 0);

  // Placeholder values for heading / text / signature blocks.
  const values: PlaceholderValues = {
    candidate: candidateName ?? '—',
    assessment: assessment.dnx_assessment_name,
    project: projectName ?? '—',
    template: templateName ?? '—',
    outcome: outcomeLabel,
    submittedOn: submittedOn ?? '—',
    today,
    version: String(assessment.dnx_version ?? 1),
  };
  // Every question's formatted answer, keyed by level id — powers the inline
  // {{q:<levelId>|name}} answer tokens in heading / text / signature blocks.
  // Covers ALL questions (not just include_in_letter ones), since an author may
  // reference any answer in prose.
  const answerByLevelId: Record<string, string> = {};
  for (const level of levels) {
    if ((level.dnx_assessment_level_type as LevelType) !== 3) continue;
    const dataType = (level.dnx_data_type ?? 3) as DataType;
    const value = readResponseValue(
      dataType,
      responsesByLevelId.get(level.dnx_assessment_levelid),
    );
    answerByLevelId[level.dnx_assessment_levelid] = formatAnswer(value, dataType);
  }

  const metaValueFor = (key: MetaFieldKey): string => {
    switch (key) {
      case 'candidate':
        return candidateName ?? '—';
      case 'assessment':
        return assessment.dnx_assessment_name;
      case 'project':
        return projectName ?? '—';
      case 'template':
        return templateName ?? '—';
      case 'submittedOn':
        return submittedOn ?? '—';
      case 'today':
        return today;
      case 'version':
        return `v${assessment.dnx_version ?? 1}`;
    }
  };

  return (
    <div className={styles.page}>
      {/* The brand strip is part of the page identity, always at the top. */}
      <div className={styles.brand} style={{ marginBottom: 10 }}>
        IntelliAssessment
      </div>

      {blocks.map((block) => {
        switch (block.type) {
          case 'heading':
            return (
              <div
                key={block.id}
                className={styles.title}
                style={{ textAlign: block.align, marginBottom: 16 }}
                dangerouslySetInnerHTML={{
                  __html: resolveLetterHtml(block.text, values, answerByLevelId, sanitizeHtml),
                }}
              />
            );
          case 'text':
            return (
              <div
                key={block.id}
                className={styles.blockText}
                dangerouslySetInnerHTML={{
                  __html: resolveLetterHtml(block.text, values, answerByLevelId, sanitizeHtml),
                }}
              />
            );
          case 'signature':
            return (
              <div
                key={block.id}
                className={styles.signature}
                dangerouslySetInnerHTML={{
                  __html: resolveLetterHtml(block.text, values, answerByLevelId, sanitizeHtml),
                }}
              />
            );
          case 'spacer':
            return <div key={block.id} style={{ height: block.size }} />;
          case 'meta':
            return (
              <div key={block.id} className={styles.header}>
                <div className={styles.metaGrid}>
                  {block.fields.map((f) => (
                    <div key={f}>
                      <div className={styles.metaLabel}>{META_FIELD_LABEL[f]}</div>
                      <div className={styles.metaValue}>{metaValueFor(f)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          case 'outcome':
            return (
              <div
                key={block.id}
                className={`${styles.outcomeBlock} ${
                  outcomeKind === 'pass'
                    ? styles.outcomeBlockPass
                    : outcomeKind === 'fail'
                      ? styles.outcomeBlockFail
                      : styles.outcomeBlockPending
                }`}
              >
                <div style={{ flex: 1 }}>
                  <div className={styles.outcomeLabel}>Outcome</div>
                  <div
                    className={`${styles.outcomeValue} ${
                      outcomeKind === 'pass'
                        ? styles.outcomeValuePass
                        : outcomeKind === 'fail'
                          ? styles.outcomeValueFail
                          : styles.outcomeValuePending
                    }`}
                  >
                    {outcomeLabel}
                  </div>
                  {liveOutcome.explanation && !persistedLabel && (
                    <div className={styles.outcomeExplanation}>
                      {liveOutcome.explanation}
                    </div>
                  )}
                </div>
              </div>
            );
          case 'reviewerNotes':
            return notes ? (
              <div key={block.id} className={styles.reviewerNotes}>
                <div className={styles.reviewerNotesLabel}>Reviewer notes</div>
                <div className={styles.reviewerNotesBody}>{notes}</div>
              </div>
            ) : null;
          case 'responses':
            return (
              <div key={block.id}>
                {sections.length === 0 ? (
                  <div className={styles.emptyHint}>
                    No questions marked "Include in outcome letter" — the letter has
                    no response detail. Toggle the flag on questions in the template
                    editor to surface their answers here.
                  </div>
                ) : (
                  sections.map((s) => (
                    <div key={s.level.dnx_assessment_levelid} className={styles.section}>
                      <div className={styles.sectionTitle}>{s.level.dnx_name}</div>
                      {s.directQuestions.map((q) => (
                        <QuestionRow key={q.levelId} {...q} styles={styles} />
                      ))}
                      {s.subsections.map((sub) => (
                        <div
                          key={sub.level.dnx_assessment_levelid}
                          className={styles.subsection}
                        >
                          <div className={styles.subsectionTitle}>{sub.level.dnx_name}</div>
                          {sub.questions.map((q) => (
                            <QuestionRow key={q.levelId} {...q} styles={styles} />
                          ))}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            );
          case 'groupedSubsections': {
            const groups = buildGroupedSubsections(
              tree,
              block.sectionLevelId,
              block.groupByQuestionName,
              responsesByLevelId,
            );
            return groups.length === 0 ? null : (
              <div key={block.id} className={styles.section}>
                {block.heading && (
                  <div className={styles.sectionTitle}>{block.heading}</div>
                )}
                {groups.map((g) => (
                  <div key={g.groupValue} className={styles.reasonGroup}>
                    <div className={styles.reasonLabel}>{g.groupValue}</div>
                    {g.subsections.map((sub) => (
                      <div key={sub.levelId} className={styles.subsection}>
                        <div className={styles.subsectionTitle}>{sub.name}</div>
                        {sub.questions.map((q) => (
                          <QuestionRow key={q.levelId} {...q} styles={styles} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          }
        }
      })}

      <div className={styles.footer}>
        <span>Generated by IntelliAssessment</span>
        <span>v{assessment.dnx_version ?? 1}</span>
      </div>
    </div>
  );
}

interface CollectedQuestion {
  levelId: string;
  label: string;
  answer: string;
}

function QuestionRow({
  label,
  answer,
  styles,
}: CollectedQuestion & { styles: ReturnType<typeof useStyles> }) {
  const empty = !answer || answer === '—';
  return (
    <div className={styles.questionRow}>
      <div className={styles.questionLabel}>{label}</div>
      <div
        className={`${styles.questionAnswer} ${empty ? styles.questionAnswerEmpty : ''}`}
      >
        {answer || '—'}
      </div>
    </div>
  );
}

/**
 * Walk a Section or Subsection node and pull out the questions flagged
 * `include_in_letter`. `descendOnly` controls whether to recurse into
 * subsections — used so the Section-level pass picks up direct Questions
 * only, leaving the Subsection-level pass to handle nested ones.
 */
/** One subsection with its letter-visible questions. */
interface GroupedSubsection {
  levelId: string;
  name: string;
  questions: CollectedQuestion[];
}
/** A group of subsections that share one answer value for the group-by question. */
interface SubsectionGroup {
  groupValue: string;
  subsections: GroupedSubsection[];
}

/**
 * Group a chosen Section's direct Subsections by the answer to a question
 * that lives inside each of them (M8b.2 — "grouped subsections" block). Every
 * subsection has its OWN instance of the group-by question (e.g. every
 * "Qualification N" subsection has its own "Reason" question), so we match by
 * NAME rather than by level id. Under each group value we carry the
 * subsection's `include_in_letter` questions for detail. Subsections with no
 * answer to the group-by question are skipped; first-seen order is preserved.
 */
function buildGroupedSubsections(
  tree: LevelNode[],
  sectionLevelId: string,
  groupByQuestionName: string,
  responsesByLevelId: ReturnType<typeof indexResponses>,
): SubsectionGroup[] {
  const questionName = groupByQuestionName.trim();
  if (!sectionLevelId || !questionName) return [];
  const section = tree.find((n) => n.level.dnx_assessment_levelid === sectionLevelId);
  if (!section) return [];

  const order: string[] = [];
  const byValue = new Map<string, GroupedSubsection[]>();

  for (const sub of section.children) {
    if ((sub.level.dnx_assessment_level_type as LevelType) !== 2) continue;
    // Find this subsection's group-by question (direct child, matched by name).
    const groupQ = sub.children.find(
      (c) =>
        (c.level.dnx_assessment_level_type as LevelType) === 3 &&
        c.level.dnx_name.trim() === questionName,
    );
    if (!groupQ) continue;
    const dataType = (groupQ.level.dnx_data_type ?? 3) as DataType;
    const value = readResponseValue(
      dataType,
      responsesByLevelId.get(groupQ.level.dnx_assessment_levelid),
    );
    const groupValue = formatAnswer(value, dataType);
    if (!groupValue || groupValue === '—') continue;
    if (!byValue.has(groupValue)) {
      byValue.set(groupValue, []);
      order.push(groupValue);
    }
    byValue.get(groupValue)!.push({
      levelId: sub.level.dnx_assessment_levelid,
      name: sub.level.dnx_name,
      // This subsection's letter-visible questions (reuse collectIncluded;
      // `includeAll` false = its direct questions only).
      questions: collectIncluded(sub, false, responsesByLevelId),
    });
  }

  return order.map((groupValue) => ({ groupValue, subsections: byValue.get(groupValue)! }));
}

function collectIncluded(
  node: LevelNode,
  includeAll: boolean,
  responsesByLevelId: ReturnType<typeof indexResponses>,
): CollectedQuestion[] {
  const out: CollectedQuestion[] = [];
  for (const child of node.children) {
    const childType = child.level.dnx_assessment_level_type as LevelType;
    if (childType === 3) {
      if (!child.level.dnx_include_in_letter) continue;
      const dataType = (child.level.dnx_data_type ?? 3) as DataType;
      const response = responsesByLevelId.get(child.level.dnx_assessment_levelid);
      const value = readResponseValue(dataType, response);
      out.push({
        levelId: child.level.dnx_assessment_levelid,
        label: child.level.dnx_name,
        answer: formatAnswer(value, dataType),
      });
    } else if (childType === 2 && includeAll) {
      out.push(...collectIncluded(child, true, responsesByLevelId));
    }
  }
  return out;
}

function formatAnswer(
  value: boolean | string | string[] | null,
  dataType: DataType,
): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.join(', ');
  }
  if (dataType === 4 && typeof value === 'string') {
    // Date — already YYYY-MM-DD in storage; render as local date string.
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }
  return value;
}

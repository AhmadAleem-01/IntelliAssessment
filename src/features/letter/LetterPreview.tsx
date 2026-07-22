import { makeStyles } from '@fluentui/react-components';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Criteria } from '../rules/types';
import { indexResponses } from '../assessments/responseHelpers';
import {
  DEFAULT_LAYOUT,
  META_FIELD_LABEL,
  resolveLetterHtml,
  type LetterLayout,
} from './letterLayout';
import { sanitizeHtml } from './sanitizeHtml';
import {
  buildLetterData,
  buildGroupedSubsections,
  type CollectedQuestion,
} from './letterData';

const useStyles = makeStyles({
  // Letter is a fixed-width page so the printed PDF doesn't shift based on
  // viewport. 740px ≈ A4 minus margins at 96 DPI.
  page: {
    position: 'relative',
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
  // Background image sits behind everything; content is lifted above it via
  // position:relative + z-index on the page-content wrapper. A flex container
  // anchors the (possibly scaled) image via justify/align, set inline from the
  // 9-point position. Its inset (margin box vs. full bleed) is set inline from
  // the bleed toggle. The <img> keeps aspect ratio so it never distorts.
  bgAnchor: {
    position: 'absolute',
    display: 'flex',
    pointerEvents: 'none',
    zIndex: 0,
    overflow: 'hidden',
  },
  bgImg: {
    display: 'block',
  },
  // Cover: fill the whole page, cropping overflow (object-position anchors it).
  bgCover: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgTile: {
    position: 'absolute',
    inset: 0,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
    pointerEvents: 'none',
    zIndex: 0,
  },
  pageContent: { position: 'relative', zIndex: 1 },
  customHeader: {
    marginBottom: '18px',
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  customFooter: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #d4d4d4',
    fontSize: '11px',
    lineHeight: 1.5,
    color: '#444',
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
  /**
   * Servable URL of the template's letter-background image
   * (downloaded from the File column → object URL). Only rendered when the layout's
   * `page.image` flag is on. Undefined = no background.
   */
  backgroundUrl?: string;
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
  backgroundUrl,
}: Props) {
  const styles = useStyles();
  const resolved = layout ?? DEFAULT_LAYOUT;
  const blocks = resolved.blocks;
  const page = resolved.page;
  const responsesByLevelId = indexResponses(responses);
  const {
    tree,
    outcomeLabel,
    outcomeKind,
    liveOutcome,
    persistedLabel,
    values,
    answerByLevelId,
    metaValueFor,
    sections,
    notes,
  } = buildLetterData(assessment, levels, responses, criteriaByLevelId);

  // Background image only renders when the layout flags it on AND we have a URL.
  const showBg = !!page?.image && !!backgroundUrl;
  const bgMode = page?.backgroundMode ?? 'contain';
  const bgOpacity = page?.backgroundOpacity ?? 0.15;
  const bgScale = clamp01Scale(page?.backgroundScale ?? 1);
  const bgPosition = page?.backgroundPosition ?? 'center';
  const { justifyContent, alignItems } = flexFromPosition(bgPosition);
  // Fit anchor inset: margin box (matches text) unless bleed is on (paper edge).
  // Must mirror the page padding (40px 48px).
  const bgInset: React.CSSProperties = page?.backgroundBleed
    ? { top: 0, right: 0, bottom: 0, left: 0 }
    : { top: 40, right: 48, bottom: 40, left: 48 };

  const headerHtml = page?.header
    ? resolveLetterHtml(page.header, values, answerByLevelId, sanitizeHtml)
    : null;
  const footerHtml = page?.footer
    ? resolveLetterHtml(page.footer, values, answerByLevelId, sanitizeHtml)
    : null;

  return (
    <div className={styles.page}>
      {showBg &&
        (bgMode === 'tile' ? (
          <div
            className={styles.bgTile}
            style={{
              backgroundImage: `url("${backgroundUrl}")`,
              opacity: bgOpacity,
            }}
          />
        ) : bgMode === 'cover' ? (
          // Cover: fill the whole page box, cropping overflow. object-fit needs
          // a fixed width AND height to crop against.
          <img
            className={styles.bgCover}
            src={backgroundUrl}
            alt=""
            aria-hidden
            style={{ objectPosition: bgPosition.replace('-', ' '), opacity: bgOpacity }}
          />
        ) : (
          // Fit: scale by width only, keep aspect (height:auto). No object-fit,
          // no height clamp — that's what was cropping it. Anchored via flex.
          <div className={styles.bgAnchor} style={{ justifyContent, alignItems, ...bgInset }}>
            <img
              className={styles.bgImg}
              src={backgroundUrl}
              alt=""
              aria-hidden
              style={{ width: `${bgScale * 100}%`, height: 'auto', opacity: bgOpacity }}
            />
          </div>
        ))}
      <div className={styles.pageContent}>
      {/* Custom header replaces the built-in brand strip when set. */}
      {headerHtml !== null ? (
        <div
          className={styles.customHeader}
          dangerouslySetInnerHTML={{ __html: headerHtml }}
        />
      ) : (
        <div className={styles.brand} style={{ marginBottom: 10 }}>
          IntelliAssessment
        </div>
      )}

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

      {footerHtml !== null ? (
        <div
          className={styles.customFooter}
          dangerouslySetInnerHTML={{ __html: footerHtml }}
        />
      ) : (
        <div className={styles.footer}>
          <span>Generated by IntelliAssessment</span>
          <span>v{assessment.dnx_version ?? 1}</span>
        </div>
      )}
      </div>
    </div>
  );
}

/** Clamp a background scale fraction to the authored 0.1–1 range. */
function clamp01Scale(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0.1, v));
}

/** Map a 9-point background position to flexbox justify/align values. */
function flexFromPosition(pos: string): {
  justifyContent: React.CSSProperties['justifyContent'];
  alignItems: React.CSSProperties['alignItems'];
} {
  const [v, h] = pos.split('-'); // e.g. "top-left" → ["top","left"]; "center" → ["center", undefined]
  const vertical = v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
  const horizontal =
    h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center';
  return { alignItems: vertical, justifyContent: horizontal };
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


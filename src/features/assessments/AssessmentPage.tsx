import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  ChevronLeft16Regular,
  ClipboardTaskListLtr20Regular,
  CheckmarkCircle16Filled,
  ErrorCircle16Filled,
} from '@fluentui/react-icons';
import { Button } from '@fluentui/react-components';
import {
  SendCopy20Regular,
  CheckmarkCircle16Regular,
  DismissCircle16Regular,
  PersonStar16Regular,
} from '@fluentui/react-icons';
import {
  useAssessmentInstance,
  useUpsertResponse,
  useAssessmentResponses,
  useSaveEvidenceMapping,
} from './api';
import { ChecklistRenderer } from './ChecklistRenderer';
import { CommentsDrawer, useGeneralCommentCount } from './CommentsDrawer';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';
import { EvidenceCard } from '../evidence/EvidenceCard';
import { Comment20Regular, History20Regular } from '@fluentui/react-icons';
import { SubmitAssessmentDialog } from './SubmitAssessmentDialog';
import { ApproveAssessmentDialog } from './ApproveAssessmentDialog';
import { RejectAssessmentDialog } from './RejectAssessmentDialog';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName, lookupId } from '../../lib/dataverse';
import { useCurrentUserRoles } from '../../lib/roles';
import { ApplicationDetailsCard } from '../applicationDetails/ApplicationDetailsCard';
import { useApplicationDetails } from '../applicationDetails/api';
import { collectUsedPaths } from '../applicationDetails/usedPaths';
import { Tooltip } from '@fluentui/react-components';
import { DocumentText20Regular } from '@fluentui/react-icons';
import { LetterDialog } from '../letter/LetterDialog';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree } from '../templates/levels/treeBuilder';
import { useCriteriaForLevels } from '../rules/api';
import { evaluateAssessment, findRootCriteria } from '../rules/engine';
import { indexResponses, hasAnswer } from './responseHelpers';
import type { EvaluationOutcome } from '../rules/types';
import { AiPopulateDialog, type AcceptedSuggestion } from '../evidence/AiPopulateDialog';
import { useEvidenceFiles } from '../evidence/api';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';

const useStyles = makeStyles({
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    marginBottom: '14px',
    ':hover': { color: 'var(--color-text-primary)' },
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '24px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  iconChip: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  title: {
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    margin: 0,
    letterSpacing: '-0.005em',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--color-text-secondary)',
    fontSize: '12px',
    flexWrap: 'wrap',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
  },
  outcomeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  outcomeChipPass: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    border: '0.5px solid var(--color-green)',
  },
  outcomeChipFail: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
    border: '0.5px solid var(--color-red)',
  },
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  cardHeader: {
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  cardBody: { padding: '18px' },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px 28px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  fieldValue: {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
  },
  templateLink: {
    color: 'var(--color-purple-text)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  projectLink: {
    color: 'var(--color-purple-text)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  placeholder: {
    padding: '24px',
    borderRadius: 'var(--border-radius-lg)',
    border: '0.5px dashed var(--color-border-secondary)',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    backgroundColor: 'var(--color-background-primary)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  placeholderTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  reviewerPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--color-purple-soft)',
    border: '0.5px solid var(--color-purple)',
    marginBottom: '14px',
  },
  reviewerMark: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-purple)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewerCopy: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  reviewerTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  reviewerSub: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  reviewerActions: { display: 'flex', gap: '8px', flexShrink: 0 },
  approveBtn: {
    backgroundColor: 'var(--color-green) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-green) !important',
    ':hover': {
      backgroundColor: 'var(--color-green-text) !important',
      border: '0.5px solid var(--color-green-text) !important',
    },
  },
  rejectBtn: {
    color: 'var(--color-amber-text) !important',
    backgroundColor: 'transparent !important',
    border: '0.5px solid var(--color-amber) !important',
    ':hover': {
      backgroundColor: 'var(--color-amber-soft) !important',
    },
  },
  feedbackBanner: {
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-lg)',
    border: '0.5px solid',
    marginBottom: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  feedbackTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  feedbackBody: {
    fontSize: '13px',
    lineHeight: 1.45,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
  },
  saveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
  },
  saveBadgeIdle: {
    backgroundColor: 'var(--color-background-secondary)',
    color: 'var(--color-text-tertiary)',
  },
  saveBadgeSaving: {
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
  },
  saveBadgeSaved: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
  },
  saveBadgeError: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
  },
  spinDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    opacity: 0.6,
    animationName: 'save-pulse',
    animationDuration: '0.9s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Draft: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Draft' },
  InProgress: {
    bg: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
    label: 'In progress',
  },
  PendingReview: {
    bg: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    label: 'Pending review',
  },
  Complete: {
    bg: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    label: 'Complete',
  },
  Active: { bg: 'var(--color-blue-soft)', color: 'var(--color-blue-text)', label: 'Active' },
  Inactive: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Inactive',
  },
};

export function AssessmentPage() {
  const styles = useStyles();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { data: assessment, isLoading, error } = useAssessmentInstance(assessmentId);
  const roles = useCurrentUserRoles();
  // Application-details JSON for this instance — powers per-level detail panels
  // and feeds AI bindings. Only fetched when the instance actually has a file.
  const { data: applicationData } = useApplicationDetails(
    assessmentId,
    !!assessment?.dnx_application_details_name,
    assessment?.dnx_application_details_name,
  );

  // Autosave state — lifted here so the badge in the hero can see the upsert
  // mutation's status. ChecklistRenderer gets the mutation via prop.
  const upsert = useUpsertResponse(assessmentId ?? '');
  const saveMapping = useSaveEvidenceMapping(assessmentId ?? '');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // M6b — AI auto-fill: mapping + review dialog open state.
  const [aiOpen, setAiOpen] = useState(false);
  const generalCommentCount = useGeneralCommentCount(assessmentId);
  useEffect(() => {
    if (upsert.isSuccess && upsert.data) {
      setLastSavedAt(new Date());
    }
  }, [upsert.isSuccess, upsert.data]);

  // Live outcome preview for the hero chip. Pulled from the same data the
  // checklist already loads downstream — React Query dedupes the queries.
  const templateIdForOutcome = assessment
    ? lookupId(assessment, 'dnx_assessmenttemplate')
    : undefined;
  const { data: levels } = useTemplateLevels(templateIdForOutcome);
  // Application-details attribute paths the template actually uses (AI bindings
  // + details panels) — the card validates the uploaded JSON against these.
  const requiredAppDataPaths = useMemo(() => collectUsedPaths(levels), [levels]);
  const { data: responses } = useAssessmentResponses(assessmentId);
  const allLevelIds = (levels ?? []).map((l) => l.dnx_assessment_levelid);
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);
  // Real uploaded evidence files — offered as mapping targets in the auto-fill
  // dialog. Keyed off the assessment name (same key the EvidenceCard uses, so
  // React Query dedupes this query).
  const { data: evidenceFiles } = useEvidenceFiles(assessment?.dnx_assessment_name);
  const responsesByLevelId = indexResponses(responses);
  const liveOutcome: EvaluationOutcome = levels
    ? evaluateAssessment(
        buildTree(levels),
        criteriaByLevelId,
        responsesByLevelId,
        findRootCriteria(levels, criteriaByLevelId),
      )
    : { kind: 'not-evaluable', reason: 'no-children' };

  // Questions the AI should attempt: ALL Question-type levels. We deliberately
  // do NOT filter by answered or visible state here — the assessor can re-fill
  // an already-answered question, and a question hidden by a visibility rule on
  // screen can still be answered from evidence. The review step lets them pick
  // which proposals to apply, so offering everything is safe. The dialog itself
  // narrows to questions that carry a file variable (via groupByFileVariable).
  const aiQuestions: Dnx_assessment_levels[] = (levels ?? []).filter(
    (l) => (l.dnx_assessment_level_type as LevelType) === 3,
  );
  // Level ids that already have an answer — passed to the dialog so the review
  // list can flag "accepting will overwrite the current answer".
  const answeredLevelIds = new Set(
    aiQuestions
      .filter((l) => hasAnswer(responsesByLevelId.get(l.dnx_assessment_levelid)))
      .map((l) => l.dnx_assessment_levelid),
  );

  // Persist one accepted suggestion through the normal upsert path so autosave,
  // version bump, and the AI badge all flow through the same code. The `ai`
  // payload flags the row as AI-populated with its confidence + rationale.
  const handleAcceptSuggestion = ({ level, suggestion }: AcceptedSuggestion) => {
    upsert.mutate({
      instanceId: assessment!.dnx_assessment_instanceid,
      levelId: level.dnx_assessment_levelid,
      questionName: level.dnx_name,
      dataType: (level.dnx_data_type ?? 3) as DataType,
      value: suggestion.value,
      ai: {
        confidence: suggestion.confidence,
        sourceSummary: suggestion.rationale,
        sourceAttributes: suggestion.usedAttributes,
      },
    });
  };

  if (isLoading) return <Spinner label="Loading assessment..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!assessment) return null;

  const label =
    Dnx_assessment_instancesstatuscode[
      assessment.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft';
  const status = STATUS_STYLES[label] ?? STATUS_STYLES.Draft;
  const templateId = lookupId(assessment, 'dnx_assessmenttemplate');
  const projectId = lookupId(assessment, 'dnx_project');
  const templateName = lookupName(assessment, 'dnx_assessmenttemplate');
  const projectName = lookupName(assessment, 'dnx_project');
  const assessor = lookupName(assessment, 'ownerid');

  return (
    <div>
      <Link to="/assessments" className={styles.backLink}>
        <ChevronLeft16Regular /> Back to assessments
      </Link>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconChip}>
            <ClipboardTaskListLtr20Regular />
          </div>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{assessment.dnx_assessment_name}</h1>
            <div className={styles.metaRow}>
              <span
                className={styles.statusPill}
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
              {assessment.dnx_duedate && (
                <span>Due {new Date(assessment.dnx_duedate).toLocaleDateString()}</span>
              )}
              {assessment.dnx_version !== undefined && assessment.dnx_version !== null && (
                <span>v{assessment.dnx_version}</span>
              )}
              <SaveBadge upsert={upsert} lastSavedAt={lastSavedAt} />
              <HeroOutcomeChip
                styles={styles}
                persisted={
                  assessment.dnx_outcome as 0 | 1 | 2 | undefined | null
                }
                live={liveOutcome}
                statusLabel={label}
              />
            </div>
          </div>
        </div>
        {/* Hero actions — Submit only while editable; the outcome letter is
            always available so reviewers can preview / print at any point. */}
        {templateId && (
          <div className={styles.headerActions}>
            <Button
              appearance="secondary"
              icon={<Comment20Regular />}
              onClick={() => setCommentsOpen(true)}
            >
              Comments{generalCommentCount > 0 ? ` (${generalCommentCount})` : ''}
            </Button>
            <Button
              appearance="secondary"
              icon={<History20Regular />}
              onClick={() => setHistoryOpen(true)}
            >
              History
            </Button>
            <LetterDialog
              assessment={assessment}
              trigger={
                <Button appearance="secondary" icon={<DocumentText20Regular />}>
                  View letter
                </Button>
              }
            />
            {label !== 'PendingReview' && label !== 'Complete' && roles.canAssess && (
              <SubmitAssessmentDialog
                instanceId={assessment.dnx_assessment_instanceid}
                templateId={templateId}
                alreadySubmitted={false}
                trigger={
                  <Button appearance="primary" icon={<SendCopy20Regular />}>
                    Submit for review
                  </Button>
                }
              />
            )}
          </div>
        )}
      </div>

      <CommentsDrawer
        instanceId={assessment.dnx_assessment_instanceid}
        templateId={templateId ?? undefined}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
      <VersionHistoryDrawer
        instanceId={assessment.dnx_assessment_instanceid}
        templateId={templateId ?? undefined}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      <div className={styles.card}>
        <div className={styles.cardHeader}>Overview</div>
        <div className={styles.cardBody}>
          <div className={styles.fieldsGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Project</span>
              <span className={styles.fieldValue}>
                {projectId && projectName ? (
                  <Link to={`/projects/${projectId}`} className={styles.projectLink}>
                    {projectName}
                  </Link>
                ) : (
                  projectName ?? '—'
                )}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Template</span>
              <span className={styles.fieldValue}>
                {templateId && templateName ? (
                  <Link
                    to={`/templates/${templateId}/edit`}
                    className={styles.templateLink}
                  >
                    {templateName}
                  </Link>
                ) : (
                  templateName ?? '—'
                )}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Assessor</span>
              <span className={styles.fieldValue}>{assessor ?? '—'}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Created</span>
              <span className={styles.fieldValue}>
                {assessment.createdon
                  ? new Date(assessment.createdon).toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Last modified</span>
              <span className={styles.fieldValue}>
                {assessment.modifiedon
                  ? new Date(assessment.modifiedon).toLocaleString()
                  : '—'}
              </span>
            </div>
            {assessment.dnx_submittedon && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Submitted</span>
                <span className={styles.fieldValue}>
                  {new Date(assessment.dnx_submittedon).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApplicationDetailsCard
        instanceId={assessment.dnx_assessment_instanceid}
        detailsName={assessment.dnx_application_details_name}
        disabled={label === 'PendingReview' || label === 'Complete' || !roles.canAssess}
        requiredPaths={requiredAppDataPaths}
      />

      <ReviewerFeedbackBanner assessment={assessment} statusLabel={label} />

      {label === 'PendingReview' && roles.canReview && (
        <div className={styles.reviewerPanel}>
          <div className={styles.reviewerMark}>
            <PersonStar16Regular />
          </div>
          <div className={styles.reviewerCopy}>
            <span className={styles.reviewerTitle}>Reviewer actions</span>
            <span className={styles.reviewerSub}>
              {assessment.dnx_submittedon
                ? `Submitted on ${new Date(assessment.dnx_submittedon).toLocaleDateString()}. `
                : ''}
              Approve to finalise the outcome, or send back to the assessor with notes.
            </span>
          </div>
          <div className={styles.reviewerActions}>
            <RejectAssessmentDialog
              instanceId={assessment.dnx_assessment_instanceid}
              templateId={templateId ?? ''}
              trigger={
                <Button
                  className={styles.rejectBtn}
                  appearance="secondary"
                  icon={<DismissCircle16Regular />}
                >
                  Send back
                </Button>
              }
            />
            <ApproveAssessmentDialog
              instanceId={assessment.dnx_assessment_instanceid}
              trigger={
                <Button
                  className={styles.approveBtn}
                  appearance="primary"
                  icon={<CheckmarkCircle16Regular />}
                >
                  Approve
                </Button>
              }
            />
          </div>
        </div>
      )}

      <EvidenceCard
        assessmentName={assessment.dnx_assessment_name}
        disabled={label === 'PendingReview' || label === 'Complete'}
        onAiPopulate={
          label === 'PendingReview' || label === 'Complete' || !roles.canAssess
            ? undefined
            : () => setAiOpen(true)
        }
      />

      <AiPopulateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        assessmentName={assessment.dnx_assessment_name}
        questions={aiQuestions}
        answeredLevelIds={answeredLevelIds}
        availableFiles={(evidenceFiles ?? []).map((f) => f.fileName)}
        persistedMappingJson={assessment.dnx_evidence_mapping}
        onPersistMapping={(mapping) => saveMapping.mutate(mapping)}
        onAccept={handleAcceptSuggestion}
        applicationData={applicationData}
      />

      {templateId ? (
        <ChecklistRenderer
          instanceId={assessment.dnx_assessment_instanceid}
          templateId={templateId}
          upsert={upsert}
          readOnly={label === 'PendingReview' || label === 'Complete'}
          pendingReview={label === 'PendingReview'}
          submittedOn={assessment.dnx_submittedon}
          canAssess={roles.canAssess}
          applicationData={applicationData}
        />
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.placeholderTitle}>Template missing</div>
          This assessment has no template linked. Open the instance in Dataverse to
          set one before answering.
        </div>
      )}

    </div>
  );
}

/**
 * Reviewer feedback banner — shown whenever `dnx_outcome_notes` is set.
 *
 * Three color variants by (status, outcome):
 *   - Complete + Suitable    → green   "Approved"
 *   - Complete + NotSuitable → red     "Marked not suitable"
 *   - InProgress + notes     → amber   "Sent back by reviewer"
 *
 * Persists across reopen cycles so the assessor always sees what the
 * reviewer said while they're fixing things up.
 */
function ReviewerFeedbackBanner({
  assessment,
  statusLabel,
}: {
  assessment: import('../../generated/models/Dnx_assessment_instancesModel').Dnx_assessment_instances;
  statusLabel: string;
}) {
  const styles = useStyles();
  const notes = assessment.dnx_outcome_notes?.trim();
  if (!notes) return null;

  const outcome = assessment.dnx_outcome;
  let title = 'Reviewer feedback';
  let bg = 'var(--color-amber-soft)';
  let borderColor = 'var(--color-amber)';
  let titleColor = 'var(--color-amber-text)';

  if (statusLabel === 'Complete' && outcome === 0) {
    title = 'Approved — suitable';
    bg = 'var(--color-green-soft)';
    borderColor = 'var(--color-green)';
    titleColor = 'var(--color-green-text)';
  } else if (statusLabel === 'Complete' && outcome === 1) {
    title = 'Reviewed — not suitable';
    bg = 'var(--color-red-soft)';
    borderColor = 'var(--color-red)';
    titleColor = 'var(--color-red-text)';
  } else if (statusLabel === 'InProgress' || statusLabel === 'Draft') {
    title = 'Sent back by reviewer';
  } else {
    // PendingReview shouldn't have notes yet (reviewer hasn't acted).
    // If something else odd, fall through with the default amber.
    return null;
  }

  return (
    <div
      className={styles.feedbackBanner}
      style={{ backgroundColor: bg, borderColor }}
    >
      <span className={styles.feedbackTitle} style={{ color: titleColor }}>
        {title}
      </span>
      <div className={styles.feedbackBody}>{notes}</div>
    </div>
  );
}

/**
 * Tiny inline pill that surfaces the autosave state for the checklist.
 *
 *   pending   → purple pulse + "Saving..."
 *   error     → red filled-circle + "Save failed"
 *   saved     → green checkmark + "Saved at HH:MM"
 *   nothing yet → muted "Autosave on"
 */
interface SaveBadgeProps {
  upsert: ReturnType<typeof useUpsertResponse>;
  lastSavedAt: Date | null;
}
function SaveBadge({ upsert, lastSavedAt }: SaveBadgeProps) {
  const styles = useStyles();
  if (upsert.isPending) {
    return (
      <span className={`${styles.saveBadge} ${styles.saveBadgeSaving}`} aria-live="polite">
        <span className={styles.spinDot} aria-hidden />
        Saving...
      </span>
    );
  }
  if (upsert.isError) {
    return (
      <span className={`${styles.saveBadge} ${styles.saveBadgeError}`} aria-live="polite">
        <ErrorCircle16Filled />
        Save failed — retry
      </span>
    );
  }
  if (lastSavedAt) {
    const time = lastSavedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <span className={`${styles.saveBadge} ${styles.saveBadgeSaved}`} aria-live="polite">
        <CheckmarkCircle16Filled />
        Saved at {time}
      </span>
    );
  }
  return <span className={`${styles.saveBadge} ${styles.saveBadgeIdle}`}>Autosave on</span>;
}

/**
 * Hero outcome chip — what verdict this assessment carries right now.
 *
 * Source of truth depends on status:
 *   - **Draft / InProgress** → live preview computed from current answers
 *     (matches the chip inside the checklist banner; gives feedback while
 *     editing).
 *   - **PendingReview / Complete** → persisted `dnx_outcome` written by
 *     submit or reviewer approval. Live preview is hidden here so the
 *     hero doesn't disagree with what was actually saved.
 *
 * Renders nothing when there's no signal yet (no rules, no answers, no
 * persisted value) to avoid a perpetually empty / Pending pill cluttering
 * the meta row.
 */
interface HeroOutcomeChipProps {
  styles: ReturnType<typeof useStyles>;
  persisted: 0 | 1 | 2 | undefined | null;
  live: EvaluationOutcome;
  statusLabel: string;
}
function HeroOutcomeChip({ styles, persisted, live, statusLabel }: HeroOutcomeChipProps) {
  const isLocked = statusLabel === 'PendingReview' || statusLabel === 'Complete';
  // Locked status: trust the persisted value. Pending (2) means submitted
  // without a definitive verdict — render a muted "Pending" so reviewers
  // know an actual decision is still required.
  if (isLocked) {
    if (persisted === 0) {
      return (
        <Tooltip
          content="Outcome recorded at submission / approval."
          relationship="description"
          withArrow
        >
          <span className={`${styles.outcomeChip} ${styles.outcomeChipPass}`}>
            Suitable
          </span>
        </Tooltip>
      );
    }
    if (persisted === 1) {
      return (
        <Tooltip
          content="Outcome recorded at submission / approval."
          relationship="description"
          withArrow
        >
          <span className={`${styles.outcomeChip} ${styles.outcomeChipFail}`}>
            Not suitable
          </span>
        </Tooltip>
      );
    }
    return null;
  }
  // Draft / InProgress: live preview only.
  if (live.kind === 'pass') {
    return (
      <Tooltip
        content={live.explanation ?? 'Live preview based on current answers.'}
        relationship="description"
        withArrow
      >
        <span className={`${styles.outcomeChip} ${styles.outcomeChipPass}`}>
          Suitable (preview)
        </span>
      </Tooltip>
    );
  }
  if (live.kind === 'fail') {
    return (
      <Tooltip
        content={live.explanation ?? 'Live preview based on current answers.'}
        relationship="description"
        withArrow
      >
        <span className={`${styles.outcomeChip} ${styles.outcomeChipFail}`}>
          Not suitable (preview)
        </span>
      </Tooltip>
    );
  }
  return null;
}

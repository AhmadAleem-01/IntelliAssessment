import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Field,
  Textarea,
  Dropdown,
  Option,
  OptionGroup,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  DismissCircle20Filled,
  Flag16Regular,
  Dismiss12Regular,
  Add16Regular,
} from '@fluentui/react-icons';
import { useRejectAssessment, useCreateReviewerComments } from './api';
import { useTemplateLevels } from '../templates/levels/api';
import {
  groupByParent,
  type EligibleQuestion,
} from '../templates/levels/eligibleParents';
import { lookupId } from '../../lib/dataverse';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '560px',
    width: '94vw',
  },
  content: { paddingTop: '4px', paddingBottom: '4px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    marginBottom: '18px',
  },
  headerMark: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  headerSub: { fontSize: '12px', color: 'var(--color-text-secondary)' },
  fields: { display: 'flex', flexDirection: 'column', gap: '16px' },
  flagsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  flagsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  flagsSub: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  flagPicker: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  flagPickerField: { flex: 1, minWidth: 0 },
  flagList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  flagCard: {
    padding: '10px 12px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-amber-soft)',
    border: '0.5px solid var(--color-amber)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  flagCardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  },
  flagPath: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-amber-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  flagLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginTop: '1px',
  },
  removeBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-amber-text)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.06)',
    },
  },
  rejectBtn: {
    backgroundColor: 'var(--color-amber) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-amber) !important',
    ':hover': {
      backgroundColor: 'var(--color-amber-text) !important',
      border: '0.5px solid var(--color-amber-text) !important',
    },
  },
});

interface Flag {
  levelId: string;
  levelName: string;
  path: string;
  note: string;
}

interface Props {
  instanceId: string;
  templateId: string;
  trigger: React.ReactElement;
}

export function RejectAssessmentDialog({ instanceId, templateId, trigger }: Props) {
  const styles = useStyles();
  const reject = useRejectAssessment(instanceId);
  const createFlags = useCreateReviewerComments(instanceId);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState<Flag[]>([]);
  const [picker, setPicker] = useState<string>('');

  // All visible-eligible questions in this template, grouped by parent path
  // for the dropdown. Reuses the same helper that powers the visibility editor.
  const { data: levels } = useTemplateLevels(templateId);
  const allQuestions = useMemo(
    () => eligibleParentsAcceptingAll(levels),
    [levels],
  );
  const grouped = useMemo(() => groupByParent(allQuestions), [allQuestions]);
  const flaggedIds = new Set(flags.map((f) => f.levelId));
  const available = allQuestions.filter((q) => !flaggedIds.has(q.id));

  function reset() {
    setNotes('');
    setFlags([]);
    setPicker('');
    reject.reset();
    createFlags.reset();
  }

  function addFlag() {
    if (!picker) return;
    const q = allQuestions.find((x) => x.id === picker);
    if (!q || flaggedIds.has(q.id)) return;
    setFlags((prev) => [
      ...prev,
      { levelId: q.id, levelName: q.label, path: q.parentPath, note: '' },
    ]);
    setPicker('');
  }

  function removeFlag(levelId: string) {
    setFlags((prev) => prev.filter((f) => f.levelId !== levelId));
  }

  function updateFlagNote(levelId: string, note: string) {
    setFlags((prev) => prev.map((f) => (f.levelId === levelId ? { ...f, note } : f)));
  }

  async function handleReject() {
    if (!notes.trim()) return;
    // Create flags first so they exist by the time the assessor reopens.
    if (flags.length > 0) {
      try {
        await createFlags.mutateAsync(
          flags.map((f) => ({
            levelId: f.levelId,
            levelName: f.levelName,
            commentText: f.note.trim() || '(no specific notes)',
          })),
        );
      } catch {
        // The mutation already logged; bail without flipping status so the
        // reviewer can retry without ending up in a half-done state.
        return;
      }
    }
    await reject.mutateAsync({ notes });
    setOpen(false);
  }

  const isPending = reject.isPending || createFlags.isPending;
  const lastError = (reject.error as Error | null) ?? (createFlags.error as Error | null);

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (!d.open) reset();
      }}
    >
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.header}>
              <div className={styles.headerMark}>
                <DismissCircle20Filled />
              </div>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>Reject and send back</span>
                <span className={styles.headerSub}>
                  Send the assessment back to the assessor for changes. Flag specific
                  questions so they know exactly where to look.
                </span>
              </div>
            </div>

            {lastError && (
              <MessageBar intent="error" style={{ marginBottom: 14 }}>
                <MessageBarBody>{lastError.message}</MessageBarBody>
              </MessageBar>
            )}

            <div className={styles.fields}>
              <Field
                label="What needs to change?"
                required
                hint="Required. Overall message — visible at the top of the assessment."
              >
                <Textarea
                  value={notes}
                  onChange={(_, d) => setNotes(d.value)}
                  rows={3}
                  resize="vertical"
                  placeholder="e.g. The qualification evidence doesn't match section 2 — please re-check before resubmitting."
                  autoFocus
                />
              </Field>

              <div className={styles.flagsSection}>
                <div className={styles.flagsHeader}>
                  <Flag16Regular />
                  Flag specific questions (optional)
                </div>
                <div className={styles.flagsSub}>
                  Tag any questions that need attention so the assessor can jump straight
                  to them. Each flag gets its own note.
                </div>

                {available.length > 0 && (
                  <div className={styles.flagPicker}>
                    <Field label="Pick a question" className={styles.flagPickerField}>
                      <Dropdown
                        value={
                          picker
                            ? `${allQuestions.find((q) => q.id === picker)?.parentPath ?? ''} › ${allQuestions.find((q) => q.id === picker)?.label ?? ''}`
                            : ''
                        }
                        selectedOptions={picker ? [picker] : []}
                        onOptionSelect={(_, d) => setPicker(d.optionValue ?? '')}
                        placeholder="Search questions..."
                      >
                        {grouped
                          .map((group) => ({
                            group,
                            availableInGroup: group.questions.filter(
                              (q) => !flaggedIds.has(q.id),
                            ),
                          }))
                          .filter(({ availableInGroup }) => availableInGroup.length > 0)
                          .map(({ group, availableInGroup }) => (
                            <OptionGroup key={group.key} label={group.path}>
                              {availableInGroup.map((q) => (
                                <Option key={q.id} value={q.id}>
                                  {q.label}
                                </Option>
                              ))}
                            </OptionGroup>
                          ))}
                      </Dropdown>
                    </Field>
                    <Button
                      type="button"
                      appearance="secondary"
                      icon={<Add16Regular />}
                      disabled={!picker}
                      onClick={addFlag}
                    >
                      Add flag
                    </Button>
                  </div>
                )}

                {flags.length > 0 && (
                  <div className={styles.flagList}>
                    {flags.map((f) => (
                      <div key={f.levelId} className={styles.flagCard}>
                        <div className={styles.flagCardTop}>
                          <div>
                            {f.path && <div className={styles.flagPath}>{f.path}</div>}
                            <div className={styles.flagLabel}>{f.levelName}</div>
                          </div>
                          <button
                            type="button"
                            className={styles.removeBtn}
                            aria-label={`Remove flag on ${f.levelName}`}
                            onClick={() => removeFlag(f.levelId)}
                          >
                            <Dismiss12Regular />
                          </button>
                        </div>
                        <Textarea
                          value={f.note}
                          onChange={(_, d) => updateFlagNote(f.levelId, d.value)}
                          rows={2}
                          resize="vertical"
                          placeholder="Optional: what's wrong with this answer?"
                          style={{ width: '100%' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              className={styles.rejectBtn}
              type="button"
              onClick={handleReject}
              disabled={!notes.trim() || isPending}
            >
              {isPending
                ? 'Sending back...'
                : flags.length > 0
                  ? `Send back with ${flags.length} flag${flags.length === 1 ? '' : 's'}`
                  : 'Send back'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * eligibleParents() filters to questions whose data type can drive visibility
 * rules (Boolean / OptionSet / Multi). For flagging we want EVERY question —
 * including Text / Date — so this thin wrapper drops the data-type filter and
 * uses the same parent-path indexing logic.
 */
function eligibleParentsAcceptingAll(
  allLevels: ReturnType<typeof useTemplateLevels>['data'],
): EligibleQuestion[] {
  if (!allLevels) return [];
  const byId = new Map(allLevels.map((l) => [l.dnx_assessment_levelid, l] as const));
  const out: EligibleQuestion[] = [];
  for (const level of allLevels) {
    if (level.dnx_assessment_level_type !== 3) continue;
    const dataType = level.dnx_data_type;
    if (dataType === undefined || dataType === null) continue;
    const labels: string[] = [];
    const ids: string[] = [];
    let parentId = lookupId(level, 'dnx_parent_assessment_level');
    for (let i = 0; i < 8 && parentId; i++) {
      const parent = byId.get(parentId);
      if (!parent) break;
      labels.unshift(parent.dnx_name);
      ids.unshift(parent.dnx_assessment_levelid);
      parentId = lookupId(parent, 'dnx_parent_assessment_level');
    }
    out.push({
      id: level.dnx_assessment_levelid,
      label: level.dnx_name,
      dataType: dataType as EligibleQuestion['dataType'],
      options: [],
      parentPath: labels.join(' › ') || 'Unfiled',
      parentKey: ids.join('/') || '__root__',
    });
  }
  return out;
}

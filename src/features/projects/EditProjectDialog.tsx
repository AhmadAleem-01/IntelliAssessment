import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  Button,
  Input,
  Textarea,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Dismiss20Regular, LockClosed16Filled } from '@fluentui/react-icons';
import { useUpdateProject } from './api';
import { STATUS_TO_CODE, CODE_TO_STATUS, type StatusKey } from './ProjectFormFields';
import { lookupName } from '../../lib/dataverse';
import type { Dnx_projects } from '../../generated/models/Dnx_projectsModel';

/*
 * Edit project — bespoke dialog (design.md). Header with a stats subline + close
 * X, character counters, a locked code field (locked once assessments reference
 * it), a read-only owner, and Status as three selectable cards. Save is disabled
 * until something actually changes (dirty tracking).
 */
const NAME_MAX = 80;
const DESC_MAX = 240;

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '620px',
    width: '94vw',
    // Fluent's DialogSurface ships its own 24px padding via a higher-specificity
    // atomic class — force it off so ONLY the inner section paddings apply,
    // otherwise the two compound and the layout looks edge-to-edge/cramped.
    padding: '0 !important',
    border: '1px solid var(--ds-border)',
    // Float with a gap from the viewport edges + cap height so a tall form
    // scrolls inside the modal instead of pinning to the top edge.
    maxHeight: 'calc(100vh - 64px)',
    marginTop: '32px',
    marginBottom: '32px',
    boxShadow: '0 24px 64px -16px rgba(17, 24, 39, 0.35)',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 64px)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '28px 36px 0',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  title: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  sub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--ds-text-muted)',
    padding: '2px',
    borderRadius: '6px',
    display: 'flex',
    ':hover': { color: 'var(--ds-text-strong)', backgroundColor: 'var(--ds-surface-base)' },
  },

  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    padding: '22px 36px 26px',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  labelRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' },
  label: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  counter: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', fontVariantNumeric: 'tabular-nums' },
  hint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  input: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    '::after': { display: 'none' },
  },
  textarea: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    '::after': { display: 'none' },
    '& textarea': { minHeight: '76px' },
  },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', '@media (max-width: 520px)': { gridTemplateColumns: '1fr' } },
  lockedField: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-body)',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--ds-fs-caption)',
    letterSpacing: '0.04em',
  },
  lockedCode: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  lockIcon: { color: 'var(--ds-pending)', flexShrink: 0 },
  ownerBox: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-body)',
  },

  /* Status cards */
  statusCards: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', '@media (max-width: 520px)': { gridTemplateColumns: '1fr' } },
  statusCard: {
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    transition: 'border-color 0.1s ease, background-color 0.1s ease',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
  },
  statusCardActive: {
    borderColor: 'var(--ds-brand-accent)',
    backgroundColor: 'var(--ds-brand-accent-soft)',
  },
  statusTop: { display: 'inline-flex', alignItems: 'center', gap: '7px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  statusName: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  statusDesc: { fontSize: '11px', color: 'var(--ds-text-muted)', lineHeight: 1.4 },

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '18px 36px',
    borderTop: '1px solid var(--ds-border)',
    flexShrink: 0,
  },
  dirtyNote: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  footerBtns: { display: 'flex', gap: '8px' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: 'var(--ds-brand-accent-hover)', color: '#fff' },
    ':disabled': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)' },
  },
});

/** Status options shown as cards (design copy per the mockup). "Paused" = OnHold. */
const STATUS_CARDS: { key: StatusKey; name: string; desc: string; dot: string }[] = [
  { key: 'Active', name: 'Active', desc: 'Visible everywhere. Accepts new assessments.', dot: 'var(--ds-suitable)' },
  { key: 'OnHold', name: 'Paused', desc: 'Hidden from the picker. Open work continues.', dot: 'var(--ds-pending)' },
  { key: 'Archived', name: 'Archived', desc: 'Read-only. Moves out of the project list.', dot: 'var(--ds-text-muted)' },
];

interface Props {
  project: Dnx_projects;
  trigger: React.ReactElement;
  /** How many assessments reference this project (locks the code, shown in subline). */
  assessmentCount?: number;
}

export function EditProjectDialog({ project, trigger, assessmentCount }: Props) {
  const styles = useStyles();
  const update = useUpdateProject(project.dnx_projectid);
  const [open, setOpen] = useState(false);

  const initial = {
    name: project.dnx_project_name,
    description: project.dnx_description ?? '',
    status: CODE_TO_STATUS[project.statuscode ?? 1] ?? 'Active',
  };
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState<StatusKey>(initial.status);

  const code = project.dnx_project_code ?? '';
  const owner = lookupName(project, 'ownerid');
  const editedBy = lookupName(project, 'modifiedby');
  const editedOn = project.modifiedon
    ? new Date(project.modifiedon).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;
  const codeLocked = code.length > 0 && (assessmentCount ?? 0) > 0;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Re-sync from the record only on open — never during typing.
      setName(project.dnx_project_name);
      setDescription(project.dnx_description ?? '');
      setStatus(CODE_TO_STATUS[project.statuscode ?? 1] ?? 'Active');
      update.reset();
    }
  }

  const dirty =
    name.trim() !== initial.name ||
    description.trim() !== initial.description.trim() ||
    status !== initial.status;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dirty) return;
    await update.mutateAsync({
      dnx_project_name: name.trim(),
      // Code is not editable here (locked / preserved as-is).
      dnx_project_code: code || undefined,
      dnx_description: description.trim() || undefined,
      statuscode: STATUS_TO_CODE[status],
    });
    setOpen(false);
  }

  const subParts = [
    code || null,
    assessmentCount !== undefined ? `${assessmentCount} assessment${assessmentCount === 1 ? '' : 's'}` : null,
    editedOn ? `last edited ${editedOn}${editedBy ? ` by ${editedBy}` : ''}` : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(_, d) => handleOpenChange(d.open)}>
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <form onSubmit={handleSubmit} className={styles.inner}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <span className={styles.title}>Edit project</span>
              {subParts.length > 0 && <span className={styles.sub}>{subParts.join(' · ')}</span>}
            </div>
            <DialogTrigger disableButtonEnhancement>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <Dismiss20Regular />
              </button>
            </DialogTrigger>
          </div>

          <div className={styles.body}>
            {update.error && (
              <MessageBar intent="error">
                <MessageBarBody>{(update.error as Error).message}</MessageBarBody>
              </MessageBar>
            )}

            {/* Name */}
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Project name</span>
                <span className={styles.counter}>
                  {name.length}/{NAME_MAX}
                </span>
              </div>
              <Input
                className={styles.input}
                appearance="outline"
                value={name}
                maxLength={NAME_MAX}
                autoFocus
                onChange={(_, d) => setName(d.value)}
              />
              <span className={styles.hint}>
                Appears on the project card and in every assessment breadcrumb.
              </span>
            </div>

            {/* Code (locked) + Owner (read-only) */}
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <span className={styles.label}>Project code</span>
                <div className={styles.lockedField}>
                  <span className={styles.lockedCode}>{code || '—'}</span>
                  {codeLocked && (
                    <span className={styles.lockIcon} title="Locked">
                      <LockClosed16Filled />
                    </span>
                  )}
                </div>
                <span className={styles.hint}>
                  {codeLocked
                    ? `Locked — ${assessmentCount} assessment${assessmentCount === 1 ? '' : 's'} reference this code.`
                    : 'Short reference code.'}
                </span>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Owner</span>
                <div className={styles.ownerBox}>{owner ?? 'Unassigned'}</div>
                <span className={styles.hint}>Receives overdue notifications.</span>
              </div>
            </div>

            {/* Description */}
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Description</span>
                <span className={styles.counter}>
                  {description.length}/{DESC_MAX}
                </span>
              </div>
              <Textarea
                className={styles.textarea}
                appearance="outline"
                value={description}
                maxLength={DESC_MAX}
                resize="vertical"
                onChange={(_, d) => setDescription(d.value)}
              />
              <span className={styles.hint}>Shown on the project card. First two lines are visible.</span>
            </div>

            {/* Status cards */}
            <div className={styles.field}>
              <span className={styles.label}>Status</span>
              <div className={styles.statusCards} role="radiogroup" aria-label="Status">
                {STATUS_CARDS.map((s) => {
                  const active = status === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.statusCard} ${active ? styles.statusCardActive : ''}`}
                      onClick={() => setStatus(s.key)}
                    >
                      <span className={styles.statusTop}>
                        <span className={styles.statusDot} style={{ backgroundColor: s.dot }} />
                        <span className={styles.statusName}>{s.name}</span>
                      </span>
                      <span className={styles.statusDesc}>{s.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <span className={styles.dirtyNote}>
              {update.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : 'No changes yet'}
            </span>
            <div className={styles.footerBtns}>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" type="button">
                  Cancel
                </Button>
              </DialogTrigger>
              <Button
                className={styles.primaryBtn}
                appearance="primary"
                type="submit"
                disabled={!name.trim() || !dirty || update.isPending}
              >
                {update.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

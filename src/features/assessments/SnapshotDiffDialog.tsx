import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { lookupId } from '../../lib/dataverse';
import { useTemplateLevels } from '../templates/levels/api';
import {
  fetchSnapshotJson,
  useAssessmentInstance,
  useAssessmentResponses,
  type AssessmentSnapshot,
} from './api';
import { readResponseValue } from './responseHelpers';
import type { DataType } from '../templates/levels/levelTypes';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '960px',
    width: '94vw',
  },
  content: { padding: '0', maxHeight: '76vh', overflow: 'auto' },
  header: {
    padding: '16px 22px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  headerSub: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    marginTop: '3px',
  },
  loadingPad: {
    padding: '60px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  section: {
    padding: '14px 22px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    ':last-child': { borderBottom: 'none' },
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '8px',
  },
  diffRow: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 1fr',
    gap: '12px',
    padding: '6px 0',
    fontSize: '12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    alignItems: 'start',
    ':last-child': { borderBottom: 'none' },
  },
  diffLabel: {
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  diffPath: {
    fontSize: '10px',
    fontWeight: 400,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    marginTop: '2px',
  },
  cell: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-background-secondary)',
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--color-text-primary)',
    minHeight: '20px',
  },
  cellChangedFrom: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
  },
  cellChangedTo: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
  },
  cellEmpty: {
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    margin: '12px 0 4px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  badgeChanged: {
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
  },
  badgeAdded: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
  },
  badgeRemoved: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
  },
  badgeUnchanged: {
    backgroundColor: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    padding: '8px 0',
    fontStyle: 'italic',
  },
  columnHeader: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 1fr',
    gap: '12px',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
});

interface Props {
  versionRowId: string | null;
  versionNumber: string | undefined;
  capturedAt: string | undefined;
  reason: string | undefined;
  instanceId: string;
  templateId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Side-by-side comparison of a historical snapshot against the current
 * instance state. Read-only — no revert path wired yet. Used to scope what
 * would change before any write happens.
 *
 * The "now" side is built from the same React Query caches the rest of the
 * page reads, so opening the dialog doesn't cost extra round-trips.
 */
export function SnapshotDiffDialog({
  versionRowId,
  versionNumber,
  capturedAt,
  reason,
  instanceId,
  templateId,
  open,
  onOpenChange,
}: Props) {
  const styles = useStyles();
  const { data: instance } = useAssessmentInstance(open ? instanceId : undefined);
  const { data: levels } = useTemplateLevels(open ? templateId : undefined);
  const { data: responses } = useAssessmentResponses(open ? instanceId : undefined);
  const [snapshot, setSnapshot] = useState<AssessmentSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch the snapshot JSON the first time the dialog opens for a given row.
  useEffect(() => {
    if (!open || !versionRowId) return;
    let cancelled = false;
    setSnapshot(null);
    setLoadError(null);
    fetchSnapshotJson(versionRowId)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, versionRowId]);

  const diff = useMemo(() => {
    if (!snapshot || !levels) return null;
    return buildDiff(snapshot, instance, levels, responses ?? []);
  }, [snapshot, instance, levels, responses]);

  const formattedCapturedAt = capturedAt
    ? new Date(capturedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                Compare v{versionNumber ?? '?'} ({reason ?? 'Snapshot'}) to current
              </div>
              <div className={styles.headerSub}>
                Captured {formattedCapturedAt}. Differences highlighted; left is the
                snapshot, right is the current state.
              </div>
            </div>

            {loadError && (
              <div className={styles.section}>
                <MessageBar intent="error">
                  <MessageBarBody>{loadError}</MessageBarBody>
                </MessageBar>
              </div>
            )}

            {!snapshot && !loadError && (
              <div className={styles.loadingPad}>
                <Spinner size="small" label="Loading snapshot…" />
              </div>
            )}

            {snapshot && diff && (
              <>
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Summary</div>
                  <div className={styles.summary}>
                    <span className={`${styles.badge} ${styles.badgeChanged}`}>
                      {diff.changedCount} changed
                    </span>
                    <span className={`${styles.badge} ${styles.badgeAdded}`}>
                      {diff.addedCount} added since
                    </span>
                    <span className={`${styles.badge} ${styles.badgeRemoved}`}>
                      {diff.removedCount} removed since
                    </span>
                    <span className={`${styles.badge} ${styles.badgeUnchanged}`}>
                      {diff.unchangedCount} unchanged
                    </span>
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Instance metadata</div>
                  <div className={styles.columnHeader}>
                    <span>Field</span>
                    <span>Snapshot</span>
                    <span>Current</span>
                  </div>
                  {diff.instanceRows.length === 0 ? (
                    <div className={styles.empty}>
                      No instance-level differences.
                    </div>
                  ) : (
                    diff.instanceRows.map((row) => (
                      <DiffRow key={row.label} row={row} styles={styles} />
                    ))
                  )}
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Responses</div>
                  <div className={styles.columnHeader}>
                    <span>Question</span>
                    <span>Snapshot answer</span>
                    <span>Current answer</span>
                  </div>
                  {diff.responseRows.length === 0 ? (
                    <div className={styles.empty}>
                      No response differences.
                    </div>
                  ) : (
                    diff.responseRows.map((row) => (
                      <DiffRow key={row.levelId} row={row} styles={styles} />
                    ))
                  )}
                </div>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                Close
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

interface DiffRowData {
  label: string;
  /** Optional secondary line — used to show breadcrumb paths for questions. */
  path?: string;
  /** Stable key per row. */
  levelId?: string;
  before: string;
  after: string;
  kind: 'changed' | 'added' | 'removed' | 'unchanged';
}

function DiffRow({
  row,
  styles,
}: {
  row: DiffRowData;
  styles: ReturnType<typeof useStyles>;
}) {
  const beforeClass =
    row.kind === 'changed'
      ? styles.cellChangedFrom
      : row.kind === 'removed'
        ? styles.cellChangedFrom
        : '';
  const afterClass =
    row.kind === 'changed'
      ? styles.cellChangedTo
      : row.kind === 'added'
        ? styles.cellChangedTo
        : '';
  return (
    <div className={styles.diffRow}>
      <div>
        <div className={styles.diffLabel}>{row.label}</div>
        {row.path && <div className={styles.diffPath}>{row.path}</div>}
      </div>
      <div className={`${styles.cell} ${beforeClass}`}>
        <Value text={row.before} styles={styles} />
      </div>
      <div className={`${styles.cell} ${afterClass}`}>
        <Value text={row.after} styles={styles} />
      </div>
    </div>
  );
}

function Value({
  text,
  styles,
}: {
  text: string;
  styles: ReturnType<typeof useStyles>;
}) {
  if (!text) return <span className={styles.cellEmpty}>(empty)</span>;
  return <>{text}</>;
}

/**
 * Compute the row arrays the dialog renders. Two passes:
 *   1. Instance metadata — compare a fixed set of fields.
 *   2. Responses — index both sides by levelId, walk the union.
 *
 * Unchanged rows are suppressed from `instanceRows` / `responseRows` to keep
 * the dialog scannable; the unchanged count still feeds the summary chip.
 */
function buildDiff(
  snapshot: AssessmentSnapshot,
  current: Dnx_assessment_instances | undefined,
  levels: Dnx_assessment_levels[],
  currentResponses: Dnx_assessment_responses[],
) {
  const statusName = (code: number | undefined) =>
    code === undefined
      ? '—'
      : Dnx_assessment_instancesstatuscode[
          code as keyof typeof Dnx_assessment_instancesstatuscode
        ] ?? String(code);

  const outcomeName = (n: number | null | undefined) =>
    n === 0
      ? 'Suitable'
      : n === 1
        ? 'Not suitable'
        : n === 2
          ? 'Pending'
          : '—';

  const instanceCandidates: Array<{ label: string; before: string; after: string }> = [
    {
      label: 'Name',
      before: snapshot.instance.name ?? '—',
      after: current?.dnx_assessment_name ?? '—',
    },
    {
      label: 'Status',
      before: statusName(snapshot.instance.statuscode),
      after: statusName(current?.statuscode),
    },
    {
      label: 'Outcome',
      before: outcomeName(snapshot.instance.outcome),
      after: outcomeName(current?.dnx_outcome),
    },
    {
      label: 'Outcome notes',
      before: snapshot.instance.outcomeNotes ?? '',
      after: current?.dnx_outcome_notes ?? '',
    },
    {
      label: 'Due date',
      before: snapshot.instance.dueDate ?? '',
      after: current?.dnx_duedate ?? '',
    },
    {
      label: 'Submitted on',
      before: snapshot.instance.submittedOn ?? '',
      after: current?.dnx_submittedon ?? '',
    },
  ];

  const instanceRows: DiffRowData[] = [];
  let unchangedCount = 0;
  for (const c of instanceCandidates) {
    if (c.before === c.after) {
      unchangedCount += 1;
      continue;
    }
    instanceRows.push({
      label: c.label,
      before: c.before,
      after: c.after,
      kind: 'changed',
    });
  }

  // Index responses for fast diff. Snapshot has its own shape; current uses
  // the persisted columns and reads back through readResponseValue.
  const levelById = new Map<string, Dnx_assessment_levels>(
    levels.map((l) => [l.dnx_assessment_levelid, l] as const),
  );
  // Build section paths so the diff rows can show "Section › Subsection" hints.
  const pathById = new Map<string, string>();
  for (const lv of levels) {
    pathById.set(lv.dnx_assessment_levelid, buildLevelPath(lv, levelById));
  }

  const snapshotByLevel = new Map<string, AssessmentSnapshot['responses'][number]>();
  for (const r of snapshot.responses) {
    if (r.levelId) snapshotByLevel.set(r.levelId, r);
  }
  const currentByLevel = new Map<string, Dnx_assessment_responses>();
  for (const r of currentResponses) {
    const lid = lookupId(r, 'dnx_assessment_level');
    if (lid) currentByLevel.set(lid, r);
  }
  const allLevelIds = new Set<string>([
    ...snapshotByLevel.keys(),
    ...currentByLevel.keys(),
  ]);

  let changedCount = 0;
  let addedCount = 0;
  let removedCount = 0;
  const responseRows: DiffRowData[] = [];

  for (const levelId of allLevelIds) {
    const level = levelById.get(levelId);
    const dataType = (level?.dnx_data_type ?? 3) as DataType;
    const snapVal = snapshotByLevel.get(levelId);
    const currRow = currentByLevel.get(levelId);
    const beforeStr = snapVal ? formatSnapshotAnswer(snapVal, dataType) : '';
    const afterStr = currRow ? formatCurrentAnswer(currRow, dataType) : '';

    if (!snapVal && currRow) {
      addedCount += 1;
      responseRows.push({
        levelId,
        label: level?.dnx_name ?? '(unknown question)',
        path: pathById.get(levelId),
        before: '',
        after: afterStr,
        kind: 'added',
      });
      continue;
    }
    if (snapVal && !currRow) {
      removedCount += 1;
      responseRows.push({
        levelId,
        label: level?.dnx_name ?? snapVal.questionName ?? '(removed question)',
        path: pathById.get(levelId),
        before: beforeStr,
        after: '',
        kind: 'removed',
      });
      continue;
    }
    if (beforeStr === afterStr) {
      unchangedCount += 1;
      continue;
    }
    changedCount += 1;
    responseRows.push({
      levelId,
      label: level?.dnx_name ?? snapVal?.questionName ?? '(question)',
      path: pathById.get(levelId),
      before: beforeStr,
      after: afterStr,
      kind: 'changed',
    });
  }

  return {
    instanceRows,
    responseRows,
    changedCount: changedCount + instanceRows.length,
    addedCount,
    removedCount,
    unchangedCount,
  };
}

/** Walk parent pointers to build a Section › Subsection breadcrumb. */
function buildLevelPath(
  level: Dnx_assessment_levels,
  levelById: Map<string, Dnx_assessment_levels>,
): string {
  const parts: string[] = [];
  let cursor: Dnx_assessment_levels | undefined = level;
  let safety = 8;
  while (cursor && safety-- > 0) {
    const parentId = lookupId(cursor, 'dnx_parent_assessment_level');
    if (!parentId) break;
    const parent = levelById.get(parentId);
    if (!parent) break;
    parts.unshift(parent.dnx_name);
    cursor = parent;
  }
  return parts.join(' › ');
}

function formatSnapshotAnswer(
  r: AssessmentSnapshot['responses'][number],
  dataType: DataType,
): string {
  switch (dataType) {
    case 0:
      return r.boolean === null || r.boolean === undefined
        ? ''
        : r.boolean
          ? 'Yes'
          : 'No';
    case 1:
      return r.option ?? '';
    case 2: {
      const raw = r.multi;
      if (!raw) return '';
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.join(', ') : raw;
      } catch {
        return raw;
      }
    }
    case 3:
      return r.text ?? '';
    case 4:
      return r.date ? r.date.slice(0, 10) : '';
    default:
      return '';
  }
}

function formatCurrentAnswer(
  r: Dnx_assessment_responses,
  dataType: DataType,
): string {
  const v = readResponseValue(dataType, r);
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  return v;
}

import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Warning20Regular } from '@fluentui/react-icons';
import { useDeleteLevel } from './api';
import type { LevelNode } from './treeBuilder';
import { descendantIds } from './treeBuilder';
import { LEVEL_TYPE_LABEL, type LevelType } from './levelTypes';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '440px',
    width: '92vw',
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
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
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
  body: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--color-text-primary)',
  },
  nameTag: { fontWeight: 500, color: 'var(--color-text-primary)' },
  warning: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    fontSize: '12px',
    border: '0.5px solid var(--color-amber)',
  },
  dangerBtn: {
    backgroundColor: 'var(--color-red) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-red) !important',
    ':hover': {
      backgroundColor: 'var(--color-red-text) !important',
      border: '0.5px solid var(--color-red-text) !important',
    },
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
  templateId: string;
  /** Whole subtree node so we can count descendants and cascade-delete. */
  node: LevelNode | null;
}

export function DeleteLevelDialog({ open, onClose, templateId, node }: Props) {
  const styles = useStyles();
  const del = useDeleteLevel(templateId);

  if (!node) return null;
  const levelType = (node.level.dnx_assessment_level_type ?? 1) as LevelType;
  const typeLabel = LEVEL_TYPE_LABEL[levelType].toLowerCase();
  const descIds = descendantIds(node);
  const childCount = descIds.length;

  async function handleDelete() {
    if (!node) return;
    await del.mutateAsync({
      levelId: node.level.dnx_assessment_levelid,
      descendantIds: descIds,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => {
        if (!d.open) {
          del.reset();
          onClose();
        }
      }}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.header}>
              <div className={styles.headerMark}>
                <Warning20Regular />
              </div>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>Delete {typeLabel}</span>
                <span className={styles.headerSub}>This action cannot be undone.</span>
              </div>
            </div>

            <div className={styles.body}>
              Delete the {typeLabel}{' '}
              <span className={styles.nameTag}>{node.level.dnx_name}</span>?
              {childCount > 0 && (
                <>
                  {' '}
                  Its <b>{childCount}</b> {childCount === 1 ? 'child' : 'children'} will
                  also be removed.
                </>
              )}
            </div>

            {del.error && (
              <MessageBar intent="error" style={{ marginTop: 14 }}>
                <MessageBarBody>{(del.error as Error).message}</MessageBarBody>
              </MessageBar>
            )}

            {childCount > 0 && (
              <div className={styles.warning}>
                Heads-up — descendants are deleted depth-first. Any existing assessment
                responses pointing at these levels will become orphaned.
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button" onClick={onClose}>
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              className={styles.dangerBtn}
              type="button"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              {del.isPending ? 'Deleting...' : `Delete ${typeLabel}`}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

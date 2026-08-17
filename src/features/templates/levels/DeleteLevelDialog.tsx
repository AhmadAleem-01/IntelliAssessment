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
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '440px',
    width: '92vw',
  },
  content: { paddingTop: '4px', paddingBottom: '4px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '1px solid var(--ds-border)',
    marginBottom: '18px',
  },
  headerMark: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-not-suitable-soft)',
    color: '#b91c1c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
  },
  headerSub: { fontSize: '12px', color: 'var(--ds-text-body)' },
  body: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--ds-text-strong)',
  },
  nameTag: { fontWeight: 500, color: 'var(--ds-text-strong)' },
  warning: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    color: '#b45309',
    fontSize: '12px',
    border: '1px solid var(--ds-pending, #F59E0B)',
  },
  dangerBtn: {
    backgroundColor: 'var(--ds-not-suitable) !important',
    color: '#fff !important',
    border: '1px solid var(--ds-not-suitable) !important',
    ':hover': {
      backgroundColor: '#b91c1c !important',
      border: '1px solid #b91c1c !important',
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

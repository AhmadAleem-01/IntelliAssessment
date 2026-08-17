import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Warning20Regular } from '@fluentui/react-icons';
import { useDeleteProject } from './api';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '440px',
    width: '92vw',
  },
  content: {
    paddingTop: '4px',
    paddingBottom: '4px',
  },
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
  projectId: string;
  projectName: string;
  trigger: React.ReactElement;
}

export function DeleteProjectDialog({ projectId, projectName, trigger }: Props) {
  const styles = useStyles();
  const navigate = useNavigate();
  const del = useDeleteProject();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    await del.mutateAsync(projectId);
    setOpen(false);
    navigate('/projects');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (!d.open) del.reset();
      }}
    >
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.header}>
              <div className={styles.headerMark}>
                <Warning20Regular />
              </div>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>Delete project</span>
                <span className={styles.headerSub}>This action cannot be undone.</span>
              </div>
            </div>

            <div className={styles.body}>
              Are you sure you want to delete{' '}
              <span className={styles.nameTag}>{projectName}</span>? All assessment
              instances, responses, and evidence files associated with this project will
              become orphaned in Dataverse.
            </div>

            {del.error && (
              <MessageBar intent="error" style={{ marginTop: 14 }}>
                <MessageBarBody>{(del.error as Error).message}</MessageBarBody>
              </MessageBar>
            )}

            <div className={styles.warning}>
              Tip — if you want to retain history, change the status to <b>Archived</b>{' '}
              instead.
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              className={styles.dangerBtn}
              type="button"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              {del.isPending ? 'Deleting...' : 'Delete project'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

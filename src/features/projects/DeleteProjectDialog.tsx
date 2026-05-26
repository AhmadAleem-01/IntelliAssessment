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
import { Warning24Filled } from '@fluentui/react-icons';
import { useDeleteProject } from './api';

const useStyles = makeStyles({
  surface: {
    borderRadius: '18px',
    maxWidth: '480px',
    width: '92vw',
  },
  content: {
    paddingTop: '8px',
    paddingBottom: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    paddingBottom: '18px',
    borderBottom: '1px solid var(--app-border)',
    marginBottom: '20px',
  },
  headerMark: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px -8px rgba(239,68,68,0.55)',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '-0.015em',
    color: 'var(--app-text)',
  },
  headerSub: { fontSize: '13px', color: 'var(--app-text-muted)' },
  body: {
    fontSize: '14px',
    lineHeight: 1.55,
    color: 'var(--app-text)',
  },
  nameTag: {
    fontWeight: 600,
    color: 'var(--app-text)',
  },
  warning: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    fontSize: '13px',
    border: '1px solid #fecaca',
  },
  dangerBtn: {
    backgroundColor: '#ef4444 !important',
    color: '#fff !important',
    border: '1px solid #ef4444 !important',
    ':hover': {
      backgroundColor: '#dc2626 !important',
      border: '1px solid #dc2626 !important',
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
                <Warning24Filled />
              </div>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>Delete project</span>
                <span className={styles.headerSub}>This action cannot be undone.</span>
              </div>
            </div>

            <div className={styles.body}>
              Are you sure you want to delete{' '}
              <span className={styles.nameTag}>{projectName}</span>? All assessment instances,
              responses, and evidence files associated with this project will become
              orphaned in Dataverse.
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

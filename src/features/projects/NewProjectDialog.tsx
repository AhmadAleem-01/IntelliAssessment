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
import { Sparkle24Filled } from '@fluentui/react-icons';
import { useCreateProject } from './api';
import { ProjectFormFields, STATUS_TO_CODE, type StatusKey } from './ProjectFormFields';

const useStyles = makeStyles({
  surface: {
    borderRadius: '18px',
    maxWidth: '520px',
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
    marginBottom: '22px',
  },
  headerMark: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px -8px rgba(99,102,241,0.55)',
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
});

interface Props {
  trigger: React.ReactElement;
}

export function NewProjectDialog({ trigger }: Props) {
  const styles = useStyles();
  const navigate = useNavigate();
  const create = useCreateProject();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<StatusKey>('Active');

  function reset() {
    setName('');
    setCode('');
    setDescription('');
    setStatus('Active');
    create.reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await create.mutateAsync({
      dnx_project_name: name.trim(),
      dnx_project_code: code.trim() || undefined,
      dnx_description: description.trim() || undefined,
      statuscode: STATUS_TO_CODE[status],
    });
    reset();
    setOpen(false);
    navigate(`/projects/${created.dnx_projectid}`);
  }

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
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogContent className={styles.content}>
              <div className={styles.header}>
                <div className={styles.headerMark}>
                  <Sparkle24Filled />
                </div>
                <div className={styles.headerText}>
                  <span className={styles.headerTitle}>Create a new project</span>
                  <span className={styles.headerSub}>
                    A workspace that groups one or more assessments.
                  </span>
                </div>
              </div>

              {create.error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                  <MessageBarBody>{(create.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}

              <ProjectFormFields
                name={name}
                code={code}
                description={description}
                status={status}
                autoFocus
                onChange={(next) => {
                  if (next.name !== undefined) setName(next.name);
                  if (next.code !== undefined) setCode(next.code);
                  if (next.description !== undefined) setDescription(next.description);
                  if (next.status !== undefined) setStatus(next.status);
                }}
              />
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" type="button">
                  Cancel
                </Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                type="submit"
                disabled={!name.trim() || create.isPending}
              >
                {create.isPending ? 'Creating...' : 'Create project'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

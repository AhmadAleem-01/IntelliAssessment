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
import { Folder20Regular } from '@fluentui/react-icons';
import { useCreateProject } from './api';
import { ProjectFormFields, STATUS_TO_CODE, type StatusKey } from './ProjectFormFields';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '480px',
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
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    color: 'var(--ds-ai-primary, #8B5CF6)',
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
                  <Folder20Regular />
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

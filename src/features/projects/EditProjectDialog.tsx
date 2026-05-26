import { useState } from 'react';
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
import { Edit20Regular } from '@fluentui/react-icons';
import { useUpdateProject } from './api';
import {
  ProjectFormFields,
  STATUS_TO_CODE,
  CODE_TO_STATUS,
  type StatusKey,
} from './ProjectFormFields';
import type { Dnx_projects } from '../../generated/models/Dnx_projectsModel';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
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
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    marginBottom: '18px',
  },
  headerMark: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
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
});

interface Props {
  project: Dnx_projects;
  trigger: React.ReactElement;
}

export function EditProjectDialog({ project, trigger }: Props) {
  const styles = useStyles();
  const update = useUpdateProject(project.dnx_projectid);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.dnx_project_name);
  const [code, setCode] = useState(project.dnx_project_code ?? '');
  const [description, setDescription] = useState(project.dnx_description ?? '');
  const [status, setStatus] = useState<StatusKey>(
    CODE_TO_STATUS[project.statuscode ?? 1] ?? 'Active',
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Re-sync from the latest project record only when the dialog opens —
      // never during typing (would clobber edits in flight).
      setName(project.dnx_project_name);
      setCode(project.dnx_project_code ?? '');
      setDescription(project.dnx_description ?? '');
      setStatus(CODE_TO_STATUS[project.statuscode ?? 1] ?? 'Active');
      update.reset();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await update.mutateAsync({
      dnx_project_name: name.trim(),
      dnx_project_code: code.trim() || undefined,
      dnx_description: description.trim() || undefined,
      statuscode: STATUS_TO_CODE[status],
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => handleOpenChange(d.open)}>
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogContent className={styles.content}>
              <div className={styles.header}>
                <div className={styles.headerMark}>
                  <Edit20Regular />
                </div>
                <div className={styles.headerText}>
                  <span className={styles.headerTitle}>Edit project</span>
                  <span className={styles.headerSub}>
                    Update the workspace details and status.
                  </span>
                </div>
              </div>

              {update.error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                  <MessageBarBody>{(update.error as Error).message}</MessageBarBody>
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
                disabled={!name.trim() || update.isPending}
              >
                {update.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

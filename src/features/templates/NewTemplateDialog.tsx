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
import { DocumentBulletList20Regular } from '@fluentui/react-icons';
import { useCreateTemplate } from './api';
import { TemplateFormFields, STATUS_TO_CODE, type StatusKey } from './TemplateFormFields';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '480px',
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
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
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
  trigger: React.ReactElement;
}

export function NewTemplateDialog({ trigger }: Props) {
  const styles = useStyles();
  const navigate = useNavigate();
  const create = useCreateTemplate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<StatusKey>('Draft');

  function reset() {
    setName('');
    setDescription('');
    setStatus('Draft');
    create.reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await create.mutateAsync({
      dnx_template_name: name.trim(),
      dnx_description: description.trim() || undefined,
      statuscode: STATUS_TO_CODE[status],
    });
    reset();
    setOpen(false);
    navigate(`/templates/${created.dnx_assessment_templateid}/edit`);
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
                  <DocumentBulletList20Regular />
                </div>
                <div className={styles.headerText}>
                  <span className={styles.headerTitle}>Create a new template</span>
                  <span className={styles.headerSub}>
                    A reusable assessment definition. Add the hierarchy after creating.
                  </span>
                </div>
              </div>

              {create.error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                  <MessageBarBody>{(create.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}

              <TemplateFormFields
                name={name}
                description={description}
                status={status}
                autoFocus
                onChange={(next) => {
                  if (next.name !== undefined) setName(next.name);
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
                {create.isPending ? 'Creating...' : 'Create template'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

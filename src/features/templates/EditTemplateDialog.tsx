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
import { useUpdateTemplate } from './api';
import {
  TemplateFormFields,
  STATUS_TO_CODE,
  CODE_TO_STATUS,
  type StatusKey,
} from './TemplateFormFields';
import type { Dnx_assessment_templates } from '../../generated/models/Dnx_assessment_templatesModel';

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
  template: Dnx_assessment_templates;
  trigger: React.ReactElement;
}

export function EditTemplateDialog({ template, trigger }: Props) {
  const styles = useStyles();
  const update = useUpdateTemplate(template.dnx_assessment_templateid);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template.dnx_template_name);
  const [description, setDescription] = useState(template.dnx_description ?? '');
  const [status, setStatus] = useState<StatusKey>(
    CODE_TO_STATUS[template.statuscode ?? 778540001] ?? 'Draft',
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(template.dnx_template_name);
      setDescription(template.dnx_description ?? '');
      setStatus(CODE_TO_STATUS[template.statuscode ?? 778540001] ?? 'Draft');
      update.reset();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await update.mutateAsync({
      dnx_template_name: name.trim(),
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
                  <span className={styles.headerTitle}>Edit template</span>
                  <span className={styles.headerSub}>
                    Update the template details and lifecycle status.
                  </span>
                </div>
              </div>

              {update.error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                  <MessageBarBody>{(update.error as Error).message}</MessageBarBody>
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

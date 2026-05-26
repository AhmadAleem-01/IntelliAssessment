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
import { Edit24Regular } from '@fluentui/react-icons';
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
    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px -8px rgba(59,130,246,0.55)',
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
                  <Edit24Regular />
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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Field,
  Input,
  Dropdown,
  Option,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
} from '@fluentui/react-components';
import { ClipboardTaskListLtr20Regular } from '@fluentui/react-icons';
import { useTemplates } from '../templates/api';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';
import { useCreateAssessmentInstance } from './api';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '520px',
    width: '94vw',
  },
  content: { paddingTop: '4px', paddingBottom: '4px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '0.5px solid var(--ds-border)',
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
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  emptyTemplates: {
    fontSize: '12px',
    color: '#b45309',
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '0.5px solid var(--ds-pending, #F59E0B)',
  },
});

interface Props {
  projectId: string;
  projectName: string;
  trigger: React.ReactElement;
}

export function NewAssessmentDialog({ projectId, projectName, trigger }: Props) {
  const styles = useStyles();
  const navigate = useNavigate();
  const create = useCreateAssessmentInstance();
  const { data: templates, isLoading: templatesLoading } = useTemplates();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');

  // Only published templates can spawn instances (per PRD §5.2 / template lifecycle).
  const publishedTemplates = (templates ?? []).filter(
    (t) =>
      t.statuscode &&
      Dnx_assessment_templatesstatuscode[
        t.statuscode as keyof typeof Dnx_assessment_templatesstatuscode
      ] === 'Published',
  );

  function reset() {
    setName('');
    setTemplateId('');
    setDueDate('');
    create.reset();
  }

  // Default the assessment name to "<project> — <today>" so the user usually
  // doesn't have to touch the name field.
  useEffect(() => {
    if (!open) return;
    reset();
    const today = new Date().toISOString().slice(0, 10);
    setName(`${projectName} — ${today}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !templateId) return;
    const created = await create.mutateAsync({
      name: name.trim(),
      projectId,
      templateId,
      dueDate: dueDate || undefined,
    });
    setOpen(false);
    navigate(`/assessments/${created.dnx_assessment_instanceid}`);
  }

  const selectedTemplate = publishedTemplates.find(
    (t) => t.dnx_assessment_templateid === templateId,
  );

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
                  <ClipboardTaskListLtr20Regular />
                </div>
                <div className={styles.headerText}>
                  <span className={styles.headerTitle}>Start an assessment</span>
                  <span className={styles.headerSub}>
                    Create a live assessment instance under {projectName}.
                  </span>
                </div>
              </div>

              {create.error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                  <MessageBarBody>{(create.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}

              {!templatesLoading && publishedTemplates.length === 0 && (
                <div className={styles.emptyTemplates}>
                  No published templates available. Publish a template first
                  (Templates → open → Publish).
                </div>
              )}

              <div className={styles.fields}>
                <Field label="Template" required>
                  {templatesLoading ? (
                    <Spinner size="tiny" label="Loading templates..." />
                  ) : (
                    <Dropdown
                      value={selectedTemplate?.dnx_template_name ?? ''}
                      selectedOptions={templateId ? [templateId] : []}
                      onOptionSelect={(_, d) =>
                        d.optionValue && setTemplateId(d.optionValue)
                      }
                      placeholder="Pick a published template"
                      disabled={publishedTemplates.length === 0}
                    >
                      {publishedTemplates.map((t) => {
                        const optionText = `${t.dnx_template_name} (v${t.dnx_template_version ?? 1})`;
                        return (
                          <Option
                            key={t.dnx_assessment_templateid}
                            value={t.dnx_assessment_templateid}
                            text={optionText}
                          >
                            {optionText}
                          </Option>
                        );
                      })}
                    </Dropdown>
                  )}
                </Field>

                <Field label="Assessment name" required>
                  <Input
                    value={name}
                    onChange={(_, d) => setName(d.value)}
                    maxLength={200}
                  />
                </Field>

                <Field label="Due date" hint="Optional. Date only — no time component.">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(_, d) => setDueDate(d.value)}
                  />
                </Field>
              </div>
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
                disabled={
                  !name.trim() ||
                  !templateId ||
                  create.isPending ||
                  publishedTemplates.length === 0
                }
              >
                {create.isPending ? 'Creating...' : 'Start assessment'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

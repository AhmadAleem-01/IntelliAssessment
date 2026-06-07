import { useEffect, useState } from 'react';
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
  Textarea,
  Dropdown,
  Option,
  Switch,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { DocumentBulletList20Regular, Edit20Regular } from '@fluentui/react-icons';
import { useCreateLevel, useUpdateLevel, type LevelFormValue } from './api';
import {
  LEVEL_TYPE_LABEL,
  DATA_TYPE_LABEL,
  type LevelType,
  type DataType,
  hasDataType,
} from './levelTypes';
import { OptionListEditor } from './OptionListEditor';
import { parseOptions, serializeOptions } from './options';
import { VisibilityRuleEditor } from './VisibilityRuleEditor';
import { CriteriaEditor } from '../../rules/CriteriaEditor';
import { parseVisibility, type VisibilityRule } from './visibility';
import { eligibleParents } from './eligibleParents';
import { useTemplateLevels } from './api';
import type { Dnx_assessment_levels } from '../../../generated/models/Dnx_assessment_levelsModel';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '560px',
    width: '94vw',
  },
  content: { paddingTop: '8px', paddingBottom: '8px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    marginBottom: '22px',
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
  headerMarkEdit: {
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  headerSub: { fontSize: '12px', color: 'var(--color-text-secondary)' },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionDivider: {
    height: '0.5px',
    backgroundColor: 'var(--color-border-tertiary)',
    margin: '2px 0',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '-8px',
  },
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    gap: '12px',
  },
  switchLabel: {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  },
  switchHint: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginTop: '2px',
    lineHeight: 1.4,
  },
});

interface AddMode {
  mode: 'add';
  templateId: string;
  parentLevelId: string | null;
  parentLabel?: string;
  levelType: LevelType;
  order: number;
}

interface EditMode {
  mode: 'edit';
  templateId: string;
  level: Dnx_assessment_levels;
}

type Props = (AddMode | EditMode) & {
  open: boolean;
  onClose: () => void;
};

function dataTypeFromLevel(level: Dnx_assessment_levels): DataType | undefined {
  const v = level.dnx_data_type;
  return v === undefined || v === null ? undefined : (v as DataType);
}

type FormState = LevelFormValue & {
  levelType: LevelType;
  options: string[];
  visibilityRule: VisibilityRule | undefined;
};

function levelToForm(level: Dnx_assessment_levels): FormState {
  return {
    name: level.dnx_name,
    description: level.dnx_description ?? '',
    levelType: (level.dnx_assessment_level_type ?? 1) as LevelType,
    dataType: dataTypeFromLevel(level),
    hintText: level.dnx_hint_text ?? '',
    includeInLetter: !!level.dnx_include_in_letter,
    isRequired: !!level.dnx_is_required,
    isReadOnly: !!level.dnx_is_read_only,
    optionSetReference: level.dnx_option_set_reference ?? '',
    options: parseOptions(level.dnx_option_set_reference),
    documentTypeReference: level.dnx_document_type_reference ?? '',
    visibilityRule: parseVisibility(level.dnx_visibility_condition),
  };
}

const blankForm = (levelType: LevelType): FormState => ({
  name: '',
  description: '',
  levelType,
  dataType: levelType === 3 ? 0 : undefined, // Default Question → Boolean
  hintText: '',
  includeInLetter: false,
  isRequired: false,
  isReadOnly: false,
  optionSetReference: '',
  options: [],
  documentTypeReference: '',
  visibilityRule: undefined,
});

export function LevelDialog(props: Props) {
  const styles = useStyles();
  const isEdit = props.mode === 'edit';
  const templateId = props.templateId;
  const levelId = isEdit ? props.level.dnx_assessment_levelid : '';

  const create = useCreateLevel(templateId);
  const update = useUpdateLevel(templateId, levelId);
  const mutation = isEdit ? update : create;

  // Pull all levels for the template so we can list candidate "parent questions"
  // a visibility rule may reference. Cached by the LevelTree query, so this is
  // essentially free.
  const { data: allLevels } = useTemplateLevels(templateId);
  const parents = eligibleParents(allLevels, isEdit ? levelId : undefined);

  const [form, setForm] = useState<FormState>(
    isEdit ? levelToForm(props.level) : blankForm(props.levelType),
  );

  // Reset form when the dialog (re)opens with possibly different inputs.
  useEffect(() => {
    if (!props.open) return;
    if (props.mode === 'edit') {
      setForm(levelToForm(props.level));
    } else {
      setForm(blankForm(props.levelType));
    }
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const isQuestion = form.levelType === 3;
  const needsDataType = hasDataType(form.levelType);

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const isChoiceType = isQuestion && (form.dataType === 1 || form.dataType === 2);
    const payload: LevelFormValue = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      levelType: form.levelType,
      dataType: needsDataType ? form.dataType ?? 0 : undefined,
      hintText: isQuestion ? form.hintText?.trim() || undefined : undefined,
      includeInLetter: isQuestion ? form.includeInLetter : undefined,
      isRequired: isQuestion ? form.isRequired : undefined,
      isReadOnly: !isQuestion ? form.isReadOnly : undefined,
      optionSetReference: isChoiceType ? serializeOptions(form.options) : undefined,
      // The evidence binding (file variable + AI query) lives in
      // dnx_document_type_reference but is authored in the AI conditioning tab,
      // not here. Leave it undefined so this PATCH never clobbers it.
      documentTypeReference: undefined,
      visibilityRule: isQuestion ? form.visibilityRule : undefined,
    };

    if (props.mode === 'edit') {
      await update.mutateAsync(payload);
    } else {
      await create.mutateAsync({
        ...payload,
        templateId: props.templateId,
        parentLevelId: props.parentLevelId,
        order: props.order,
      });
    }
    props.onClose();
  }

  const headerCopy =
    props.mode === 'edit'
      ? {
          title: `Edit ${LEVEL_TYPE_LABEL[form.levelType].toLowerCase()}`,
          sub: 'Update the details for this level.',
        }
      : {
          title: `Add ${LEVEL_TYPE_LABEL[props.levelType].toLowerCase()}`,
          sub: props.parentLabel
            ? `Will be added under "${props.parentLabel}".`
            : 'Will be added at the top level of the template.',
        };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(_, d) => {
        if (!d.open) props.onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogContent className={styles.content}>
              <div className={styles.header}>
                <div
                  className={`${styles.headerMark} ${isEdit ? styles.headerMarkEdit : ''}`}
                >
                  {isEdit ? <Edit20Regular /> : <DocumentBulletList20Regular />}
                </div>
                <div className={styles.headerText}>
                  <span className={styles.headerTitle}>{headerCopy.title}</span>
                  <span className={styles.headerSub}>{headerCopy.sub}</span>
                </div>
              </div>

              {mutation.error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                  <MessageBarBody>{(mutation.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}

              <div className={styles.fields}>
                <Field label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(_, d) => patch({ name: d.value })}
                    placeholder={
                      form.levelType === 1
                        ? 'e.g. Qualification Section'
                        : form.levelType === 2
                          ? 'e.g. Qualification 1 of 5'
                          : 'e.g. Is this qualification valid?'
                    }
                    maxLength={200}
                    autoFocus
                  />
                </Field>

                {!isQuestion && (
                  <Field label="Description" hint="Guidance shown beneath the section title">
                    <Textarea
                      value={form.description ?? ''}
                      onChange={(_, d) => patch({ description: d.value })}
                      rows={2}
                    />
                  </Field>
                )}

                {isQuestion && (
                  <>
                    <Field label="Data type" required>
                      <Dropdown
                        value={DATA_TYPE_LABEL[form.dataType ?? 0]}
                        selectedOptions={[String(form.dataType ?? 0)]}
                        onOptionSelect={(_, d) =>
                          patch({ dataType: Number(d.optionValue) as DataType })
                        }
                      >
                        {(Object.keys(DATA_TYPE_LABEL) as unknown as DataType[]).map(
                          (k) => (
                            <Option key={k} value={String(k)}>
                              {DATA_TYPE_LABEL[k]}
                            </Option>
                          ),
                        )}
                      </Dropdown>
                    </Field>

                    {(form.dataType === 1 || form.dataType === 2) && (
                      <Field
                        label="Options"
                        hint={
                          form.dataType === 1
                            ? 'Define the choices an assessor can pick from. Add at least two.'
                            : 'Define the choices an assessor can multi-select. Add at least two.'
                        }
                      >
                        <OptionListEditor
                          value={form.options}
                          onChange={(opts) => patch({ options: opts })}
                          placeholder="e.g. Yes, then press Enter"
                        />
                      </Field>
                    )}

                    <div className={styles.sectionDivider} />
                    <div className={styles.sectionLabel}>Display</div>

                    <Field
                      label="Hint text"
                      hint="Tooltip shown to assessors above the input"
                    >
                      <Input
                        value={form.hintText ?? ''}
                        onChange={(_, d) => patch({ hintText: d.value })}
                        maxLength={500}
                      />
                    </Field>

                    <div className={styles.sectionDivider} />
                    <div className={styles.sectionLabel}>Behaviour</div>

                    <div className={styles.switchRow}>
                      <div>
                        <div className={styles.switchLabel}>Required</div>
                        <div className={styles.switchHint}>
                          Must be answered before submission.
                        </div>
                      </div>
                      <Switch
                        checked={!!form.isRequired}
                        onChange={(_, d) => patch({ isRequired: d.checked })}
                      />
                    </div>

                    <div className={styles.switchRow}>
                      <div>
                        <div className={styles.switchLabel}>Include in outcome letter</div>
                        <div className={styles.switchHint}>
                          Answer will appear as a highlighted span in the generated
                          letter.
                        </div>
                      </div>
                      <Switch
                        checked={!!form.includeInLetter}
                        onChange={(_, d) => patch({ includeInLetter: d.checked })}
                      />
                    </div>

                    <div className={styles.sectionDivider} />
                    <div className={styles.sectionLabel}>Visibility</div>

                    <VisibilityRuleEditor
                      value={form.visibilityRule}
                      parents={parents}
                      onChange={(rule) => patch({ visibilityRule: rule })}
                    />

                    {isEdit && (
                      <>
                        <div className={styles.sectionDivider} />
                        <div className={styles.sectionLabel}>Evaluation</div>
                        <CriteriaEditor level={props.level} />
                      </>
                    )}
                    {!isEdit && (
                      <>
                        <div className={styles.sectionDivider} />
                        <div className={styles.sectionLabel}>Evaluation</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          Pass / fail rules can be added after the question is created.
                          Save first, then reopen this question to configure evaluation.
                        </div>
                      </>
                    )}
                  </>
                )}

                {!isQuestion && (
                  <>
                    <div className={styles.switchRow}>
                      <div>
                        <div className={styles.switchLabel}>Lock when complete</div>
                        <div className={styles.switchHint}>
                          Section becomes read-only once the reviewer signs off.
                        </div>
                      </div>
                      <Switch
                        checked={!!form.isReadOnly}
                        onChange={(_, d) => patch({ isReadOnly: d.checked })}
                      />
                    </div>

                    <div className={styles.sectionDivider} />
                    <div className={styles.sectionLabel}>Evaluation</div>
                    {isEdit ? (
                      <CriteriaEditor level={props.level} />
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-secondary)',
                          lineHeight: 1.4,
                        }}
                      >
                        Roll-up rules can be added after this level is created.
                        Save first, then reopen to configure scoring.
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" type="button" onClick={props.onClose}>
                  Cancel
                </Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                type="submit"
                disabled={
                  !form.name.trim() ||
                  mutation.isPending ||
                  ((form.dataType === 1 || form.dataType === 2) &&
                    isQuestion &&
                    form.options.length < 2)
                }
              >
                {mutation.isPending
                  ? isEdit
                    ? 'Saving...'
                    : 'Adding...'
                  : isEdit
                    ? 'Save changes'
                    : 'Add'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

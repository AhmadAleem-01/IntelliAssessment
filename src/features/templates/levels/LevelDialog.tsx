import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  Button,
  Field,
  Input,
  Textarea,
  Dropdown,
  Option,
  OptionGroup,
  Switch,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Dismiss20Regular } from '@fluentui/react-icons';
import { useCreateLevel, useUpdateLevel, type LevelFormValue } from './api';
import {
  LEVEL_TYPE_LABEL,
  LEVEL_TYPE_CODE,
  type LevelType,
  type DataType,
  hasDataType,
} from './levelTypes';
import { OptionListEditor } from './OptionListEditor';
import { parseOptions, serializeOptions } from './options';
import { CriteriaEditor } from '../../rules/CriteriaEditor';
import {
  parseVisibility,
  operatorLabel,
  type VisibilityRule,
  type VisibilityOperator,
} from './visibility';
import { eligibleParents, groupByParent, BOOLEAN_VALUES, type EligibleQuestion } from './eligibleParents';
import { useTemplateLevels } from './api';
import { lookupId } from '../../../lib/dataverse';
import { useTemplate } from '../api';
import { useAssessmentInstances } from '../../assessments/api';
import type { Dnx_assessment_levels } from '../../../generated/models/Dnx_assessment_levelsModel';

const NAME_MAX_SECTION = 60;
const NAME_MAX_QUESTION = 120;

// Answer-type cards for the question form. Only the five data types the schema
// actually supports (Boolean/OptionSet/Multiselect/Text/Date) — there is no
// Number type in Dataverse, so it isn't offered.
const ANSWER_TYPES: { value: DataType; title: string; sub: string }[] = [
  { value: 0, title: 'Yes / No', sub: 'Two answers' },
  { value: 1, title: 'Single select', sub: 'One of many' },
  { value: 2, title: 'Multi select', sub: 'Several of many' },
  { value: 3, title: 'Text', sub: 'Free response' },
  { value: 4, title: 'Date', sub: 'Calendar' },
];

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '620px',
    width: '94vw',
    padding: 0,
    // Cap height so header + footer stay pinned and only the body scrolls.
    maxHeight: 'calc(100vh - 96px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  form: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '24px 28px 18px',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  headerTitle: {
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    letterSpacing: '-0.005em',
  },
  headerSub: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-brand-accent)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    width: '30px',
    height: '30px',
    minWidth: '30px',
    padding: 0,
    color: 'var(--ds-text-muted)',
    flexShrink: 0,
    ':hover': { color: 'var(--ds-text-strong)' },
  },

  body: {
    padding: '4px 28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  },

  groupLabel: {
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    marginBottom: '-10px',
  },
  optionalTag: { color: 'var(--ds-text-muted)', fontWeight: 400 },

  /* "Where it goes" selectable cards */
  cardRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  choiceCard: {
    // Native <button> defaults to the UA font — force the app sans so the
    // title/description match the rest of the dialog.
    fontFamily: 'var(--font-sans)',
    textAlign: 'left',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'border-color 0.12s ease, background-color 0.12s ease',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
    ':disabled': { cursor: 'default', opacity: 0.6 },
  },
  choiceCardActive: {
    borderColor: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    ':hover': { borderColor: 'var(--ds-ai-primary, #8B5CF6)' },
  },
  choiceTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  choiceDesc: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', lineHeight: 1.45 },

  /* Field labels + counters */
  labelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  counter: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  fieldHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '2px' },

  input: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    minWidth: 0,
    '::after': { display: 'none' },
    '& input': { borderRadius: '8px', height: '40px', fontSize: 'var(--ds-fs-body)' },
  },
  textarea: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    '::after': { display: 'none' },
    '& textarea': { borderRadius: '8px', fontSize: 'var(--ds-fs-body)', padding: '10px 12px' },
  },
  dropdown: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    // Fluent's Dropdown root has a large default min-width; clear it so it can
    // shrink inside a grid column (the condition row).
    minWidth: 0,
    '::after': { display: 'none' },
    '& button': {
      border: 'none',
      backgroundColor: 'transparent',
      height: '40px',
      fontSize: 'var(--ds-fs-body)',
      color: 'var(--ds-text-strong)',
      minWidth: 0,
      paddingRight: '4px',
      // Keep the selected value on one line and ellipsize long labels (e.g. a
      // deep "A › B › Question?" path) so it never overlaps the row below.
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },

  /* Two-panel body (question mode): form on the left, live preview on the right */
  splitBody: {
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    flex: 1,
    minHeight: 0,
    '@media (max-width: 820px)': { gridTemplateColumns: '1fr' },
  },
  splitLeft: {
    padding: '4px 24px 24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    overflowY: 'auto',
    minHeight: 0,
  },
  splitRight: {
    padding: '20px 24px',
    borderLeft: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-base)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    minHeight: 0,
    '@media (max-width: 820px)': { borderLeft: 'none', borderTop: '1px solid var(--ds-border)' },
  },

  /* Answer-type card grid */
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  typeCard: {
    fontFamily: 'var(--font-sans)',
    textAlign: 'left',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    transition: 'border-color 0.12s ease, background-color 0.12s ease',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
  },
  typeCardActive: {
    borderColor: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    ':hover': { borderColor: 'var(--ds-ai-primary, #8B5CF6)' },
  },
  typeTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  typeSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  /* Preview panel */
  previewLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--ds-text-muted)',
  },
  previewCard: {
    border: '1px solid var(--ds-border)',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-surface-card)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  previewHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' },
  previewName: { fontSize: 'var(--ds-fs-body)', fontWeight: 700, color: 'var(--ds-text-strong)', lineHeight: 1.35 },
  previewNamePlaceholder: { color: 'var(--ds-text-muted)', fontWeight: 600 },
  previewReq: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-pending-text, #b45309)',
    flexShrink: 0,
  },
  previewControls: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  previewChip: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    border: '1px solid var(--ds-border)',
    borderRadius: '8px',
    padding: '6px 14px',
    backgroundColor: 'var(--ds-surface-card)',
  },
  previewInput: {
    border: '1px solid var(--ds-border)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
    backgroundColor: 'var(--ds-surface-card)',
  },
  /* Radio/checkbox option rows in the preview (single/multi select) */
  optionRows: { display: 'flex', flexDirection: 'column', gap: '8px' },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid var(--ds-border)',
    borderRadius: '8px',
    padding: '9px 12px',
    backgroundColor: 'var(--ds-surface-card)',
  },
  optionMark: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    border: '1.5px solid var(--ds-border-strong, #cbd5e1)',
  },
  optionMarkRadio: { borderRadius: '50%' },
  optionMarkCheck: { borderRadius: '4px' },
  optionLabel: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-strong)' },
  facts: { display: 'flex', flexDirection: 'column', gap: '10px' },
  fact: { display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-body)', lineHeight: 1.4 },
  factDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '5px' },

  /* Show-only-when condition row */
  condRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)',
    gap: '8px',
  },
  condCard: {
    marginTop: '12px',
    padding: '14px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  condNote: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', lineHeight: 1.45 },

  /* Behaviour card wraps the toggle rows */
  behaviourCard: {
    border: '1px solid var(--ds-border)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    gap: '16px',
    ':not(:last-child)': { borderBottom: '1px solid var(--ds-border)' },
  },
  switchText: { minWidth: 0 },
  switchLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  switchHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '2px', lineHeight: 1.45 },

  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 28px',
    borderTop: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-base)',
    flexShrink: 0,
  },
  footerNote: { flex: 1, fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
    ':disabled': { backgroundColor: 'var(--ds-border)', color: 'var(--ds-text-muted)' },
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

/** Default comparison value when a visibility source question is first picked. */
function defaultVisValueFor(parent: EligibleQuestion): string {
  if (parent.dataType === 0) return 'Yes';
  if (parent.options.length > 0) return parent.options[0];
  return '';
}

/** Next order slot for a sibling bucket (top-level or under a given parent). */
function nextOrderIn(levels: Dnx_assessment_levels[] | undefined, parentId: string | null): number {
  let max = -1;
  for (const l of levels ?? []) {
    if (l.dnx_assessment_level_type === 0) continue; // skip implicit root
    const p = lookupId(l, 'dnx_parent_assessment_level') ?? null;
    if (p === parentId) max = Math.max(max, l.dnx_assessment_level_order ?? 0);
  }
  return max + 1;
}

export function LevelDialog(props: Props) {
  const styles = useStyles();
  const isEdit = props.mode === 'edit';
  const templateId = props.templateId;
  const levelId = isEdit ? props.level.dnx_assessment_levelid : '';

  const create = useCreateLevel(templateId);
  const update = useUpdateLevel(templateId, levelId);
  const mutation = isEdit ? update : create;

  const { data: allLevels } = useTemplateLevels(templateId);
  const parents = eligibleParents(allLevels, isEdit ? levelId : undefined);

  // Rich subtitle context: template name / version / live assessment count.
  const { data: template } = useTemplate(templateId);
  const { data: instances } = useAssessmentInstances();
  const liveCount = useMemo(
    () =>
      (instances ?? []).filter(
        (i) =>
          ((i as unknown as Record<string, unknown>)['_dnx_assessmenttemplate_value'] as
            | string
            | undefined) === templateId,
      ).length,
    [instances, templateId],
  );

  // "Where it goes" placement — only meaningful when adding a top-level section.
  // 'top' keeps a Section at the root; 'inside' nests it as a Subsection under a
  // chosen Section.
  const showPlacement = props.mode === 'add' && props.levelType === 1 && props.parentLevelId === null;
  const sections = useMemo(
    () =>
      (allLevels ?? [])
        .filter((l) => l.dnx_assessment_level_type === 1)
        .sort((a, b) => (a.dnx_assessment_level_order ?? 0) - (b.dnx_assessment_level_order ?? 0)),
    [allLevels],
  );
  const [placement, setPlacement] = useState<'top' | 'inside'>('top');
  const [parentSectionId, setParentSectionId] = useState<string>('');

  const [form, setForm] = useState<FormState>(
    isEdit ? levelToForm(props.level) : blankForm(props.levelType),
  );

  // Reset form + placement when the dialog transitions closed → open (it may
  // reopen with different inputs). Render-time adjust-on-change instead of an
  // effect, to avoid set-state-in-effect cascading renders.
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) {
      setForm(props.mode === 'edit' ? levelToForm(props.level) : blankForm(props.levelType));
      setPlacement('top');
      setParentSectionId('');
    }
  }

  // Clear any prior mutation error when the dialog opens. This syncs an external
  // system (react-query), so it belongs in an effect.
  useEffect(() => {
    if (props.open) mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // Effective level type: an "inside a section" section-add becomes a Subsection.
  const effectiveType: LevelType =
    showPlacement && placement === 'inside' ? LEVEL_TYPE_CODE.Subsection : form.levelType;
  const isQuestion = effectiveType === 3;
  const needsDataType = hasDataType(effectiveType);
  const kindWord = LEVEL_TYPE_LABEL[showPlacement ? effectiveType : form.levelType].toLowerCase();
  const nameMax = isQuestion ? NAME_MAX_QUESTION : NAME_MAX_SECTION;
  const isChoiceType = isQuestion && (form.dataType === 1 || form.dataType === 2);

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
  }

  const placementInvalid = showPlacement && placement === 'inside' && !parentSectionId;
  const optionsInvalid = isChoiceType && form.options.length < 2;
  const canSubmit = !!form.name.trim() && !placementInvalid && !optionsInvalid && !mutation.isPending;

  function buildPayload(): LevelFormValue {
    return {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      levelType: effectiveType,
      dataType: needsDataType ? form.dataType ?? 0 : undefined,
      hintText: isQuestion ? form.hintText?.trim() || undefined : undefined,
      includeInLetter: isQuestion ? form.includeInLetter : undefined,
      isRequired: isQuestion ? form.isRequired : undefined,
      isReadOnly: !isQuestion ? form.isReadOnly : undefined,
      optionSetReference: isChoiceType ? serializeOptions(form.options) : undefined,
      // Evidence binding is authored in the AI conditioning tab; leave undefined
      // so this PATCH never clobbers it.
      documentTypeReference: undefined,
      visibilityRule: isQuestion ? form.visibilityRule : undefined,
    };
  }

  /** Create at the resolved placement (add mode only). */
  async function createLevel() {
    const parentLevelId =
      showPlacement && placement === 'inside' ? parentSectionId : props.parentLevelId;
    const order =
      showPlacement && placement === 'inside'
        ? nextOrderIn(allLevels, parentSectionId)
        : props.order;
    await create.mutateAsync({ ...buildPayload(), templateId: props.templateId, parentLevelId, order });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (props.mode === 'edit') {
      await update.mutateAsync(buildPayload());
    } else {
      await createLevel();
    }
    props.onClose();
  }

  // "Add and create another" — create, then reset the form for a fresh entry
  // while keeping the dialog open (the parent/placement stay put).
  async function handleAddAnother() {
    if (!canSubmit || props.mode !== 'add') return;
    await createLevel();
    setForm(blankForm(props.levelType));
  }

  // ---- Visibility rule (Show only when…) — inline editor state helpers ----
  const visRule = form.visibilityRule;
  const visEnabled = !!visRule;
  const visSelectedParent = visRule
    ? parents.find((p) => p.id === visRule.showWhen.questionId)
    : undefined;

  function toggleVisibility(on: boolean) {
    if (!on) return patch({ visibilityRule: undefined });
    const first = parents[0];
    if (!first) return; // no eligible sources — toggle can't turn on
    patch({
      visibilityRule: {
        showWhen: {
          questionId: first.id,
          operator: 'equals',
          value: defaultVisValueFor(first),
          questionLabel: first.parentPath ? `${first.parentPath} › ${first.label}` : first.label,
        },
      },
    });
  }
  function setVisParent(id: string) {
    const p = parents.find((x) => x.id === id);
    if (!p || !visRule) return;
    patch({
      visibilityRule: {
        showWhen: {
          questionId: p.id,
          operator: visRule.showWhen.operator,
          value: defaultVisValueFor(p),
          questionLabel: p.parentPath ? `${p.parentPath} › ${p.label}` : p.label,
        },
      },
    });
  }
  function setVisOperator(op: VisibilityOperator) {
    if (!visRule) return;
    patch({ visibilityRule: { showWhen: { ...visRule.showWhen, operator: op } } });
  }
  function setVisValue(v: string) {
    if (!visRule) return;
    patch({ visibilityRule: { showWhen: { ...visRule.showWhen, value: v } } });
  }

  const title = isEdit ? `Edit ${kindWord}` : `Add ${showPlacement ? 'section' : kindWord}`;
  const submitLabel = isEdit
    ? mutation.isPending
      ? 'Saving…'
      : 'Save changes'
    : mutation.isPending
      ? 'Adding…'
      : `Add ${showPlacement ? 'section' : kindWord}`;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(_, d) => {
        if (!d.open) props.onClose();
      }}
    >
      <DialogSurface
        className={styles.surface}
        style={{
          // Inline width beats Fluent's atomic .fui-DialogSurface max-width
          // class (which was pinning the surface to 600–620px).
          maxWidth: isQuestion ? '900px' : '620px',
          width: isQuestion ? 'min(900px, 94vw)' : '94vw',
        }}
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <span className={styles.headerTitle}>{title}</span>
              <span className={styles.headerSub}>
                {template?.dnx_template_name ?? 'Template'}
                {props.mode === 'add' && props.parentLabel
                  ? ` · adding under ${props.parentLabel}`
                  : ` · v${template?.dnx_template_version ?? 1} · ${liveCount} live assessment${liveCount === 1 ? '' : 's'}`}
              </span>
            </div>
            <Button
              appearance="subtle"
              className={styles.closeBtn}
              icon={<Dismiss20Regular />}
              type="button"
              aria-label="Close"
              onClick={props.onClose}
            />
          </div>

          {isQuestion ? (
            /* ---- Two-panel question editor: form + live preview ---- */
            <div className={styles.splitBody}>
              <div className={styles.splitLeft}>
                {mutation.error && (
                  <MessageBar intent="error">
                    <MessageBarBody>{(mutation.error as Error).message}</MessageBarBody>
                  </MessageBar>
                )}

                {/* Question */}
                <div>
                  <div className={styles.labelRow}>
                    <span className={styles.fieldLabel}>Question</span>
                    <span className={styles.counter}>
                      {form.name.length}/{nameMax}
                    </span>
                  </div>
                  <Input
                    className={styles.input}
                    style={{ marginTop: 8, width: '100%' }}
                    value={form.name}
                    onChange={(_, d) => patch({ name: d.value.slice(0, nameMax) })}
                    placeholder="e.g. Is this qualification valid?"
                    maxLength={nameMax}
                    autoFocus
                  />
                </div>

                {/* Answer type — card grid */}
                <div>
                  <div className={styles.groupLabel} style={{ marginBottom: 10 }}>
                    Answer type
                  </div>
                  <div className={styles.typeGrid}>
                    {ANSWER_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={`${styles.typeCard} ${form.dataType === t.value ? styles.typeCardActive : ''}`}
                        onClick={() => patch({ dataType: t.value })}
                      >
                        <span className={styles.typeTitle}>{t.title}</span>
                        <span className={styles.typeSub}>{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options (single/multi select) */}
                {isChoiceType && (
                  <div>
                    <div className={styles.labelRow} style={{ marginBottom: 8 }}>
                      <span className={styles.fieldLabel}>Options</span>
                      <span className={styles.counter}>
                        At least 2 ·{' '}
                        {form.dataType === 1
                          ? 'assessors pick one'
                          : 'assessors may pick several'}
                      </span>
                    </div>
                    <OptionListEditor
                      value={form.options}
                      onChange={(opts) => patch({ options: opts })}
                      placeholder="e.g. Yes, then press Enter"
                    />
                  </div>
                )}

                {/* Hint */}
                <div>
                  <div className={styles.labelRow}>
                    <span className={styles.fieldLabel}>
                      Hint for assessors <span className={styles.optionalTag}>Optional</span>
                    </span>
                  </div>
                  <Textarea
                    className={styles.textarea}
                    style={{ marginTop: 8, width: '100%' }}
                    value={form.hintText ?? ''}
                    onChange={(_, d) => patch({ hintText: d.value })}
                    placeholder="Shown beneath the question while answering."
                    rows={2}
                  />
                </div>

                {/* Behaviour */}
                <div>
                  <div className={styles.groupLabel} style={{ marginBottom: 10 }}>
                    Behaviour
                  </div>
                  <div className={styles.behaviourCard}>
                    <div className={styles.switchRow}>
                      <div className={styles.switchText}>
                        <div className={styles.switchLabel}>Required</div>
                        <div className={styles.switchHint}>
                          Must be answered before the assessment can be submitted.
                        </div>
                      </div>
                      <Switch
                        checked={!!form.isRequired}
                        onChange={(_, d) => patch({ isRequired: d.checked })}
                      />
                    </div>
                    <div className={styles.switchRow}>
                      <div className={styles.switchText}>
                        <div className={styles.switchLabel}>Include in outcome letter</div>
                        <div className={styles.switchHint}>
                          Answer appears as a highlighted span in the generated letter.
                        </div>
                      </div>
                      <Switch
                        checked={!!form.includeInLetter}
                        onChange={(_, d) => patch({ includeInLetter: d.checked })}
                      />
                    </div>
                  </div>
                </div>

                {/* Show only when… — conditional visibility */}
                <div>
                  <div className={styles.switchRow} style={{ padding: 0 }}>
                    <div className={styles.switchText}>
                      <div className={styles.switchLabel}>Show only when…</div>
                      {parents.length === 0 && (
                        <div className={styles.switchHint}>
                          Add a Yes/No or select question elsewhere first to condition on it.
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={visEnabled}
                      disabled={!visEnabled && parents.length === 0}
                      onChange={(_, d) => toggleVisibility(d.checked)}
                    />
                  </div>

                  {visEnabled && visRule && (
                    <div className={styles.condCard}>
                      <div className={styles.condRow}>
                        <Dropdown
                          className={styles.dropdown}
                          value={visSelectedParent ? visRule.showWhen.questionLabel ?? visSelectedParent.label : ''}
                          selectedOptions={[visRule.showWhen.questionId]}
                          onOptionSelect={(_, d) => d.optionValue && setVisParent(d.optionValue)}
                          placeholder="Pick a question"
                        >
                          {groupByParent(parents).map((group) => (
                            <OptionGroup key={group.key} label={group.path}>
                              {group.questions.map((p) => (
                                <Option key={p.id} value={p.id}>
                                  {p.label}
                                </Option>
                              ))}
                            </OptionGroup>
                          ))}
                        </Dropdown>
                        <Dropdown
                          className={styles.dropdown}
                          value={operatorLabel(visRule.showWhen.operator, visSelectedParent?.dataType)}
                          selectedOptions={[visRule.showWhen.operator]}
                          onOptionSelect={(_, d) =>
                            d.optionValue && setVisOperator(d.optionValue as VisibilityOperator)
                          }
                        >
                          <Option value="equals">
                            {operatorLabel('equals', visSelectedParent?.dataType)}
                          </Option>
                          <Option value="notEquals">
                            {operatorLabel('notEquals', visSelectedParent?.dataType)}
                          </Option>
                        </Dropdown>
                        {renderVisValue(styles, visSelectedParent, visRule.showWhen.value, setVisValue)}
                      </div>
                      <div className={styles.condNote}>
                        Assessors never see this question unless the condition is met. Skipped
                        questions do not block submission.
                      </div>
                    </div>
                  )}
                </div>

                {/* Evaluation (edit mode only) */}
                {isEdit && (
                  <div>
                    <div className={styles.groupLabel} style={{ marginBottom: 10 }}>
                      Evaluation
                    </div>
                    <CriteriaEditor level={props.level} />
                  </div>
                )}
              </div>

              {/* Preview panel */}
              <div className={styles.splitRight}>
                <span className={styles.previewLabel}>Preview</span>
                <div className={styles.previewCard}>
                  <div className={styles.previewHead}>
                    <span
                      className={`${styles.previewName} ${form.name.trim() ? '' : styles.previewNamePlaceholder}`}
                    >
                      {form.name.trim() || 'Your question will appear here'}
                    </span>
                    {form.isRequired && <span className={styles.previewReq}>Required</span>}
                  </div>
                  {renderPreviewControl(styles, form.dataType ?? 0, form.options)}
                </div>

                <div className={styles.facts}>
                  <Fact styles={styles} tone={form.isRequired ? 'pending' : 'muted'}>
                    {form.isRequired ? 'Blocks submission until answered' : 'Optional — can be left blank'}
                  </Fact>
                  <Fact styles={styles} tone="muted">
                    Evidence &amp; AI bindings are set on the AI conditioning tab
                  </Fact>
                  <Fact styles={styles} tone={form.includeInLetter ? 'accent' : 'muted'}>
                    {form.includeInLetter
                      ? 'Appears in the outcome letter'
                      : 'Not used in the outcome letter'}
                  </Fact>
                  {visEnabled && visRule && (
                    <Fact styles={styles} tone="ai">
                      Hidden unless {visRule.showWhen.questionLabel ?? 'a question'}{' '}
                      {operatorLabel(visRule.showWhen.operator, visSelectedParent?.dataType)}{' '}
                      {visRule.showWhen.value || '…'}
                    </Fact>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ---- Single-column section / subsection editor ---- */
            <div className={styles.body}>
              {mutation.error && (
                <MessageBar intent="error">
                  <MessageBarBody>{(mutation.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}

              {/* Where it goes */}
              {showPlacement && (
                <>
                  <div className={styles.groupLabel}>Where it goes</div>
                  <div className={styles.cardRow}>
                    <button
                      type="button"
                      className={`${styles.choiceCard} ${placement === 'top' ? styles.choiceCardActive : ''}`}
                      onClick={() => setPlacement('top')}
                    >
                      <span className={styles.choiceTitle}>Top level</span>
                      <span className={styles.choiceDesc}>
                        {sections.length > 0
                          ? `Sits alongside ${sections
                              .slice(0, 2)
                              .map((s) => s.dnx_name)
                              .join(' and ')}${sections.length > 2 ? ' and others' : ''}.`
                          : 'Becomes the first section of the template.'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.choiceCard} ${placement === 'inside' ? styles.choiceCardActive : ''}`}
                      onClick={() => sections.length > 0 && setPlacement('inside')}
                      disabled={sections.length === 0}
                    >
                      <span className={styles.choiceTitle}>Inside a section</span>
                      <span className={styles.choiceDesc}>
                        {sections.length > 0
                          ? 'Becomes a subsection of the section you pick.'
                          : 'No sections yet — add a top-level one first.'}
                      </span>
                    </button>
                  </div>

                  {placement === 'inside' && (
                    <Field label="Parent section" required>
                      <Dropdown
                        className={styles.dropdown}
                        placeholder="Choose a section"
                        value={
                          sections.find((s) => s.dnx_assessment_levelid === parentSectionId)
                            ?.dnx_name ?? ''
                        }
                        selectedOptions={parentSectionId ? [parentSectionId] : []}
                        onOptionSelect={(_, d) => setParentSectionId(d.optionValue ?? '')}
                      >
                        {sections.map((s) => (
                          <Option key={s.dnx_assessment_levelid} value={s.dnx_assessment_levelid}>
                            {s.dnx_name}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                  )}
                </>
              )}

              {/* Name */}
              <div>
                <div className={styles.labelRow}>
                  <span className={styles.fieldLabel}>Name</span>
                  <span className={styles.counter}>
                    {form.name.length}/{nameMax}
                  </span>
                </div>
                <Input
                  className={styles.input}
                  style={{ marginTop: 8, width: '100%' }}
                  value={form.name}
                  onChange={(_, d) => patch({ name: d.value.slice(0, nameMax) })}
                  placeholder={effectiveType === 1 ? 'e.g. Qualifications' : 'e.g. Qualification 1'}
                  maxLength={nameMax}
                  autoFocus
                />
                <div className={styles.fieldHint}>
                  Shown as the section heading on every assessment.
                </div>
              </div>

              {/* Guidance */}
              <div>
                <div className={styles.labelRow}>
                  <span className={styles.fieldLabel}>
                    Guidance for assessors <span className={styles.optionalTag}>Optional</span>
                  </span>
                </div>
                <Textarea
                  className={styles.textarea}
                  style={{ marginTop: 8, width: '100%' }}
                  value={form.description ?? ''}
                  onChange={(_, d) => patch({ description: d.value })}
                  placeholder="Shown beneath the section title while answering."
                  rows={2}
                />
              </div>

              {/* Behaviour */}
              <div>
                <div className={styles.groupLabel} style={{ marginBottom: 10 }}>
                  Behaviour
                </div>
                <div className={styles.behaviourCard}>
                  <div className={styles.switchRow}>
                    <div className={styles.switchText}>
                      <div className={styles.switchLabel}>Lock when complete</div>
                      <div className={styles.switchHint}>
                        Becomes read-only once the reviewer signs off.
                      </div>
                    </div>
                    <Switch
                      checked={!!form.isReadOnly}
                      onChange={(_, d) => patch({ isReadOnly: d.checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Evaluation (edit mode only) */}
              {isEdit && (
                <div>
                  <div className={styles.groupLabel} style={{ marginBottom: 10 }}>
                    Evaluation
                  </div>
                  <CriteriaEditor level={props.level} />
                </div>
              )}
            </div>
          )}

          <div className={styles.footer}>
            <span className={styles.footerNote}>
              {isEdit
                ? 'Changes publish as the next version.'
                : isQuestion
                  ? 'AI bindings and scoring are set on the AI conditioning tab.'
                  : `Scoring rules are configured after the ${kindWord} exists.`}
            </span>
            <Button appearance="secondary" type="button" onClick={props.onClose}>
              Cancel
            </Button>
            {props.mode === 'add' && isQuestion && (
              <Button
                appearance="secondary"
                type="button"
                disabled={!canSubmit}
                onClick={handleAddAnother}
              >
                Add and create another
              </Button>
            )}
            <Button
              appearance="primary"
              type="submit"
              className={styles.primaryBtn}
              disabled={!canSubmit}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

type Styles = ReturnType<typeof useStyles>;

/** A single plain-language fact bullet in the preview panel. */
function Fact({
  styles,
  tone,
  children,
}: {
  styles: Styles;
  tone: 'muted' | 'pending' | 'accent' | 'ai';
  children: React.ReactNode;
}) {
  const dot =
    tone === 'pending'
      ? 'var(--ds-pending, #F59E0B)'
      : tone === 'accent'
        ? 'var(--ds-brand-accent)'
        : tone === 'ai'
          ? 'var(--ds-ai-primary, #8B5CF6)'
          : 'var(--ds-border-strong, #cbd5e1)';
  return (
    <div className={styles.fact}>
      <span className={styles.factDot} style={{ backgroundColor: dot }} />
      <span>{children}</span>
    </div>
  );
}

/** Render a non-interactive mock of the answer control for the preview card. */
function renderPreviewControl(styles: Styles, dataType: DataType, options: string[]) {
  if (dataType === 0) {
    return (
      <div className={styles.previewControls}>
        <span className={styles.previewChip}>Yes</span>
        <span className={styles.previewChip}>No</span>
      </div>
    );
  }
  if (dataType === 1 || dataType === 2) {
    const opts = options.length > 0 ? options : ['Option 1', 'Option 2'];
    // Single select → radio circles; Multi select → checkbox squares.
    const markShape = dataType === 1 ? styles.optionMarkRadio : styles.optionMarkCheck;
    return (
      <div className={styles.optionRows}>
        {opts.slice(0, 5).map((o, i) => (
          <div key={`${o}-${i}`} className={styles.optionRow}>
            <span className={`${styles.optionMark} ${markShape}`} />
            <span className={styles.optionLabel}>{o}</span>
          </div>
        ))}
      </div>
    );
  }
  if (dataType === 4) {
    return <div className={styles.previewInput}>dd / mm / yyyy</div>;
  }
  // Text
  return <div className={styles.previewInput}>Free-text answer…</div>;
}

/** The value control in the "Show only when…" condition row (matches parent type). */
function renderVisValue(
  styles: Styles,
  parent: EligibleQuestion | undefined,
  value: string,
  onChange: (v: string) => void,
) {
  if (parent && parent.dataType === 0) {
    return (
      <Dropdown
        className={styles.dropdown}
        value={value}
        selectedOptions={[value]}
        onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue)}
      >
        {BOOLEAN_VALUES.map((v) => (
          <Option key={v} value={v}>
            {v}
          </Option>
        ))}
      </Dropdown>
    );
  }
  if (parent && (parent.dataType === 1 || parent.dataType === 2)) {
    return (
      <Dropdown
        className={styles.dropdown}
        value={value}
        selectedOptions={[value]}
        onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue)}
        placeholder="Pick an option"
      >
        {parent.options.map((o) => (
          <Option key={o} value={o}>
            {o}
          </Option>
        ))}
      </Dropdown>
    );
  }
  return <Input className={styles.input} value={value} onChange={(_, d) => onChange(d.value)} />;
}

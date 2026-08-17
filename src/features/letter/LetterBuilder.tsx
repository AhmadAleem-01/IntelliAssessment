import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Input,
  Checkbox,
  Combobox,
  Dropdown,
  Option,
  Spinner,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogSurface,
  makeStyles,
} from '@fluentui/react-components';
import {
  Add16Regular,
  ReOrderDotsVertical24Regular,
  TextAlignLeft16Regular,
  TextAlignCenter16Regular,
  TextAlignRight16Regular,
  Image16Regular,
  Dismiss20Regular,
} from '@fluentui/react-icons';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useTemplate,
  useSaveLetterLayout,
  useSaveLetterBackground,
  useLetterBackgroundObjectUrl,
} from '../templates/api';
import { useTemplateLevels } from '../templates/levels/api';
import { useCriteriaForLevels } from '../rules/api';
import { LetterPreview } from './LetterPreview';
import {
  DEFAULT_LAYOUT,
  LETTER_BLOCK_LABEL,
  META_FIELD_LABEL,
  PLACEHOLDERS,
  SINGLETON_BLOCKS,
  makeBlock,
  parseLetterLayout,
  serializeLetterLayout,
  BACKGROUND_POSITIONS,
  type BackgroundMode,
  type LetterBlock,
  type LetterBlockType,
  type LetterLayout,
  type MetaFieldKey,
  type PageSettings,
  type TextAlign,
} from './letterLayout';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { LevelType } from '../templates/levels/levelTypes';
import { TokenTextEditor } from './TokenTextEditor';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';

const AUTOSAVE_MS = 900;

/** One-line subtitle under each block in the left list. */
function blockSubtitle(b: LetterBlock): string {
  switch (b.type) {
    case 'heading':
      return b.text || 'Heading';
    case 'text':
      return b.text.split('\n')[0] || 'Paragraph';
    case 'meta':
      return `${b.fields.length} of ${Object.keys(META_FIELD_LABEL).length} fields`;
    case 'outcome':
      return 'Pass / fail block';
    case 'reviewerNotes':
      return 'Hidden when empty';
    case 'responses':
      return 'Answers marked for the letter';
    case 'groupedSubsections':
      return b.heading || 'Grouped subsections';
    case 'signature':
      return b.text || 'Signature line';
    case 'spacer':
      return `${b.size}px space`;
  }
}

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '250px minmax(0, 1fr) minmax(360px, 460px)',
    gap: '20px',
    alignItems: 'start',
    '@media (max-width: 1180px)': { gridTemplateColumns: '230px minmax(0, 1fr)' },
    '@media (max-width: 860px)': { gridTemplateColumns: '1fr' },
  },
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
  },
  stickyPane: {
    position: 'sticky',
    top: '80px',
    '@media (max-width: 1180px)': { position: 'static' },
  },

  /* ---- Left: block list ---- */
  listHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--ds-border)',
  },
  listTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  listCount: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  list: { display: 'flex', flexDirection: 'column', paddingBottom: '4px' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 14px 11px 12px',
    borderLeft: '3px solid transparent',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
    ':hover .blk-grip': { opacity: 1 },
  },
  itemActive: { backgroundColor: 'var(--ds-surface-base)', borderLeftColor: 'var(--ds-brand-primary)' },
  grip: {
    display: 'inline-flex',
    color: 'var(--ds-text-muted)',
    cursor: 'grab',
    touchAction: 'none',
    opacity: 0,
    transition: 'opacity 0.1s ease',
    flexShrink: 0,
    marginLeft: '-4px',
    ':active': { cursor: 'grabbing' },
    '& svg': { width: '16px', height: '16px' },
  },
  itemText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  itemName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemSub: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  blankTag: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: 'var(--ds-pending-text, #b45309)',
    flexShrink: 0,
  },
  addSection: { padding: '12px 14px', borderTop: '1px solid var(--ds-border)' },
  addLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
    marginBottom: '8px',
  },
  addBtns: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  addBtn: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-body)',
    ':hover': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-strong)' },
  },

  /* Tips / legend at the foot of the left panel */
  tips: {
    padding: '12px 14px',
    borderTop: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-base)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tipsLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
  },
  tipRow: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-body)', lineHeight: 1.5 },
  tipKbd: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: '5px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-strong)',
  },
  tipTokens: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' },
  tipToken: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '5px',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-muted)',
  },

  /* ---- Center: config ---- */
  cfgHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: '1px solid var(--ds-border)',
  },
  cfgKicker: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--ds-text-muted)',
  },
  cfgTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)', marginTop: '3px' },
  cfgActions: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  autosave: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  dupBtn: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-body)',
    ':hover': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-strong)' },
  },
  delBtn: { color: 'var(--ds-not-suitable, #EF4444)', background: 'transparent', border: 'none' },
  cfgBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' },

  fieldLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)', marginBottom: '8px' },
  fieldGroup: { display: 'flex', flexDirection: 'column' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  input: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    '::after': { display: 'none' },
    '& input': { borderRadius: '8px', height: '38px', fontSize: 'var(--ds-fs-body)' },
  },
  alignRow: { display: 'flex', gap: '6px' },
  alignBtn: {
    minWidth: '34px',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-body)',
  },
  alignBtnActive: {
    backgroundColor: 'var(--ds-brand-primary) !important',
    color: '#fff !important',
    border: '1px solid transparent',
  },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  metaCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
  },
  metaCellOn: { backgroundColor: 'var(--ds-surface-base)' },
  noSettings: {
    padding: '22px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
    textAlign: 'center',
  },
  noSettingsTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  noSettingsSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '4px', lineHeight: 1.45 },
  amberNote: {
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    border: '1px solid var(--ds-pending, #F59E0B)',
    fontSize: 'var(--ds-fs-caption)',
    lineHeight: 1.5,
    color: '#b45309',
  },
  amberNoteTitle: { fontWeight: 700, marginBottom: '3px' },
  hint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', lineHeight: 1.45 },

  /* Insert-value chips row */
  insertLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)', marginBottom: '8px' },

  /* Background controls */
  bgRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  bgThumb: {
    width: '52px',
    height: '52px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    objectFit: 'cover',
    backgroundColor: '#fff',
  },
  bgFileInfo: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 },
  bgFileName: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  bgFileMeta: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  sliderRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  sliderTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  slider: { width: '100%', accentColor: 'var(--ds-ai-primary, #8B5CF6)' },
  fitRow: { display: 'flex', gap: '6px' },
  posGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 26px)', gridTemplateRows: 'repeat(3, 26px)', gap: '4px' },
  posCell: {
    width: '26px',
    height: '26px',
    padding: 0,
    borderRadius: '5px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
  },
  posCellActive: { backgroundColor: 'var(--ds-brand-primary) !important', border: '1px solid transparent' },
  hiddenFile: { display: 'none' },

  /* ---- Right: preview ---- */
  pvHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--ds-border)',
    flexWrap: 'wrap',
  },
  pvTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  pvMeta: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', flex: 1 },
  zoomGroup: { display: 'inline-flex', gap: '4px' },
  zoomBtn: {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: '7px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-body)',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
  },
  zoomBtnActive: { backgroundColor: 'var(--ds-brand-primary)', color: '#fff', borderColor: 'var(--ds-brand-primary)' },
  pvBody: {
    padding: '16px',
    backgroundColor: 'var(--ds-surface-base)',
    maxHeight: 'calc(100vh - 220px)',
    overflow: 'auto',
  },
  pvScale: { transformOrigin: 'top left', width: '740px' },

  /* Zoom modal */
  zoomSurface: {
    maxWidth: '96vw',
    width: 'auto',
    padding: 0,
    backgroundColor: 'var(--ds-surface-base)',
    maxHeight: '94vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  zoomHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 18px',
    borderBottom: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
  },
  zoomBody: { padding: '20px', overflow: 'auto' },
  closeBtn: { color: 'var(--ds-text-muted)', ':hover': { color: 'var(--ds-text-strong)' } },

  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
    lineHeight: 1.5,
  },
});

type Styles = ReturnType<typeof useStyles>;

/** Left-list selection: the page-setup pseudo-item, or a block id. */
type Selection = { kind: 'page' } | { kind: 'block'; id: string };

const ZOOM_LEVELS: { key: string; label: string; scale: number | 'fit' }[] = [
  { key: 'fit', label: 'Fit', scale: 'fit' },
  { key: '75', label: '75%', scale: 0.75 },
  { key: '100', label: '100%', scale: 1 },
  { key: 'full', label: 'Full size', scale: 1 },
];

interface Props {
  templateId: string;
}

export function LetterBuilder({ templateId }: Props) {
  const styles = useStyles();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: levels } = useTemplateLevels(templateId);
  const allLevelIds = useMemo(() => (levels ?? []).map((l) => l.dnx_assessment_levelid), [levels]);
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);
  const save = useSaveLetterLayout(templateId);
  const saveBg = useSaveLetterBackground(templateId);

  const tree = useMemo(() => buildTree(levels), [levels]);
  const questionOptions = useMemo(() => flattenQuestions(tree, []), [tree]);
  const sectionOptions = useMemo(
    () =>
      tree
        .filter((n) => (n.level.dnx_assessment_level_type as LevelType) === 1)
        .map((n) => ({ levelId: n.level.dnx_assessment_levelid, name: n.level.dnx_name })),
    [tree],
  );

  const [layout, setLayout] = useState<LetterLayout | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [selection, setSelection] = useState<Selection>({ kind: 'page' });
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgRefresh, setBgRefresh] = useState(0);
  const [zoomKey, setZoomKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!template) return;
    if (seededFor.current === templateId) return;
    seededFor.current = templateId;
    setLayout(
      parseLetterLayout(template.dnx_letter_template_json) ?? {
        version: 1,
        blocks: DEFAULT_LAYOUT.blocks.map((b) => ({ ...b })),
      },
    );
  }, [template, templateId]);

  const saveRef = useRef(save.mutate);
  useEffect(() => {
    saveRef.current = save.mutate;
  });
  function commit(next: LetterLayout) {
    setLayout(next);
    setSaveState('saving');
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveRef.current(serializeLetterLayout(next), {
        onSuccess: () => setSaveState('saved'),
        onError: () => setSaveState('idle'),
      });
    }, AUTOSAVE_MS);
  }
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const backgroundUrl = useLetterBackgroundObjectUrl(
    templateId,
    !!layout?.page?.image,
    `${template?.dnx_letter_background_name ?? ''}#${bgRefresh}`,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isLoading) return <Spinner label="Loading template..." size="small" />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!layout) return null;

  const presentTypes = new Set(layout.blocks.map((b) => b.type));

  function addBlock(type: LetterBlockType) {
    const b = makeBlock(type);
    commit({ ...layout!, blocks: [...layout!.blocks, b] });
    setSelection({ kind: 'block', id: b.id });
  }
  function updateBlock(id: string, patch: Partial<LetterBlock>) {
    commit({
      ...layout!,
      blocks: layout!.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as LetterBlock) : b)),
    });
  }
  function removeBlock(id: string) {
    commit({ ...layout!, blocks: layout!.blocks.filter((b) => b.id !== id) });
    setSelection({ kind: 'page' });
  }
  function duplicateBlock(id: string) {
    const idx = layout!.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const src = layout!.blocks[idx];
    if (SINGLETON_BLOCKS.has(src.type)) return;
    const fresh = makeBlock(src.type);
    const copy = { ...fresh, ...src, id: fresh.id } as LetterBlock;
    const next = [...layout!.blocks];
    next.splice(idx + 1, 0, copy);
    commit({ ...layout!, blocks: next });
    setSelection({ kind: 'block', id: copy.id });
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = layout!.blocks.findIndex((b) => b.id === active.id);
    const to = layout!.blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    commit({ ...layout!, blocks: arrayMove(layout!.blocks, from, to) });
  }
  function updatePage(patch: Partial<PageSettings>) {
    commit({ ...layout!, page: { ...(layout!.page ?? {}), ...patch } });
  }

  async function onPickBackground(file: File | undefined) {
    setBgError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBgError('Please choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setBgError('Image is larger than 8 MB — please use a smaller file.');
      return;
    }
    try {
      await saveBg.mutateAsync(file);
      updatePage({ image: true });
      setBgRefresh((n) => n + 1);
    } catch (err) {
      setBgError((err as Error).message || 'Upload failed.');
    }
  }

  const sampleAssessment = makeSampleAssessment(template?.dnx_template_name);
  const selectedBlock =
    selection.kind === 'block' ? layout.blocks.find((b) => b.id === selection.id) : undefined;

  const previewEl = (
    <LetterPreview
      assessment={sampleAssessment}
      levels={levels ?? []}
      responses={[]}
      criteriaByLevelId={criteriaByLevelId}
      layout={layout}
      backgroundUrl={backgroundUrl}
    />
  );

  const autosaveText =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Autosaves as you edit';

  return (
    <div className={styles.root}>
      {/* ---- Left: block list ---- */}
      <div className={`${styles.card} ${styles.stickyPane}`}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Blocks</span>
          <span className={styles.listCount}>{layout.blocks.length} blocks</span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className={styles.list}>
            {/* Page setup pseudo-row (first, not draggable) */}
            <div
              className={`${styles.item} ${selection.kind === 'page' ? styles.itemActive : ''}`}
              onClick={() => setSelection({ kind: 'page' })}
            >
              <span style={{ width: 12, flexShrink: 0 }} />
              <span className={styles.itemText}>
                <span className={styles.itemName}>Page setup</span>
                <span className={styles.itemSub}>Letterhead, footer, background</span>
              </span>
            </div>

            <SortableContext items={layout.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {layout.blocks.map((block) => (
                <BlockListItem
                  key={block.id}
                  block={block}
                  styles={styles}
                  active={selection.kind === 'block' && selection.id === block.id}
                  onSelect={() => setSelection({ kind: 'block', id: block.id })}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>

        <div className={styles.addSection}>
          <div className={styles.addLabel}>Add block</div>
          <div className={styles.addBtns}>
            {(Object.keys(LETTER_BLOCK_LABEL) as LetterBlockType[]).map((t) => {
              const disabled = SINGLETON_BLOCKS.has(t) && presentTypes.has(t);
              return (
                <Button
                  key={t}
                  size="small"
                  appearance="secondary"
                  className={styles.addBtn}
                  icon={<Add16Regular />}
                  disabled={disabled}
                  onClick={() => addBlock(t)}
                  title={disabled ? `${LETTER_BLOCK_LABEL[t]} already added` : undefined}
                >
                  {LETTER_BLOCK_LABEL[t]}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Tips / legend — how to insert values in text blocks */}
        <div className={styles.tips}>
          <span className={styles.tipsLabel}>Tips</span>
          <div className={styles.tipRow}>
            In any Heading, Text, Signature or the page header/footer, type{' '}
            <span className={styles.tipKbd}>/</span> to insert a question’s answer.
          </div>
          <div className={styles.tipRow}>
            These <span className={styles.tipKbd}>{'{tokens}'}</span> merge in the assessment’s own
            details:
            <div className={styles.tipTokens}>
              {PLACEHOLDERS.map((p) => (
                <span key={p} className={styles.tipToken}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Center: config ---- */}
      <div className={styles.card}>
        {selection.kind === 'page' ? (
          <>
            <div className={styles.cfgHead}>
              <div>
                <div className={styles.cfgKicker}>Page</div>
                <div className={styles.cfgTitle}>Page setup</div>
              </div>
              <span className={styles.autosave}>{autosaveText}</span>
            </div>
            <div className={styles.cfgBody}>
              <PageSetupConfig
                styles={styles}
                layout={layout}
                questionOptions={questionOptions}
                backgroundUrl={backgroundUrl}
                backgroundName={template?.dnx_letter_background_name}
                bgError={bgError}
                bgUploading={saveBg.isPending}
                fileInputRef={fileInputRef}
                onPickBackground={onPickBackground}
                updatePage={updatePage}
              />
            </div>
          </>
        ) : selectedBlock ? (
          <>
            <div className={styles.cfgHead}>
              <div>
                <div className={styles.cfgKicker}>Block</div>
                <div className={styles.cfgTitle}>{LETTER_BLOCK_LABEL[selectedBlock.type]}</div>
              </div>
              <div className={styles.cfgActions}>
                <span className={styles.autosave}>{autosaveText}</span>
                {!SINGLETON_BLOCKS.has(selectedBlock.type) && (
                  <Button
                    size="small"
                    appearance="secondary"
                    className={styles.dupBtn}
                    onClick={() => duplicateBlock(selectedBlock.id)}
                  >
                    Duplicate
                  </Button>
                )}
                <Button
                  size="small"
                  appearance="subtle"
                  className={styles.delBtn}
                  onClick={() => removeBlock(selectedBlock.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            <div className={styles.cfgBody}>
              <BlockConfig
                block={selectedBlock}
                styles={styles}
                questionOptions={questionOptions}
                tree={tree}
                sectionOptions={sectionOptions}
                onChange={(patch) => updateBlock(selectedBlock.id, patch)}
              />
            </div>
          </>
        ) : (
          <div className={styles.empty}>Select a block on the left to configure it.</div>
        )}
      </div>

      {/* ---- Right: preview ---- */}
      <div className={`${styles.card} ${styles.stickyPane}`}>
        <div className={styles.pvHead}>
          <span className={styles.pvTitle}>Preview</span>
          <span className={styles.pvMeta}>A4 · sample data</span>
          <span className={styles.zoomGroup}>
            {ZOOM_LEVELS.map((z) => (
              <button
                key={z.key}
                type="button"
                className={styles.zoomBtn}
                onClick={() => setZoomKey(z.key)}
              >
                {z.label}
              </button>
            ))}
          </span>
        </div>
        <div className={styles.pvBody}>
          {/* Inline preview scaled to fit the panel width (~430px / 740px). */}
          <div className={styles.pvScale} style={{ transform: 'scale(0.58)', height: 'calc(1047px * 0.58)' }}>
            {previewEl}
          </div>
        </div>
      </div>

      {/* ---- Zoom modal ---- */}
      <ZoomModal
        styles={styles}
        zoomKey={zoomKey}
        onClose={() => setZoomKey(null)}
        preview={previewEl}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Zoom modal                                                                  */
/* -------------------------------------------------------------------------- */

function ZoomModal({
  styles,
  zoomKey,
  onClose,
  preview,
}: {
  styles: Styles;
  zoomKey: string | null;
  onClose: () => void;
  preview: React.ReactNode;
}) {
  const z = ZOOM_LEVELS.find((x) => x.key === zoomKey);
  const open = !!z;
  // Fit: scale the 740px page down to a comfortable width. Others: the numeric %.
  const scale = !z ? 1 : z.scale === 'fit' ? 0.9 : z.scale;
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.zoomSurface}>
        <div className={styles.zoomHead}>
          <span className={styles.pvTitle}>Letter preview — {z?.label ?? ''}</span>
          <Button
            appearance="subtle"
            className={styles.closeBtn}
            icon={<Dismiss20Regular />}
            onClick={onClose}
            aria-label="Close"
          />
        </div>
        <div className={styles.zoomBody}>
          {/* Reserve the SCALED footprint (740px page × scale) and center it, so
              the shrunk page sits in the middle rather than hugging top-left. */}
          <div style={{ width: `calc(740px * ${scale})`, margin: '0 auto' }}>
            <div
              className={styles.pvScale}
              style={{ transform: `scale(${scale})`, height: `calc(1047px * ${scale})` }}
            >
              {preview}
            </div>
          </div>
        </div>
      </DialogSurface>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Left-list item (draggable)                                                  */
/* -------------------------------------------------------------------------- */

function BlockListItem({
  block,
  styles,
  active,
  onSelect,
}: {
  block: LetterBlock;
  styles: Styles;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const blank =
    block.type === 'groupedSubsections' && (!block.sectionLevelId || !block.groupByQuestionName);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${active ? styles.itemActive : ''}`}
      onClick={onSelect}
    >
      <span
        className={`${styles.grip} blk-grip`}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <ReOrderDotsVertical24Regular />
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemName}>{LETTER_BLOCK_LABEL[block.type]}</span>
        <span className={styles.itemSub}>{blockSubtitle(block)}</span>
      </span>
      {blank && <span className={styles.blankTag}>BLANK</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-block config body                                                       */
/* -------------------------------------------------------------------------- */

interface QuestionOption {
  levelId: string;
  label: string;
  path: string;
}
interface SectionOption {
  levelId: string;
  name: string;
}

function BlockConfig({
  block,
  styles,
  questionOptions,
  tree,
  sectionOptions,
  onChange,
}: {
  block: LetterBlock;
  styles: Styles;
  questionOptions: QuestionOption[];
  tree: LevelNode[];
  sectionOptions: SectionOption[];
  onChange: (patch: Partial<LetterBlock>) => void;
}) {
  const editorHandle = useRef<{ insertToken: (id: string, name: string) => void } | null>(null);

  switch (block.type) {
    case 'heading':
      return (
        <>
          <div className={styles.fieldGroup}>
            <TokenTextEditor
              value={block.text}
              onChange={(text) => onChange({ text })}
              placeholder="Heading text"
              singleLine
              handleRef={(h) => (editorHandle.current = h)}
              questionOptions={questionOptions}
            />
            <div className={styles.alignRow} style={{ marginTop: 12 }}>
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <Button
                  key={a}
                  size="small"
                  appearance="secondary"
                  className={`${styles.alignBtn} ${block.align === a ? styles.alignBtnActive : ''}`}
                  icon={
                    a === 'left' ? <TextAlignLeft16Regular /> : a === 'center' ? <TextAlignCenter16Regular /> : <TextAlignRight16Regular />
                  }
                  onClick={() => onChange({ align: a })}
                  title={`Align ${a}`}
                />
              ))}
            </div>
          </div>
          <InsertValues styles={styles} questionOptions={questionOptions} onInsert={(id, name) => editorHandle.current?.insertToken(id, name)} />
        </>
      );
    case 'text':
    case 'signature':
      return (
        <>
          <div className={styles.fieldGroup}>
            <TokenTextEditor
              value={block.text}
              onChange={(text) => onChange({ text })}
              placeholder={block.type === 'signature' ? 'Signature / issuer line' : 'Paragraph text'}
              handleRef={(h) => (editorHandle.current = h)}
              questionOptions={questionOptions}
            />
          </div>
          <InsertValues styles={styles} questionOptions={questionOptions} onInsert={(id, name) => editorHandle.current?.insertToken(id, name)} />
        </>
      );
    case 'meta':
      return (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>Fields to show</div>
          <div className={styles.metaGrid}>
            {(Object.keys(META_FIELD_LABEL) as MetaFieldKey[]).map((f) => {
              const on = block.fields.includes(f);
              return (
                <label key={f} className={`${styles.metaCell} ${on ? styles.metaCellOn : ''}`}>
                  <Checkbox
                    checked={on}
                    onChange={(_, d) =>
                      onChange({
                        fields: d.checked ? [...block.fields, f] : block.fields.filter((x) => x !== f),
                      })
                    }
                  />
                  {META_FIELD_LABEL[f]}
                </label>
              );
            })}
          </div>
          <div className={styles.hint} style={{ marginTop: 12 }}>
            {block.fields.length} of {Object.keys(META_FIELD_LABEL).length} shown · unticked fields are
            left out of the letter entirely.
          </div>
        </div>
      );
    case 'spacer':
      return (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>Height</div>
          <Input
            className={styles.input}
            type="number"
            value={String(block.size)}
            onChange={(_, d) => onChange({ size: Math.max(0, Number(d.value) || 0) })}
            contentAfter={<span style={{ fontSize: 12 }}>px</span>}
          />
        </div>
      );
    case 'outcome':
      return (
        <NoSettings styles={styles} text="Renders the pass/fail outcome block, styled from the template." />
      );
    case 'reviewerNotes':
      return (
        <NoSettings styles={styles} text="Renders the reviewer's notes. Hidden entirely when there are none." />
      );
    case 'responses':
      return (
        <NoSettings
          styles={styles}
          text="Renders every question marked “Include in outcome letter”, grouped by section."
        />
      );
    case 'groupedSubsections': {
      const chosenSection = tree.find((n) => n.level.dnx_assessment_levelid === block.sectionLevelId);
      const questionNames = chosenSection ? subsectionQuestionNames([chosenSection]) : [];
      return (
        <>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>Block title</div>
            <Input
              className={styles.input}
              value={block.heading}
              onChange={(_, d) => onChange({ heading: d.value })}
              placeholder="Grouped subsections"
            />
          </div>
          <div className={styles.twoCol}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Section to list</div>
              <Dropdown
                value={chosenSection?.level.dnx_name ?? ''}
                selectedOptions={block.sectionLevelId ? [block.sectionLevelId] : []}
                onOptionSelect={(_, d) => onChange({ sectionLevelId: d.optionValue ?? '', groupByQuestionName: '' })}
                placeholder="Which section…"
              >
                {sectionOptions.map((sopt) => (
                  <Option key={sopt.levelId} value={sopt.levelId} text={sopt.name}>
                    {sopt.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Group by answer to</div>
              <Dropdown
                value={block.groupByQuestionName || ''}
                selectedOptions={block.groupByQuestionName ? [block.groupByQuestionName] : []}
                onOptionSelect={(_, d) => onChange({ groupByQuestionName: d.optionValue ?? '' })}
                placeholder="Which question…"
                disabled={!chosenSection}
              >
                {questionNames.map((name) => (
                  <Option key={name} value={name} text={name}>
                    {name}
                  </Option>
                ))}
              </Dropdown>
            </div>
          </div>
          <div className={styles.amberNote}>
            <div className={styles.amberNoteTitle}>Blank in preview — by design</div>
            Groups {chosenSection?.level.dnx_name ?? 'the chosen section'}'s subsections by their answer
            to {block.groupByQuestionName || 'the picked question'}. The preview has no answers, so this
            block renders empty until a real assessment is signed off.
            {chosenSection && questionNames.length === 0 && ' (No subsection questions found in this section.)'}
          </div>
        </>
      );
    }
  }
}

function NoSettings({ styles, text }: { styles: Styles; text: string }) {
  return (
    <div className={styles.noSettings}>
      <div className={styles.noSettingsTitle}>No settings</div>
      <div className={styles.noSettingsSub}>{text}</div>
    </div>
  );
}

/**
 * Insert-value chips — grey placeholder tokens + purple answer tokens. Clicking
 * a chip drops that token at the caret of the block's rich-text editor.
 */
function InsertValues({
  styles,
  questionOptions,
  onInsert,
}: {
  styles: Styles;
  questionOptions: QuestionOption[];
  onInsert: (levelId: string, name: string) => void;
}) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.insertLabel}>Insert a value</div>
      <InsertAnswer styles={styles} questionOptions={questionOptions} onInsert={onInsert} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page setup config                                                           */
/* -------------------------------------------------------------------------- */

function bgModeLabel(mode: BackgroundMode): string {
  return mode === 'cover' ? 'Fill' : mode === 'contain' ? 'Fit' : 'Tile';
}

function PageSetupConfig({
  styles,
  layout,
  questionOptions,
  backgroundUrl,
  backgroundName,
  bgError,
  bgUploading,
  fileInputRef,
  onPickBackground,
  updatePage,
}: {
  styles: Styles;
  layout: LetterLayout;
  questionOptions: QuestionOption[];
  backgroundUrl?: string;
  backgroundName?: string;
  bgError: string | null;
  bgUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickBackground: (file: File | undefined) => void;
  updatePage: (patch: Partial<PageSettings>) => void;
}) {
  const page = layout.page ?? {};
  const mode = page.backgroundMode ?? 'contain';
  return (
    <>
      <div className={styles.twoCol}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>Header (letterhead)</div>
          <TokenTextEditor
            value={page.header ?? ''}
            onChange={(header) => updatePage({ header })}
            placeholder="Org name, address…"
            questionOptions={questionOptions}
          />
        </div>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>Footer</div>
          <TokenTextEditor
            value={page.footer ?? ''}
            onChange={(footer) => updatePage({ footer })}
            placeholder="Contact line, disclaimer…"
            questionOptions={questionOptions}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldLabel}>Background image</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFile}
          onChange={(e) => {
            onPickBackground(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {page.image && backgroundUrl ? (
          <div className={styles.bgRow}>
            <img src={backgroundUrl} alt="Letter background" className={styles.bgThumb} />
            <div className={styles.bgFileInfo}>
              <span className={styles.bgFileName}>{backgroundName ?? 'background.png'}</span>
              <span className={styles.bgFileMeta}>Image background</span>
            </div>
            <Button size="small" appearance="secondary" className={styles.dupBtn} disabled={bgUploading} onClick={() => fileInputRef.current?.click()}>
              {bgUploading ? 'Uploading…' : 'Replace'}
            </Button>
            <Button size="small" appearance="subtle" className={styles.delBtn} onClick={() => updatePage({ image: false })}>
              Remove
            </Button>
          </div>
        ) : (
          <Button
            appearance="secondary"
            className={styles.dupBtn}
            icon={<Image16Regular />}
            disabled={bgUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {bgUploading ? 'Uploading…' : 'Upload image'}
          </Button>
        )}
        {bgError && <span style={{ fontSize: 12, color: 'var(--ds-not-suitable, #EF4444)', marginTop: 6 }}>{bgError}</span>}
      </div>

      {page.image && (
        <>
          <div className={styles.twoCol}>
            <div className={styles.sliderRow}>
              <div className={styles.sliderTop}>
                <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>Opacity</span>
                <span className={styles.bgFileMeta}>{Math.round((page.backgroundOpacity ?? 0.15) * 100)}%</span>
              </div>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                value={Math.round((page.backgroundOpacity ?? 0.15) * 100)}
                onChange={(e) => updatePage({ backgroundOpacity: Number(e.target.value) / 100 })}
              />
            </div>
            <div className={styles.sliderRow}>
              <div className={styles.sliderTop}>
                <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>Size</span>
                <span className={styles.bgFileMeta}>{Math.round((page.backgroundScale ?? 1) * 100)}%</span>
              </div>
              <input
                className={styles.slider}
                type="range"
                min={10}
                max={100}
                disabled={mode === 'tile'}
                value={Math.round((page.backgroundScale ?? 1) * 100)}
                onChange={(e) => updatePage({ backgroundScale: Number(e.target.value) / 100 })}
              />
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Fit</div>
              <div className={styles.fitRow}>
                {(['contain', 'cover', 'tile'] as BackgroundMode[]).map((m) => (
                  <Button
                    key={m}
                    size="small"
                    appearance="secondary"
                    className={`${styles.alignBtn} ${mode === m ? styles.alignBtnActive : ''}`}
                    onClick={() => updatePage({ backgroundMode: m })}
                  >
                    {bgModeLabel(m)}
                  </Button>
                ))}
              </div>
            </div>
            {mode !== 'tile' && (
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>Position</div>
                <div className={styles.posGrid} role="radiogroup" aria-label="Background position">
                  {BACKGROUND_POSITIONS.map((p) => {
                    const active = (page.backgroundPosition ?? 'center') === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={p.replace('-', ' ')}
                        title={p.replace('-', ' ')}
                        className={`${styles.posCell} ${active ? styles.posCellActive : ''}`}
                        onClick={() => updatePage({ backgroundPosition: p })}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {mode === 'contain' && (
            <Checkbox
              label="Bleed to page edge"
              checked={page.backgroundBleed ?? false}
              onChange={(_, d) => updatePage({ backgroundBleed: !!d.checked })}
            />
          )}
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Insert-answer picker + helpers                                              */
/* -------------------------------------------------------------------------- */

function InsertAnswer({
  styles,
  questionOptions,
  onInsert,
}: {
  styles: Styles;
  questionOptions: QuestionOption[];
  onInsert: (levelId: string, name: string) => void;
}) {
  if (questionOptions.length === 0) {
    return <div className={styles.hint}>Add questions in the Structure tab to insert their answers here.</div>;
  }
  return (
    <Combobox
      placeholder="+ Insert answer…"
      selectedOptions={[]}
      value=""
      style={{ width: '100%' }}
      onOptionSelect={(_, d) => {
        const q = questionOptions.find((o) => o.levelId === d.optionValue);
        if (q) onInsert(q.levelId, q.label);
      }}
    >
      {questionOptions.map((q) => (
        <Option key={q.levelId} value={q.levelId} text={q.label}>
          {q.path ? `${q.path} › ${q.label}` : q.label}
        </Option>
      ))}
    </Combobox>
  );
}

function subsectionQuestionNames(tree: LevelNode[]): string[] {
  const names = new Set<string>();
  const walk = (node: LevelNode, inSubsection: boolean) => {
    const type = node.level.dnx_assessment_level_type as LevelType;
    if (inSubsection && type === 3) names.add(node.level.dnx_name);
    node.children.forEach((c) => walk(c, inSubsection || type === 2));
  };
  tree.forEach((n) => walk(n, false));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function flattenQuestions(nodes: LevelNode[], prefix: string[]): QuestionOption[] {
  const out: QuestionOption[] = [];
  for (const node of nodes) {
    if ((node.level.dnx_assessment_level_type as LevelType) === 3) {
      out.push({
        levelId: node.level.dnx_assessment_levelid,
        label: node.level.dnx_name,
        path: prefix.join(' › '),
      });
    }
    if (node.children.length > 0) {
      out.push(...flattenQuestions(node.children, [...prefix, node.level.dnx_name]));
    }
  }
  return out;
}

function makeSampleAssessment(templateName?: string): Dnx_assessment_instances {
  const rec: Record<string, unknown> = {
    dnx_assessment_instanceid: 'sample',
    dnx_assessment_name: 'Sample assessment',
    dnx_version: 1,
    dnx_outcome: 2,
    dnx_outcome_notes: 'Sample reviewer notes appear here when present.',
    dnx_submittedon: new Date().toISOString().slice(0, 10),
    '_ownerid_value@OData.Community.Display.V1.FormattedValue': 'Jane Candidate',
    '_dnx_project_value@OData.Community.Display.V1.FormattedValue': 'Sample project',
    '_dnx_assessmenttemplate_value@OData.Community.Display.V1.FormattedValue': templateName ?? 'Sample template',
  };
  return rec as unknown as Dnx_assessment_instances;
}

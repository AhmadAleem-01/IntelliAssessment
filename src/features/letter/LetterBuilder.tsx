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
  Tooltip,
  makeStyles,
} from '@fluentui/react-components';
import {
  Add16Regular,
  Delete16Regular,
  Copy16Regular,
  ReOrderDotsVertical24Regular,
  TextAlignLeft16Regular,
  TextAlignCenter16Regular,
  TextAlignRight16Regular,
  ArrowCounterclockwise16Regular,
  Image16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
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

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 1fr) minmax(380px, 1fr)',
    gap: '16px',
    alignItems: 'start',
  },
  panel: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  saveState: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    fontWeight: 400,
  },
  palette: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  blockList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px 16px',
    maxHeight: '64vh',
    overflow: 'auto',
  },
  blockCard: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
  },
  blockTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  grip: {
    display: 'inline-flex',
    color: 'var(--color-text-tertiary)',
    cursor: 'grab',
    touchAction: 'none',
    ':active': { cursor: 'grabbing' },
  },
  blockType: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-purple-text)',
    flex: 1,
  },
  blockBody: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
  fixedNote: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: '2px',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px 12px',
  },
  alignRow: { display: 'flex', gap: '4px' },
  alignBtnActive: {
    backgroundColor: 'var(--color-purple-soft) !important',
    color: 'var(--color-purple-text) !important',
  },
  placeholderHint: {
    fontSize: '10px',
    color: 'var(--color-text-tertiary)',
    lineHeight: 1.5,
  },
  insertAnswer: { minWidth: 0, width: '100%' },
  iconBtn: { minWidth: 0 },
  previewWrap: {
    padding: '14px',
    backgroundColor: 'var(--color-background-tertiary)',
    // Tall enough to show a full A4 page (740px wide ≈ 1047px tall) without
    // scrolling; only scrolls when the authored letter runs longer than a page.
    maxHeight: '90vh',
    overflow: 'auto',
  },
  empty: {
    padding: '30px 16px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
  // --- Page settings (letterhead) ---
  pageSettings: {
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  pageSettingsToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    textAlign: 'left',
  },
  pageSettingsBody: {
    padding: '0 16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  bgRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  bgThumb: {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--border-radius-sm)',
    border: '0.5px solid var(--color-border-secondary)',
    objectFit: 'cover',
    backgroundColor: '#fff',
  },
  bgControls: { display: 'flex', flexDirection: 'column', gap: '10px' },
  bgControlRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  bgControlLabel: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  posGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 18px)',
    gridTemplateRows: 'repeat(3, 18px)',
    gap: '3px',
  },
  posCell: {
    width: '18px',
    height: '18px',
    padding: 0,
    borderRadius: '3px',
    border: '0.5px solid var(--color-border-secondary)',
    backgroundColor: 'var(--color-background-primary)',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--color-purple-soft)' },
  },
  posCellActive: {
    backgroundColor: 'var(--color-purple) !important',
    border: '0.5px solid var(--color-purple) !important',
  },
  hiddenFile: { display: 'none' },
});

interface Props {
  templateId: string;
}

/**
 * M8b — drag-and-drop outcome-letter designer. Author blocks (heading, text,
 * meta grid, outcome, reviewer notes, responses, signature, spacer) in any
 * order; the live preview on the right renders them with placeholder sample
 * data (a template has no single assessment to merge). Layout autosaves to the
 * template's `dnx_letter_template_json` and is consumed at letter-view time by
 * `LetterPreview`.
 */
export function LetterBuilder({ templateId }: Props) {
  const styles = useStyles();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: levels } = useTemplateLevels(templateId);
  const allLevelIds = useMemo(
    () => (levels ?? []).map((l) => l.dnx_assessment_levelid),
    [levels],
  );
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);
  const save = useSaveLetterLayout(templateId);
  const saveBg = useSaveLetterBackground(templateId);

  const tree = useMemo(() => buildTree(levels), [levels]);
  // Flat list of Question levels for the "Insert answer" picker — each with a
  // Section › Subsection breadcrumb so duplicate names are distinguishable.
  const questionOptions = useMemo(() => flattenQuestions(tree, []), [tree]);
  // Top-level Sections — the first picker on a "Grouped subsections" block.
  const sectionOptions = useMemo(
    () =>
      tree
        .filter((n) => (n.level.dnx_assessment_level_type as LevelType) === 1)
        .map((n) => ({ levelId: n.level.dnx_assessment_levelid, name: n.level.dnx_name })),
    [tree],
  );

  const [layout, setLayout] = useState<LetterLayout | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pageOpen, setPageOpen] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  // Bumped on each successful upload so the background re-downloads even when
  // the replacement has the same filename (the File column has no timestamp).
  const [bgRefresh, setBgRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // Seed local layout from the persisted JSON once the template loads. Keyed on
  // the template id so switching templates re-seeds; DEFAULT_LAYOUT when unset.
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

  // Debounced autosave whenever the layout changes. The mutate fn is captured
  // in a ref (written in an effect, not during render) so `commit` stays stable.
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

  // Background image: download the bytes → object URL (File columns aren't
  // servable by URL — see gotcha AB). Keyed on the filename + a local refresh
  // counter so a replacement re-downloads even at the same name.
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
    commit({ ...layout!, blocks: [...layout!.blocks, makeBlock(type)] });
  }
  function updateBlock(id: string, patch: Partial<LetterBlock>) {
    commit({
      ...layout!,
      blocks: layout!.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as LetterBlock) : b,
      ),
    });
  }
  function removeBlock(id: string) {
    commit({ ...layout!, blocks: layout!.blocks.filter((b) => b.id !== id) });
  }
  function duplicateBlock(id: string) {
    const idx = layout!.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const src = layout!.blocks[idx];
    if (SINGLETON_BLOCKS.has(src.type)) return; // can't duplicate a singleton
    const copy = { ...makeBlock(src.type), ...src, id: makeBlock(src.type).id };
    const next = [...layout!.blocks];
    next.splice(idx + 1, 0, copy as LetterBlock);
    commit({ ...layout!, blocks: next });
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = layout!.blocks.findIndex((b) => b.id === active.id);
    const to = layout!.blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    commit({ ...layout!, blocks: arrayMove(layout!.blocks, from, to) });
  }
  function resetToDefault() {
    commit({ version: 1, blocks: DEFAULT_LAYOUT.blocks.map((b) => ({ ...b })) });
  }

  /** Patch page-level letterhead settings, merging into any existing ones. */
  function updatePage(patch: Partial<PageSettings>) {
    const nextPage = { ...(layout!.page ?? {}), ...patch };
    commit({ ...layout!, page: nextPage });
  }

  async function onPickBackground(file: File | undefined) {
    setBgError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBgError('Please choose an image file.');
      return;
    }
    // Sanity cap on upload size (File column stores full-fidelity bytes).
    if (file.size > 8 * 1024 * 1024) {
      setBgError('Image is larger than 8 MB — please use a smaller file.');
      return;
    }
    try {
      await saveBg.mutateAsync(file);
      // Flag the layout so the renderer starts downloading the image, and bump
      // the refresh counter so a same-name replacement re-downloads.
      updatePage({ image: true });
      setBgRefresh((n) => n + 1);
    } catch (err) {
      setBgError((err as Error).message || 'Upload failed.');
    }
  }

  const sampleAssessment = makeSampleAssessment(template?.dnx_template_name);

  return (
    <div className={styles.root}>
      {/* --- Builder --- */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Letter layout</span>
          <span className={styles.saveState}>
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved'
                : 'Autosaves as you edit'}
          </span>
        </div>

        {/* --- Page settings (letterhead): header, footer, background --- */}
        <div className={styles.pageSettings}>
          <button
            type="button"
            className={styles.pageSettingsToggle}
            onClick={() => setPageOpen((v) => !v)}
            aria-expanded={pageOpen}
          >
            {pageOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
            Page settings — header, footer &amp; background
          </button>
          {pageOpen && (
            <div className={styles.pageSettingsBody}>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Header (letterhead)</span>
                <TokenTextEditor
                  value={layout.page?.header ?? ''}
                  onChange={(header) => updatePage({ header })}
                  placeholder="Header — org name, address, logo text… (leave blank for the default brand strip)"
                  questionOptions={questionOptions}
                />
              </div>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Footer</span>
                <TokenTextEditor
                  value={layout.page?.footer ?? ''}
                  onChange={(footer) => updatePage({ footer })}
                  placeholder="Footer — contact line, disclaimer… (leave blank for the default footer)"
                  questionOptions={questionOptions}
                />
              </div>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Background image</span>
                <div className={styles.bgRow}>
                  {layout.page?.image && backgroundUrl && (
                    <img src={backgroundUrl} alt="Letter background" className={styles.bgThumb} />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenFile}
                    onChange={(e) => {
                      onPickBackground(e.target.files?.[0]);
                      e.target.value = ''; // allow re-picking the same file
                    }}
                  />
                  <Button
                    size="small"
                    appearance="secondary"
                    icon={<Image16Regular />}
                    disabled={saveBg.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {saveBg.isPending
                      ? 'Uploading…'
                      : layout.page?.image
                        ? 'Replace image'
                        : 'Upload image'}
                  </Button>
                  {layout.page?.image && (
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<Delete16Regular />}
                      onClick={() => updatePage({ image: false })}
                      title="Remove background from the letter"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {bgError && (
                  <span style={{ fontSize: 11, color: 'var(--color-red-text)' }}>{bgError}</span>
                )}
                {layout.page?.image && (
                  <div className={styles.bgControls}>
                    <div className={styles.bgControlRow}>
                      <label className={styles.bgControlLabel}>
                        Fit
                        <Dropdown
                          size="small"
                          value={bgModeLabel(layout.page?.backgroundMode ?? 'contain')}
                          selectedOptions={[layout.page?.backgroundMode ?? 'contain']}
                          onOptionSelect={(_, d) =>
                            updatePage({
                              backgroundMode: (d.optionValue as BackgroundMode) ?? 'contain',
                            })
                          }
                          style={{ minWidth: 110 }}
                        >
                          <Option value="contain" text="Fit">Fit (whole image)</Option>
                          <Option value="cover" text="Cover">Cover (fill &amp; crop)</Option>
                          <Option value="tile" text="Tile">Tile</Option>
                        </Dropdown>
                      </label>
                      <label className={styles.bgControlLabel}>
                        Opacity
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((layout.page?.backgroundOpacity ?? 0.15) * 100)}
                          onChange={(e) =>
                            updatePage({ backgroundOpacity: Number(e.target.value) / 100 })
                          }
                        />
                        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 30 }}>
                          {Math.round((layout.page?.backgroundOpacity ?? 0.15) * 100)}%
                        </span>
                      </label>
                    </div>
                    {/* Scale + position only matter when the image isn't tiled. */}
                    {layout.page?.backgroundMode !== 'tile' && (
                      <div className={styles.bgControlRow}>
                        <label className={styles.bgControlLabel}>
                          Size
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={Math.round((layout.page?.backgroundScale ?? 1) * 100)}
                            onChange={(e) =>
                              updatePage({ backgroundScale: Number(e.target.value) / 100 })
                            }
                          />
                          <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 30 }}>
                            {Math.round((layout.page?.backgroundScale ?? 1) * 100)}%
                          </span>
                        </label>
                        <label className={styles.bgControlLabel}>
                          Position
                          <div
                            className={styles.posGrid}
                            role="radiogroup"
                            aria-label="Background position"
                          >
                            {BACKGROUND_POSITIONS.map((p) => {
                              const active = (layout.page?.backgroundPosition ?? 'center') === p;
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
                        </label>
                      </div>
                    )}
                    {/* Bleed only applies to Fit — Cover is already full-bleed,
                        Tile always covers the page. */}
                    {(layout.page?.backgroundMode ?? 'contain') === 'contain' && (
                      <Checkbox
                        label="Bleed to page edge (ignore margins)"
                        checked={layout.page?.backgroundBleed ?? false}
                        onChange={(_, d) => updatePage({ backgroundBleed: !!d.checked })}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.palette}>
          {(Object.keys(LETTER_BLOCK_LABEL) as LetterBlockType[]).map((t) => {
            const disabled = SINGLETON_BLOCKS.has(t) && presentTypes.has(t);
            return (
              <Button
                key={t}
                size="small"
                appearance="secondary"
                icon={<Add16Regular />}
                disabled={disabled}
                onClick={() => addBlock(t)}
                title={disabled ? `${LETTER_BLOCK_LABEL[t]} already added` : undefined}
              >
                {LETTER_BLOCK_LABEL[t]}
              </Button>
            );
          })}
          <Tooltip content="Reset to the default layout" relationship="label">
            <Button
              size="small"
              appearance="subtle"
              icon={<ArrowCounterclockwise16Regular />}
              onClick={resetToDefault}
              style={{ marginLeft: 'auto' }}
            >
              Reset
            </Button>
          </Tooltip>
        </div>

        {layout.blocks.length === 0 ? (
          <div className={styles.empty}>
            No blocks yet. Add one from the palette above to start building the letter.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={layout.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.blockList}>
                {layout.blocks.map((block) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    styles={styles}
                    questionOptions={questionOptions}
                    tree={tree}
                    sectionOptions={sectionOptions}
                    onChange={(patch) => updateBlock(block.id, patch)}
                    onRemove={() => removeBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* --- Live preview (placeholder sample data) --- */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Preview</span>
          <span className={styles.saveState}>Sample data</span>
        </div>
        <div className={styles.previewWrap}>
          <LetterPreview
            assessment={sampleAssessment}
            levels={levels ?? []}
            responses={[]}
            criteriaByLevelId={criteriaByLevelId}
            layout={layout}
            backgroundUrl={backgroundUrl}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-block editor                                                            */
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

interface BlockEditorProps {
  block: LetterBlock;
  styles: ReturnType<typeof useStyles>;
  questionOptions: QuestionOption[];
  tree: LevelNode[];
  sectionOptions: SectionOption[];
  onChange: (patch: Partial<LetterBlock>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function BlockEditor({
  block,
  styles,
  questionOptions,
  tree,
  sectionOptions,
  onChange,
  onRemove,
  onDuplicate,
}: BlockEditorProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const canDuplicate = !SINGLETON_BLOCKS.has(block.type);
  // Imperative handle for the token editor so "Insert answer" drops a chip at
  // the caret. Held in a ref so the picker and the editor share one instance.
  const editorHandle = useRef<{ insertToken: (id: string, name: string) => void } | null>(
    null,
  );

  return (
    <div ref={setNodeRef} style={style} className={styles.blockCard}>
      <div className={styles.blockTop}>
        <span className={styles.grip} {...attributes} {...listeners} aria-label="Drag to reorder">
          <ReOrderDotsVertical24Regular />
        </span>
        <span className={styles.blockType}>{LETTER_BLOCK_LABEL[block.type]}</span>
        {canDuplicate && (
          <Button
            size="small"
            appearance="subtle"
            className={styles.iconBtn}
            icon={<Copy16Regular />}
            onClick={onDuplicate}
            title="Duplicate"
          />
        )}
        <Button
          size="small"
          appearance="subtle"
          className={styles.iconBtn}
          icon={<Delete16Regular />}
          onClick={onRemove}
          title="Remove"
        />
      </div>
      <div className={styles.blockBody}>{renderBody()}</div>
    </div>
  );

  function renderBody() {
    switch (block.type) {
      case 'heading':
        return (
          <>
            <TokenTextEditor
              value={block.text}
              onChange={(text) => onChange({ text })}
              placeholder="Heading text"
              singleLine
              handleRef={(h) => (editorHandle.current = h)}
              questionOptions={questionOptions}
            />
            <div className={styles.alignRow}>
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <Button
                  key={a}
                  size="small"
                  appearance="subtle"
                  className={`${styles.iconBtn} ${block.align === a ? styles.alignBtnActive : ''}`}
                  icon={
                    a === 'left' ? (
                      <TextAlignLeft16Regular />
                    ) : a === 'center' ? (
                      <TextAlignCenter16Regular />
                    ) : (
                      <TextAlignRight16Regular />
                    )
                  }
                  onClick={() => onChange({ align: a })}
                  title={`Align ${a}`}
                />
              ))}
            </div>
            <InsertAnswer
              styles={styles}
              questionOptions={questionOptions}
              onInsert={(levelId, name) => editorHandle.current?.insertToken(levelId, name)}
            />
            <PlaceholderHint styles={styles} />
          </>
        );
      case 'text':
      case 'signature':
        return (
          <>
            <TokenTextEditor
              value={block.text}
              onChange={(text) => onChange({ text })}
              placeholder={
                block.type === 'signature' ? 'Signature / issuer line' : 'Paragraph text'
              }
              handleRef={(h) => (editorHandle.current = h)}
              questionOptions={questionOptions}
            />
            <InsertAnswer
              styles={styles}
              questionOptions={questionOptions}
              onInsert={(levelId, name) => editorHandle.current?.insertToken(levelId, name)}
            />
            <PlaceholderHint styles={styles} />
          </>
        );
      case 'meta':
        return (
          <div className={styles.metaGrid}>
            {(Object.keys(META_FIELD_LABEL) as MetaFieldKey[]).map((f) => (
              <Checkbox
                key={f}
                label={META_FIELD_LABEL[f]}
                checked={block.fields.includes(f)}
                onChange={(_, d) => {
                  const next = d.checked
                    ? [...block.fields, f]
                    : block.fields.filter((x) => x !== f);
                  onChange({ fields: next });
                }}
              />
            ))}
          </div>
        );
      case 'spacer':
        return (
          <Input
            type="number"
            value={String(block.size)}
            onChange={(_, d) => onChange({ size: Math.max(0, Number(d.value) || 0) })}
            contentAfter={<span style={{ fontSize: 11 }}>px</span>}
          />
        );
      case 'outcome':
        return <div className={styles.fixedNote}>Renders the pass/fail outcome block.</div>;
      case 'reviewerNotes':
        return (
          <div className={styles.fixedNote}>
            Renders the reviewer's notes (hidden when there are none).
          </div>
        );
      case 'responses':
        return (
          <div className={styles.fixedNote}>
            Renders every question flagged “Include in outcome letter”, grouped by section.
          </div>
        );
      case 'groupedSubsections': {
        const chosenSection = tree.find(
          (n) => n.level.dnx_assessment_levelid === block.sectionLevelId,
        );
        const questionNames = chosenSection
          ? subsectionQuestionNames([chosenSection])
          : [];
        return (
          <>
            <Input
              value={block.heading}
              onChange={(_, d) => onChange({ heading: d.value })}
              placeholder="Heading (optional)"
            />
            <Dropdown
              value={chosenSection?.level.dnx_name ?? ''}
              selectedOptions={block.sectionLevelId ? [block.sectionLevelId] : []}
              onOptionSelect={(_, d) =>
                // Changing the section invalidates the previous question choice
                // — it belonged to the old section's subsections.
                onChange({ sectionLevelId: d.optionValue ?? '', groupByQuestionName: '' })
              }
              placeholder="Which section…"
            >
              {sectionOptions.map((s) => (
                <Option key={s.levelId} value={s.levelId} text={s.name}>
                  {s.name}
                </Option>
              ))}
            </Dropdown>
            <Dropdown
              value={block.groupByQuestionName || ''}
              selectedOptions={block.groupByQuestionName ? [block.groupByQuestionName] : []}
              onOptionSelect={(_, d) =>
                onChange({ groupByQuestionName: d.optionValue ?? '' })
              }
              placeholder="Group its subsections by which question…"
              disabled={!chosenSection}
            >
              {questionNames.map((name) => (
                <Option key={name} value={name} text={name}>
                  {name}
                </Option>
              ))}
            </Dropdown>
            <div className={styles.fixedNote}>
              Groups the chosen section’s subsections by their answer to the picked
              question, and lists each subsection’s letter fields under its group.
              {chosenSection && questionNames.length === 0 &&
                ' (No subsection questions found in this section.)'}
              {' '}This block only shows content on a real, answered assessment —
              the preview here has no answers, so it renders blank.
            </div>
          </>
        );
      }
    }
  }
}

function bgModeLabel(mode: BackgroundMode): string {
  return mode === 'cover' ? 'Cover' : mode === 'contain' ? 'Fit' : 'Tile';
}

function PlaceholderHint({ styles }: { styles: ReturnType<typeof useStyles> }) {
  return (
    <div className={styles.placeholderHint}>
      Placeholders: {PLACEHOLDERS.join(' ')}
    </div>
  );
}

/**
 * "Insert answer" picker — a search-as-you-type list of the template's
 * questions. Selecting one appends its answer token to the block's text so the
 * candidate's answer to that question renders inline at letter time. Clears its
 * own selection after each insert so it reads as an action, not a bound value.
 */
function InsertAnswer({
  styles,
  questionOptions,
  onInsert,
}: {
  styles: ReturnType<typeof useStyles>;
  questionOptions: QuestionOption[];
  onInsert: (levelId: string, name: string) => void;
}) {
  if (questionOptions.length === 0) return null;
  return (
    <Combobox
      className={styles.insertAnswer}
      placeholder="+ Insert answer…"
      selectedOptions={[]}
      value=""
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

/** Flatten the level tree to Question rows with a breadcrumb path. */
/** Distinct names of Question levels that sit inside a Subsection — the
 *  candidates for the reason-grouping question (matched by name across the
 *  sibling qualification subsections). */
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

/**
 * A throwaway assessment object for the preview. Only the fields LetterPreview
 * reads matter; lookups are faked via the OData annotation keys `lookupName`
 * expects. Outcome is left Pending so the preview shows the neutral block.
 */
function makeSampleAssessment(templateName?: string): Dnx_assessment_instances {
  const rec: Record<string, unknown> = {
    dnx_assessment_instanceid: 'sample',
    dnx_assessment_name: 'Sample assessment',
    dnx_version: 1,
    dnx_outcome: 2, // Pending
    dnx_outcome_notes: 'Sample reviewer notes appear here when present.',
    dnx_submittedon: new Date().toISOString().slice(0, 10),
    '_ownerid_value@OData.Community.Display.V1.FormattedValue': 'Jane Candidate',
    '_dnx_project_value@OData.Community.Display.V1.FormattedValue': 'Sample project',
    '_dnx_assessmenttemplate_value@OData.Community.Display.V1.FormattedValue':
      templateName ?? 'Sample template',
  };
  return rec as unknown as Dnx_assessment_instances;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Textarea,
  Spinner,
  MessageBar,
  MessageBarBody,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
} from '@fluentui/react-components';
import {
  Dismiss16Regular,
  ReOrderDotsVertical24Regular,
  Add16Regular,
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
import { useTemplate, useSaveApplicationSchema } from '../templates/api';
import { useTemplateLevels, useUpdateDetailsLayout } from '../templates/levels/api';
import { buildTree } from '../templates/levels/treeBuilder';
import type { LevelType } from '../templates/levels/levelTypes';
import { flattenSchema, parseAppData, isRepeatingPath, type AppDataField } from './appData';
import {
  makeDetailsField,
  parseDetailsLayout,
  serializeDetailsLayout,
  type DetailsField,
  type DetailsLayout,
} from './detailsLayout';
import { DetailsPanel } from './DetailsPanel';

const SCHEMA_AUTOSAVE_MS = 900;

/** A section/subsection a details panel can attach to. */
interface DetailLevel {
  levelId: string;
  name: string;
  breadcrumb: string;
  type: LevelType;
}

/** Type badge for an attribute row, from its sample value. */
function typeBadge(f: AppDataField): string {
  if (f.isRepeating) return 'LIST';
  const v = f.sampleValue;
  if (v === 'true' || v === 'false') return 'BOOL';
  if (v !== '' && !Number.isNaN(Number(v))) return 'NUMBER';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 'DATE';
  return 'TEXT';
}

/** Top-level group key for an attribute path (for the schema list sections). */
function groupOf(path: string): string {
  const first = path.split(/[.[]/)[0];
  return path.includes('.') || path.includes('[') ? first : '__top__';
}

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '250px minmax(0, 1fr) 340px',
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
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
    '@media (max-width: 1180px)': { position: 'static', maxHeight: 'none', overflowY: 'visible' },
  },

  /* ---- Left: panels list ---- */
  listHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--ds-border)',
  },
  listTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  listCount: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '12px 14px',
    borderLeft: '3px solid transparent',
    borderBottom: '1px solid var(--ds-border)',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
  },
  itemActive: { backgroundColor: 'var(--ds-surface-base)', borderLeftColor: 'var(--ds-ai-primary, #8B5CF6)' },
  itemKickerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  itemKicker: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
  },
  itemName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  emptyTag: { fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ds-pending-text, #b45309)' },
  addPanelWrap: { padding: '12px 14px' },
  addPanelBtn: {
    width: '100%',
    border: '1px dashed var(--ds-border)',
    backgroundColor: 'transparent',
    color: 'var(--ds-text-body)',
    ':hover': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-strong)' },
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
  cfgActions: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  autosave: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  removeBtn: { color: 'var(--ds-not-suitable, #EF4444)', background: 'transparent', border: 'none' },
  cfgBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' },

  sectionLabelRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  sectionHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  fieldList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  fieldCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
  },
  grip: {
    display: 'inline-flex',
    color: 'var(--ds-text-muted)',
    cursor: 'grab',
    touchAction: 'none',
    flexShrink: 0,
    ':active': { cursor: 'grabbing' },
    '& svg': { width: '16px', height: '16px' },
  },
  fieldMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  fieldName: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  fieldPath: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '12px',
    color: 'var(--ds-text-muted)',
  },
  fieldSample: { textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '160px' },
  fieldSampleLabel: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
  },
  fieldSampleVal: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-body)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeField: { flexShrink: 0, color: 'var(--ds-text-muted)', ':hover': { color: 'var(--ds-not-suitable, #EF4444)' } },
  emptyFields: {
    padding: '20px',
    borderRadius: '10px',
    border: '1px dashed var(--ds-border)',
    textAlign: 'center',
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
  },

  /* Which item segmented */
  segRow: { display: 'flex', gap: '8px' },
  seg: {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-body)',
    cursor: 'pointer',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
  },
  segActive: {
    backgroundColor: 'var(--ds-brand-primary) !important',
    color: '#fff !important',
    border: '1px solid var(--ds-brand-primary) !important',
  },
  itemNumRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
  itemNumLabel: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)' },
  itemNumInput: {
    width: '64px',
    height: '34px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    padding: '0 10px',
    fontSize: 'var(--ds-fs-body)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--ds-text-strong)',
    boxSizing: 'border-box',
  },
  itemNumNote: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  /* How assessors see it */
  previewCard: {
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
    marginTop: '4px',
  },
  previewHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--ds-border)',
  },
  previewTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  previewBody: { padding: '16px', backgroundColor: 'var(--ds-surface-base)' },
  previewEmpty: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-muted)' },

  empty: {
    padding: '48px 24px',
    textAlign: 'center',
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
    lineHeight: 1.5,
  },

  /* ---- Right: schema ---- */
  schemaHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--ds-border)',
  },
  schemaTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  toggle: { display: 'inline-flex', borderRadius: '8px', border: '1px solid var(--ds-border)', overflow: 'hidden', flexShrink: 0 },
  toggleBtn: {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    // Fixed height + no-wrap so the two labels ("Attributes" / "Raw JSON") can
    // never wrap to a second line and jolt the header height.
    height: '30px',
    lineHeight: '30px',
    padding: '0 12px',
    whiteSpace: 'nowrap',
    background: 'var(--ds-surface-card)',
    border: 'none',
    color: 'var(--ds-text-body)',
    cursor: 'pointer',
  },
  // !important so the active label beats the base toggleBtn color (equal-
  // specificity Griffel atomics otherwise leave the text dark on navy).
  toggleBtnActive: {
    backgroundColor: 'var(--ds-brand-primary) !important',
    color: '#fff !important',
  },
  schemaBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  schemaHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', lineHeight: 1.45 },
  schemaError: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-not-suitable, #EF4444)' },
  attrGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  attrGroupLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    marginTop: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  listBadge: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    borderRadius: 'var(--ds-radius-pill)',
    padding: '1px 7px',
  },
  attrRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
  },
  attrRowOn: {
    borderColor: 'var(--ds-ai-primary, #8B5CF6) !important',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF) !important',
  },
  attrBox: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    border: '1.5px solid var(--ds-border-strong, #cbd5e1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    flexShrink: 0,
  },
  attrBoxOn: {
    backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
    borderColor: 'var(--ds-ai-primary, #8B5CF6) !important',
    color: '#fff !important',
  },
  attrText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  attrName: { fontSize: 'var(--ds-fs-body)', fontWeight: 500, color: 'var(--ds-text-strong)' },
  attrSample: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  attrType: { fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--ds-text-muted)', flexShrink: 0 },
  // Fluent Textarea gotcha: the ROOT owns the resize handle + fixed height; the
  // inner <textarea> must be pinned to fill it, else content overflows/clips
  // (the visible bug). Root position:relative, inner absolute to all edges.
  schemaArea: {
    position: 'relative',
    minHeight: '360px',
    height: '360px',
    resize: 'vertical',
    overflow: 'hidden',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    width: '100%',
    boxSizing: 'border-box',
  },
  schemaAreaInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    maxHeight: 'none',
    resize: 'none',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: 1.5,
  },
});

type Styles = ReturnType<typeof useStyles>;

interface Props {
  templateId: string;
}

export function DetailsBuilder({ templateId }: Props) {
  const styles = useStyles();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: levels } = useTemplateLevels(templateId);
  const saveSchema = useSaveApplicationSchema(templateId);
  const saveLayout = useUpdateDetailsLayout(templateId);

  const tree = useMemo(() => buildTree(levels), [levels]);

  // Every section/subsection a details panel can attach to.
  const detailLevels: DetailLevel[] = useMemo(() => {
    const out: DetailLevel[] = [];
    const walk = (nodes: typeof tree, prefix: string[]) => {
      for (const n of nodes) {
        const t = n.level.dnx_assessment_level_type as LevelType;
        if (t === 1 || t === 2) {
          const path = [...prefix, n.level.dnx_name];
          out.push({
            levelId: n.level.dnx_assessment_levelid,
            name: n.level.dnx_name,
            breadcrumb: path.join(' › '),
            type: t,
          });
          walk(n.children, path);
        }
      }
    };
    walk(tree, []);
    return out;
  }, [tree]);

  // Field-count per level (from its stored layout) → which levels are "panels".
  const fieldCountByLevel = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of levels ?? []) {
      if ((l.dnx_assessment_level_type as LevelType) !== 1 && (l.dnx_assessment_level_type as LevelType) !== 2) continue;
      const parsed = parseDetailsLayout(l.dnx_details_layout);
      m.set(l.dnx_assessment_levelid, parsed?.fields.length ?? 0);
    }
    return m;
  }, [levels]);

  // Panels = levels that have a layout (any fields). Ordered by the tree walk.
  const panelLevels = detailLevels.filter((l) => (fieldCountByLevel.get(l.levelId) ?? 0) > 0);
  const panelIds = new Set(panelLevels.map((l) => l.levelId));

  // --- Schema (sample JSON) ---
  const [schemaText, setSchemaText] = useState('');
  const [schemaView, setSchemaView] = useState<'attributes' | 'raw'>('attributes');
  const [schemaSaveState, setSchemaSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const seededSchemaFor = useRef<string | null>(null);
  useEffect(() => {
    if (!template) return;
    if (seededSchemaFor.current === templateId) return;
    seededSchemaFor.current = templateId;
    setSchemaText(template.dnx_application_schema ?? '');
  }, [template, templateId]);

  const saveSchemaRef = useRef(saveSchema.mutate);
  useEffect(() => {
    saveSchemaRef.current = saveSchema.mutate;
  });
  const schemaTimer = useRef<number | undefined>(undefined);
  function onSchemaChange(text: string) {
    setSchemaText(text);
    setSchemaSaveState('saving');
    if (schemaTimer.current !== undefined) window.clearTimeout(schemaTimer.current);
    schemaTimer.current = window.setTimeout(() => {
      saveSchemaRef.current(text, {
        onSuccess: () => setSchemaSaveState('saved'),
        onError: () => setSchemaSaveState('idle'),
      });
    }, SCHEMA_AUTOSAVE_MS);
  }
  useEffect(() => () => window.clearTimeout(schemaTimer.current), []);

  const parsedSchema = useMemo(() => parseAppData(schemaText), [schemaText]);
  const schemaInvalid = schemaText.trim().length > 0 && parsedSchema === null;
  const fields: AppDataField[] = useMemo(() => flattenSchema(parsedSchema), [parsedSchema]);

  // --- Selected level + its layout ---
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  // Default to the first existing panel once levels load (render-time
  // adjust-on-change, not an effect, to avoid set-state-in-effect cascades).
  if (!selectedLevelId && panelLevels.length > 0) {
    setSelectedLevelId(panelLevels[0].levelId);
  }

  const selectedLevel = useMemo(
    () => (levels ?? []).find((l) => l.dnx_assessment_levelid === selectedLevelId),
    [levels, selectedLevelId],
  );
  const selectedMeta = detailLevels.find((l) => l.levelId === selectedLevelId);
  const [layout, setLayout] = useState<DetailsLayout>({ version: 1, fields: [] });

  const seededLayoutFor = useRef<string | null>(null);
  useEffect(() => {
    if (seededLayoutFor.current === selectedLevelId) return;
    seededLayoutFor.current = selectedLevelId;
    setLayout(parseDetailsLayout(selectedLevel?.dnx_details_layout) ?? { version: 1, fields: [] });
  }, [selectedLevelId, selectedLevel]);

  function commitLayout(next: DetailsLayout) {
    setLayout(next);
    if (!selectedLevelId) return;
    saveLayout.mutate({
      levelId: selectedLevelId,
      detailsLayout: next.fields.length > 0 ? serializeDetailsLayout(next) : '',
    });
  }

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

  function toggleField(path: string) {
    const f = fields.find((x) => x.path === path);
    if (!f) return;
    if (layout.fields.some((x) => x.path === path)) {
      commitLayout({ ...layout, fields: layout.fields.filter((x) => x.path !== path) });
    } else {
      commitLayout({ ...layout, fields: [...layout.fields, makeDetailsField(path, f.label)] });
    }
  }
  function removeField(id: string) {
    commitLayout({ ...layout, fields: layout.fields.filter((f) => f.id !== id) });
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = layout.fields.findIndex((f) => f.id === active.id);
    const to = layout.fields.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    commitLayout({ ...layout, fields: arrayMove(layout.fields, from, to) });
  }

  const hasRepeating = layout.fields.some((f) => isRepeatingPath(f.path));
  // Which-item mode: undefined = every item, 0 = first, N = specific.
  const itemMode: 'first' | 'specific' | 'every' =
    layout.arrayIndex === undefined ? 'every' : layout.arrayIndex === 0 ? 'first' : 'specific';
  const sampleArrayLen = (() => {
    const rep = fields.find((f) => f.isRepeating);
    if (!rep || !parsedSchema) return 0;
    const arrKey = rep.path.split('[')[0];
    const arr = (parsedSchema as Record<string, unknown>)[arrKey];
    return Array.isArray(arr) ? arr.length : 0;
  })();

  const sampleByPath = new Map(fields.map((f) => [f.path, f.sampleValue] as const));
  const levelsWithoutPanel = detailLevels.filter((l) => !panelIds.has(l.levelId));

  return (
    <div className={styles.root}>
      {/* ---- Left: detail panels ---- */}
      <div className={`${styles.card} ${styles.stickyPane}`}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Detail panels</span>
          <span className={styles.listCount}>
            {panelLevels.length} {panelLevels.length === 1 ? 'panel' : 'panels'}
          </span>
        </div>

        {panelLevels.map((l) => {
          const count = fieldCountByLevel.get(l.levelId) ?? 0;
          const active = selectedLevelId === l.levelId;
          return (
            <div
              key={l.levelId}
              className={`${styles.item} ${active ? styles.itemActive : ''}`}
              onClick={() => setSelectedLevelId(l.levelId)}
            >
              <div className={styles.itemKickerRow}>
                <span className={styles.itemKicker}>{l.type === 1 ? 'Section' : 'Subsection'}</span>
                {count === 0 && <span className={styles.emptyTag}>EMPTY</span>}
              </div>
              <span className={styles.itemName}>{l.breadcrumb}</span>
              <span className={styles.itemSub}>
                {count} {count === 1 ? 'field' : 'fields'}
              </span>
            </div>
          );
        })}

        {/* A level being edited but not yet a "panel" (0 fields) still shows as active. */}
        {selectedLevelId && !panelIds.has(selectedLevelId) && selectedMeta && (
          <div className={`${styles.item} ${styles.itemActive}`}>
            <div className={styles.itemKickerRow}>
              <span className={styles.itemKicker}>{selectedMeta.type === 1 ? 'Section' : 'Subsection'}</span>
              <span className={styles.emptyTag}>EMPTY</span>
            </div>
            <span className={styles.itemName}>{selectedMeta.breadcrumb}</span>
            <span className={styles.itemSub}>No fields</span>
          </div>
        )}

        <div className={styles.addPanelWrap}>
          {levelsWithoutPanel.length === 0 ? (
            <Button className={styles.addPanelBtn} icon={<Add16Regular />} disabled>
              All levels have panels
            </Button>
          ) : (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button className={styles.addPanelBtn} icon={<Add16Regular />}>
                  Add panel
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {levelsWithoutPanel.map((l) => (
                    <MenuItem key={l.levelId} onClick={() => setSelectedLevelId(l.levelId)}>
                      {l.breadcrumb}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>
      </div>

      {/* ---- Center: config ---- */}
      <div className={styles.card}>
        {!selectedLevelId || !selectedMeta ? (
          <div className={styles.empty}>
            {detailLevels.length === 0
              ? 'Add sections or subsections in the Structure tab first — a details panel attaches to one of them.'
              : 'Pick a panel on the left, or add one, to choose which application-data fields it shows.'}
          </div>
        ) : (
          <>
            <div className={styles.cfgHead}>
              <div>
                <div className={styles.cfgKicker}>Shows on</div>
                <div className={styles.cfgTitle}>{selectedMeta.breadcrumb}</div>
              </div>
              <div className={styles.cfgActions}>
                <span className={styles.autosave}>Autosaves as you edit</span>
                {layout.fields.length > 0 && (
                  <Button
                    size="small"
                    appearance="subtle"
                    className={styles.removeBtn}
                    onClick={() => commitLayout({ version: 1, fields: [] })}
                  >
                    Remove panel
                  </Button>
                )}
              </div>
            </div>

            <div className={styles.cfgBody}>
              {/* Fields, in order */}
              <div>
                <div className={styles.sectionLabelRow}>
                  <span className={styles.sectionLabel}>Fields, in order</span>
                  {layout.fields.length > 0 && <span className={styles.sectionHint}>Drag to reorder</span>}
                </div>
                {layout.fields.length === 0 ? (
                  <div className={styles.emptyFields}>
                    No fields yet — tick attributes on the right to add them here.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={layout.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      <div className={styles.fieldList} style={{ marginTop: 10 }}>
                        {layout.fields.map((f) => (
                          <FieldRow
                            key={f.id}
                            field={f}
                            styles={styles}
                            sample={sampleByPath.get(f.path)}
                            onRemove={() => removeField(f.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              {/* Which item (repeating paths only) */}
              {hasRepeating && (
                <div>
                  <div className={styles.sectionLabel} style={{ marginBottom: 10 }}>
                    This panel reads a list — which item?
                  </div>
                  <div className={styles.segRow}>
                    <button
                      type="button"
                      className={`${styles.seg} ${itemMode === 'first' ? styles.segActive : ''}`}
                      onClick={() => commitLayout({ ...layout, arrayIndex: 0 })}
                    >
                      First item
                    </button>
                    <button
                      type="button"
                      className={`${styles.seg} ${itemMode === 'specific' ? styles.segActive : ''}`}
                      onClick={() => commitLayout({ ...layout, arrayIndex: Math.max(1, layout.arrayIndex ?? 1) })}
                    >
                      A specific item
                    </button>
                    <button
                      type="button"
                      className={`${styles.seg} ${itemMode === 'every' ? styles.segActive : ''}`}
                      onClick={() => commitLayout({ ...layout, arrayIndex: undefined })}
                    >
                      Every item
                    </button>
                  </div>
                  {itemMode === 'specific' && (
                    <div className={styles.itemNumRow}>
                      <span className={styles.itemNumLabel}>Item number</span>
                      <input
                        className={styles.itemNumInput}
                        type="number"
                        min={1}
                        value={String((layout.arrayIndex ?? 0) + 1)}
                        onChange={(e) => {
                          const oneBased = Number(e.target.value.trim());
                          if (!Number.isFinite(oneBased) || oneBased < 1) return;
                          commitLayout({ ...layout, arrayIndex: Math.floor(oneBased) - 1 });
                        }}
                      />
                      <span className={styles.itemNumNote}>
                        The sample JSON has {sampleArrayLen} {sampleArrayLen === 1 ? 'item' : 'items'}.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* How assessors see it */}
              <div>
                <div className={styles.previewCard}>
                  <div className={styles.previewHead}>
                    <span className={styles.previewTitle}>How assessors see it</span>
                    <span className={styles.autosave}>Sample data</span>
                  </div>
                  <div className={styles.previewBody}>
                    {layout.fields.length === 0 ? (
                      <div className={styles.previewEmpty}>Add fields to preview the panel.</div>
                    ) : !parsedSchema ? (
                      <div className={styles.previewEmpty}>
                        Add a valid sample JSON (Raw JSON, right) to preview resolved values.
                      </div>
                    ) : (
                      <DetailsPanel
                        storedLayout={serializeDetailsLayout(layout)}
                        applicationData={parsedSchema}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- Right: application schema ---- */}
      <div className={`${styles.card} ${styles.stickyPane}`}>
        <div className={styles.schemaHead}>
          <span className={styles.schemaTitle}>Application schema</span>
          <span className={styles.toggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${schemaView === 'attributes' ? styles.toggleBtnActive : ''}`}
              onClick={() => setSchemaView('attributes')}
            >
              Attributes
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${schemaView === 'raw' ? styles.toggleBtnActive : ''}`}
              onClick={() => setSchemaView('raw')}
            >
              Raw JSON
            </button>
          </span>
        </div>
        <div className={styles.schemaBody}>
          {schemaView === 'attributes' ? (
            <>
              <span className={styles.schemaHint}>
                {selectedMeta
                  ? `Tick an attribute to add it to ${selectedMeta.breadcrumb}. Every assessment supplies a file of this shape.`
                  : 'Pick a panel first, then tick attributes to add them. Every assessment supplies a file of this shape.'}
              </span>
              {fields.length === 0 ? (
                <span className={styles.schemaHint}>
                  No attributes yet — paste a sample JSON in Raw JSON to populate this list.
                </span>
              ) : (
                <AttributeList
                  styles={styles}
                  fields={fields}
                  selectedPaths={new Set(layout.fields.map((f) => f.path))}
                  disabled={!selectedLevelId}
                  onToggle={toggleField}
                />
              )}
            </>
          ) : (
            <>
              <span className={styles.schemaHint}>
                Paste a representative JSON object. Its shape becomes the attribute list and the
                answer-binding options in AI conditioning. {schemaSaveState === 'saving' ? 'Saving…' : schemaSaveState === 'saved' ? 'Saved.' : ''}
              </span>
              <Textarea
                value={schemaText}
                onChange={(_, d) => onSchemaChange(d.value)}
                placeholder={'{\n  "applicant": { "name": "Jane Doe" },\n  "qualifications": [{ "title": "BSc" }]\n}'}
                resize="none"
                className={styles.schemaArea}
                textarea={{ className: styles.schemaAreaInner }}
              />
              {schemaInvalid && (
                <span className={styles.schemaError}>
                  Not valid JSON — the attribute list stays empty until this parses.
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AttributeList({
  styles,
  fields,
  selectedPaths,
  disabled,
  onToggle,
}: {
  styles: Styles;
  fields: AppDataField[];
  selectedPaths: Set<string>;
  disabled: boolean;
  onToggle: (path: string) => void;
}) {
  // Group by top-level key, preserving first-seen order.
  const groups: { key: string; label: string; isList: boolean; items: AppDataField[] }[] = [];
  const byKey = new Map<string, number>();
  for (const f of fields) {
    const g = groupOf(f.path);
    if (!byKey.has(g)) {
      byKey.set(g, groups.length);
      groups.push({
        key: g,
        label: g === '__top__' ? 'top level' : g,
        isList: g !== '__top__' && f.isRepeating,
        items: [],
      });
    }
    const idx = byKey.get(g)!;
    groups[idx].items.push(f);
    if (f.isRepeating && g !== '__top__') groups[idx].isList = true;
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className={styles.attrGroup}>
          <span className={styles.attrGroupLabel}>
            {group.label}
            {group.isList && <span className={styles.listBadge}>LIST</span>}
          </span>
          {group.items.map((f) => {
            const on = selectedPaths.has(f.path);
            // Leaf label: last path segment, stripped of [].
            const leaf = f.path.split('.').pop()?.replace(/\[\]$/, '') ?? f.path;
            return (
              <button
                key={f.path}
                type="button"
                className={`${styles.attrRow} ${on ? styles.attrRowOn : ''}`}
                onClick={() => !disabled && onToggle(f.path)}
                disabled={disabled}
                title={f.path}
              >
                <span className={`${styles.attrBox} ${on ? styles.attrBoxOn : ''}`}>{on ? '✓' : ''}</span>
                <span className={styles.attrText}>
                  <span className={styles.attrName}>{leaf}</span>
                  {f.sampleValue !== '' && <span className={styles.attrSample}>{f.sampleValue}</span>}
                </span>
                <span className={styles.attrType}>{typeBadge(f)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

function FieldRow({
  field,
  styles,
  sample,
  onRemove,
}: {
  field: DetailsField;
  styles: Styles;
  sample: string | undefined;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const leaf = field.label ?? field.path.split('.').pop()?.replace(/\[\]$/, '') ?? field.path;
  return (
    <div ref={setNodeRef} style={style} className={styles.fieldCard}>
      <span className={styles.grip} {...attributes} {...listeners} aria-label="Drag to reorder">
        <ReOrderDotsVertical24Regular />
      </span>
      <div className={styles.fieldMain}>
        <span className={styles.fieldName}>{leaf}</span>
        <span className={styles.fieldPath}>{field.path}</span>
      </div>
      {sample !== undefined && sample !== '' && (
        <div className={styles.fieldSample}>
          <span className={styles.fieldSampleLabel}>SAMPLE</span>
          <span className={styles.fieldSampleVal}>{sample}</span>
        </div>
      )}
      <Button
        size="small"
        appearance="subtle"
        className={styles.removeField}
        icon={<Dismiss16Regular />}
        onClick={onRemove}
        title="Remove field"
      />
    </div>
  );
}

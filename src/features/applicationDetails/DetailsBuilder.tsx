import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Combobox,
  Dropdown,
  Input,
  Option,
  Textarea,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  Delete16Regular,
  ReOrderDotsVertical24Regular,
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
import { useTemplate, useSaveApplicationSchema } from '../templates/api';
import { useTemplateLevels, useUpdateDetailsLayout } from '../templates/levels/api';
import { buildTree } from '../templates/levels/treeBuilder';
import type { LevelType } from '../templates/levels/levelTypes';
import {
  flattenSchema,
  parseAppData,
  isRepeatingPath,
  type AppDataField,
} from './appData';
import {
  makeDetailsField,
  parseDetailsLayout,
  serializeDetailsLayout,
  type DetailsField,
  type DetailsLayout,
} from './detailsLayout';
import { DetailsPanel } from './DetailsPanel';

const SCHEMA_AUTOSAVE_MS = 900;

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, 1fr)',
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
  saveState: { fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 400 },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  schemaToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    padding: 0,
    textAlign: 'left',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: { fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)' },
  hint: { fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.5 },
  schemaError: { fontSize: '11px', color: 'var(--color-red-text)' },
  // Fluent's Textarea root can be sized, but the inner <textarea> keeps its own
  // small default height and scrolls inside — so size the inner element too.
  schemaArea: { height: '180px' },
  schemaAreaInner: {
    height: '100%',
    maxHeight: 'none',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  chosenList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  grip: {
    display: 'inline-flex',
    color: 'var(--color-text-tertiary)',
    cursor: 'grab',
    touchAction: 'none',
    ':active': { cursor: 'grabbing' },
  },
  fieldPath: {
    flex: 1,
    minWidth: 0,
    fontSize: '12px',
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fieldPathCode: {
    fontSize: '10px',
    color: 'var(--color-text-tertiary)',
    fontFamily: 'monospace',
  },
  emptyChosen: {
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: '4px 2px',
  },
  // preview
  previewCard: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '10px 12px',
    marginBottom: '10px',
    backgroundColor: 'var(--color-background-primary)',
  },
  previewLevel: { fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' },
  previewRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '3px 0', fontSize: '12px' },
  previewKey: { color: 'var(--color-text-secondary)' },
  previewVal: { color: 'var(--color-text-primary)' },
  previewEmpty: { fontSize: '12px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' },
  previewWrap: { padding: '14px 16px' },
});

interface Props {
  templateId: string;
}

/**
 * Details tab — authoring for the application-details feature.
 *
 * Two responsibilities in one tab:
 *  1. Author the template's **sample JSON** (`dnx_application_schema`) — the
 *     fixed shape every assessment of this template supplies. Autosaved.
 *  2. For a chosen Section/Subsection, **drag-drop which JSON attributes** to
 *     show at assessment time (persisted per-level in `dnx_details_layout`).
 *
 * The right pane previews the chosen fields resolved against the sample JSON.
 * Reuses the letter builder's @dnd-kit + debounced-autosave pattern.
 */
export function DetailsBuilder({ templateId }: Props) {
  const styles = useStyles();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: levels } = useTemplateLevels(templateId);
  const saveSchema = useSaveApplicationSchema(templateId);
  const saveLayout = useUpdateDetailsLayout(templateId);

  const tree = useMemo(() => buildTree(levels), [levels]);
  // Sections + subsections (types 1 & 2) — the levels a details panel can attach to.
  const detailLevels = useMemo(() => {
    const out: { levelId: string; label: string }[] = [];
    const walk = (nodes: typeof tree, prefix: string[]) => {
      for (const n of nodes) {
        const t = n.level.dnx_assessment_level_type as LevelType;
        if (t === 1 || t === 2) {
          const path = [...prefix, n.level.dnx_name];
          out.push({
            levelId: n.level.dnx_assessment_levelid,
            label: path.join(' › '),
          });
          walk(n.children, path);
        }
      }
    };
    walk(tree, []);
    return out;
  }, [tree]);

  // --- Schema (sample JSON) local state, seeded once + debounced autosave ---
  const [schemaText, setSchemaText] = useState<string>('');
  const [schemaOpen, setSchemaOpen] = useState(true);
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

  // --- Chosen level + its details layout ---
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const selectedLevel = useMemo(
    () => (levels ?? []).find((l) => l.dnx_assessment_levelid === selectedLevelId),
    [levels, selectedLevelId],
  );
  const [layout, setLayout] = useState<DetailsLayout>({ version: 1, fields: [] });
  // Re-seed the layout whenever the selected level changes (from its stored JSON).
  const seededLayoutFor = useRef<string | null>(null);
  useEffect(() => {
    if (seededLayoutFor.current === selectedLevelId) return;
    seededLayoutFor.current = selectedLevelId;
    setLayout(
      parseDetailsLayout(selectedLevel?.dnx_details_layout) ?? { version: 1, fields: [] },
    );
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

  function addField(path: string) {
    const f = fields.find((x) => x.path === path);
    if (!f) return;
    if (layout.fields.some((x) => x.path === path)) return; // no dupes
    commitLayout({ ...layout, fields: [...layout.fields, makeDetailsField(path, f.label)] });
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

  const unusedFields = fields.filter((f) => !layout.fields.some((c) => c.path === f.path));

  return (
    <div className={styles.root}>
      {/* --- Authoring --- */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Application details</span>
          <span className={styles.saveState}>
            {schemaSaveState === 'saving' ? 'Saving…' : schemaSaveState === 'saved' ? 'Saved' : ''}
          </span>
        </div>
        <div className={styles.body}>
          {/* Schema editor */}
          <div className={styles.fieldGroup}>
            <button
              type="button"
              className={styles.schemaToggle}
              onClick={() => setSchemaOpen((v) => !v)}
              aria-expanded={schemaOpen}
            >
              {schemaOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
              Application schema (sample JSON)
            </button>
            {schemaOpen && (
              <>
                <span className={styles.hint}>
                  Paste a representative JSON object for this template. Its shape becomes the
                  list of attributes you can show below and bind to questions in the AI
                  conditioning tab. Every assessment supplies a file of this shape.
                </span>
                <Textarea
                  value={schemaText}
                  onChange={(_, d) => onSchemaChange(d.value)}
                  placeholder={'{\n  "applicant": { "name": "Jane Doe", "dob": "1990-01-01" },\n  "quals": [{ "title": "BSc" }]\n}'}
                  resize="vertical"
                  className={styles.schemaArea}
                  textarea={{ className: styles.schemaAreaInner }}
                />
                {schemaInvalid && (
                  <span className={styles.schemaError}>
                    Not valid JSON — the attribute list below stays empty until this parses.
                  </span>
                )}
              </>
            )}
          </div>

          {/* Level picker */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Show details on…</span>
            <Dropdown
              value={detailLevels.find((l) => l.levelId === selectedLevelId)?.label ?? ''}
              selectedOptions={selectedLevelId ? [selectedLevelId] : []}
              onOptionSelect={(_, d) => setSelectedLevelId(d.optionValue ?? '')}
              placeholder="Pick a section or subsection…"
            >
              {detailLevels.map((l) => (
                <Option key={l.levelId} value={l.levelId} text={l.label}>
                  {l.label}
                </Option>
              ))}
            </Dropdown>
            {detailLevels.length === 0 && (
              <span className={styles.hint}>
                Add sections/subsections in the Structure tab first.
              </span>
            )}
          </div>

          {/* Chosen fields (drag-drop) + add picker */}
          {selectedLevelId && (
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Fields to show (drag to reorder)</span>
              {layout.fields.length === 0 ? (
                <span className={styles.emptyChosen}>
                  No fields yet — add one below to show it on this level.
                </span>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={layout.fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={styles.chosenList}>
                      {layout.fields.map((f) => (
                        <FieldRow
                          key={f.id}
                          field={f}
                          styles={styles}
                          onRemove={() => removeField(f.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              {fields.length > 0 ? (
                <Combobox
                  placeholder="+ Add a field…"
                  selectedOptions={[]}
                  value=""
                  onOptionSelect={(_, d) => d.optionValue && addField(d.optionValue)}
                >
                  {unusedFields.map((f) => (
                    <Option key={f.path} value={f.path} text={f.path}>
                      {f.label} — {f.path}
                    </Option>
                  ))}
                </Combobox>
              ) : (
                <span className={styles.hint}>
                  Add a valid sample JSON above to populate the field list.
                </span>
              )}
              {/* Array-index pin: only relevant when the panel shows a
                  repeating ([]) attribute. Lets a fixed subsection map to one
                  element (e.g. "Qualification 2" → item 2). */}
              {layout.fields.some((f) => isRepeatingPath(f.path)) && (
                <label className={styles.fieldGroup} style={{ marginTop: 4 }}>
                  <span className={styles.fieldLabel}>
                    Show array item # (blank = list every item)
                  </span>
                  <Input
                    type="number"
                    min={1}
                    style={{ maxWidth: 140 }}
                    value={
                      layout.arrayIndex === undefined ? '' : String(layout.arrayIndex + 1)
                    }
                    placeholder="all"
                    onChange={(_, d) => {
                      const n = d.value.trim();
                      if (n === '') {
                        commitLayout({ ...layout, arrayIndex: undefined });
                        return;
                      }
                      const oneBased = Number(n);
                      if (!Number.isFinite(oneBased) || oneBased < 1) return;
                      commitLayout({ ...layout, arrayIndex: Math.floor(oneBased) - 1 });
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Preview (resolves against the sample JSON) --- */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Preview</span>
          <span className={styles.saveState}>Sample data</span>
        </div>
        <div className={styles.previewWrap}>
          {!selectedLevelId ? (
            <div className={styles.previewEmpty}>
              Pick a section or subsection to preview its details panel.
            </div>
          ) : layout.fields.length === 0 ? (
            <div className={styles.previewEmpty}>No fields added yet.</div>
          ) : !parsedSchema ? (
            <div className={styles.previewEmpty}>
              Add a valid sample JSON above to preview resolved values.
            </div>
          ) : (
            // Render through the real DetailsPanel against the sample JSON so the
            // preview matches the assessment exactly (incl. array-index pinning
            // and per-item repeating blocks).
            <DetailsPanel
              storedLayout={serializeDetailsLayout(layout)}
              applicationData={parsedSchema}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FieldRow({
  field,
  styles,
  onRemove,
}: {
  field: DetailsField;
  styles: ReturnType<typeof useStyles>;
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
  return (
    <div ref={setNodeRef} style={style} className={styles.fieldCard}>
      <span className={styles.grip} {...attributes} {...listeners} aria-label="Drag to reorder">
        <ReOrderDotsVertical24Regular />
      </span>
      <div className={styles.fieldPath}>
        {field.label ?? field.path}
        <div className={styles.fieldPathCode}>{field.path}</div>
      </div>
      <Button
        size="small"
        appearance="subtle"
        icon={<Delete16Regular />}
        onClick={onRemove}
        title="Remove"
      />
    </div>
  );
}

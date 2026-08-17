import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  Input,
  Dropdown,
  Option,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular } from '@fluentui/react-icons';
import { useTemplates } from './api';
import { NewTemplateDialog } from './NewTemplateDialog';
import { useTemplateLevels } from './levels/api';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';
import type { Dnx_assessment_templates } from '../../generated/models/Dnx_assessment_templatesModel';
import { useAssessmentInstances } from '../assessments/api';
import { SegmentedControl } from '../../components/SegmentedControl';

/*
 * Templates list — Design System v1.0. A table with Template / Structure /
 * In use / Updated / Status columns, filter tabs, and search + sort.
 *
 * "In use" (N assessments · N projects) is computed from a single instances
 * query grouped by template. "Structure" counts need each template's level
 * tree — fetched lazily and CAPPED (STRUCTURE_CAP rows) so we never fire an
 * unbounded number of per-template queries.
 */
const STRUCTURE_CAP = 15;
const GRID = '2.6fr 1.5fr 1.3fr 0.9fr 1fr';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subtitle: { color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    flexShrink: 0,
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
  },

  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  toolbarSpacer: { flex: 1 },
  search: {
    minWidth: '240px',
    borderRadius: '6px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    height: '40px',
    '::after': { display: 'none' },
    '& input': { borderRadius: '6px', height: '38px', fontSize: 'var(--ds-fs-body)' },
  },
  sort: {
    minWidth: '160px',
    borderRadius: '6px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    '::after': { display: 'none' },
    '& button': {
      border: 'none',
      backgroundColor: 'transparent',
      height: '38px',
      fontSize: 'var(--ds-fs-body)',
      fontWeight: 500,
      color: 'var(--ds-text-strong)',
    },
  },

  table: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
  },
  thead: {
    display: 'grid',
    gridTemplateColumns: GRID,
    gap: '16px',
    padding: '12px 20px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
    borderBottom: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-base)',
  },
  theadStatus: { textAlign: 'right' },
  row: {
    display: 'grid',
    gridTemplateColumns: GRID,
    gap: '16px',
    padding: '16px 20px',
    alignItems: 'center',
    borderBottom: '1px solid var(--ds-border)',
    textDecoration: 'none',
    color: 'inherit',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
    ':last-child': { borderBottom: 'none' },
  },

  /* Template cell */
  tName: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  tNameTop: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  tTitle: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  vBadge: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-muted)',
    flexShrink: 0,
  },
  tDesc: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  /* Structure chips */
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--ds-text-body)',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-pill)',
    padding: '3px 9px',
    whiteSpace: 'nowrap',
  },
  chipMuted: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  /* In use cell */
  useMain: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-strong)', fontWeight: 500 },
  useSub: { fontSize: '11px', color: 'var(--ds-text-muted)' },
  useNever: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-muted)' },
  useNeverSub: { fontSize: '11px', color: 'var(--ds-text-muted)' },

  updated: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-body)' },

  statusCell: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
  },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },

  empty: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px dashed var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '56px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  emptyTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  emptySub: { color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)', maxWidth: '400px' },
  emptyFilter: { padding: '40px 0', textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  Draft: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)', label: 'Draft' },
  Published: { bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)', label: 'Published' },
  Deprecated: { bg: 'var(--ds-not-suitable-soft)', color: '#b91c1c', dot: 'var(--ds-not-suitable)', label: 'Deprecated' },
  Active: { bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)', label: 'Active' },
  Inactive: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)', label: 'Inactive' },
};

function statusLabel(code: number | undefined): string {
  if (!code) return 'Draft';
  return (
    Dnx_assessment_templatesstatuscode[
      code as keyof typeof Dnx_assessment_templatesstatuscode
    ] ?? 'Draft'
  );
}

type Filter = 'all' | 'published' | 'drafts' | 'inuse' | 'never';
type SortKey = 'used' | 'updated' | 'name';

const SORT_LABEL: Record<SortKey, string> = {
  used: 'Sort: most used',
  updated: 'Sort: recently updated',
  name: 'Sort: name',
};

interface Usage {
  assessments: number;
  projects: number;
}

export function TemplatesPage() {
  const styles = useStyles();
  const { data, isLoading, error } = useTemplates();
  const { data: instances } = useAssessmentInstances();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('used');

  // Usage per template from a single instances query: count instances and
  // distinct projects that reference each template.
  const usageByTemplate = useMemo(() => {
    const map = new Map<string, { assessments: number; projects: Set<string> }>();
    for (const inst of instances ?? []) {
      const tid = (inst as unknown as Record<string, unknown>)['_dnx_assessmenttemplate_value'] as
        | string
        | undefined;
      if (!tid) continue;
      const entry = map.get(tid) ?? { assessments: 0, projects: new Set<string>() };
      entry.assessments += 1;
      const pid = (inst as unknown as Record<string, unknown>)['_dnx_project_value'] as string | undefined;
      if (pid) entry.projects.add(pid);
      map.set(tid, entry);
    }
    const out = new Map<string, Usage>();
    for (const [tid, e] of map) out.set(tid, { assessments: e.assessments, projects: e.projects.size });
    return out;
  }, [instances]);

  const usageFor = (t: Dnx_assessment_templates): Usage =>
    usageByTemplate.get(t.dnx_assessment_templateid) ?? { assessments: 0, projects: 0 };

  const all = data ?? [];

  const counts = useMemo(() => {
    let published = 0;
    let drafts = 0;
    let inuse = 0;
    let never = 0;
    for (const t of all) {
      const st = statusLabel(t.statuscode);
      if (st === 'Published' || st === 'Active') published += 1;
      if (st === 'Draft') drafts += 1;
      if (usageFor(t).assessments > 0) inuse += 1;
      else never += 1;
    }
    return { all: all.length, published, drafts, inuse, never };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, usageByTemplate]);

  const shown = useMemo(() => {
    let list = all.filter((t) => {
      const st = statusLabel(t.statuscode);
      if (filter === 'published') return st === 'Published' || st === 'Active';
      if (filter === 'drafts') return st === 'Draft';
      if (filter === 'inuse') return usageFor(t).assessments > 0;
      if (filter === 'never') return usageFor(t).assessments === 0;
      return true;
    });
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          (t.dnx_template_name ?? '').toLowerCase().includes(q) ||
          (t.dnx_description ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'name') return (a.dnx_template_name ?? '').localeCompare(b.dnx_template_name ?? '');
      if (sort === 'updated') return (b.modifiedon ? +new Date(b.modifiedon) : 0) - (a.modifiedon ? +new Date(a.modifiedon) : 0);
      return usageFor(b).assessments - usageFor(a).assessments; // most used
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, usageByTemplate, filter, search, sort]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Templates</h1>
          <div className={styles.subtitle}>
            {counts.all} template{counts.all === 1 ? '' : 's'} · {counts.inuse} in use ·{' '}
            {counts.drafts} draft{counts.drafts === 1 ? '' : 's'}
          </div>
        </div>
        <NewTemplateDialog
          trigger={
            <Button appearance="primary" icon={<Add16Regular />} className={styles.primaryBtn}>
              New template
            </Button>
          }
        />
      </div>

      {isLoading && <Spinner label="Loading templates..." />}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{(error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      {data && data.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No templates yet</div>
          <div className={styles.emptySub}>
            Templates define the structure of an assessment — sections, subsections, and
            questions. Create your first one to start authoring.
          </div>
          <NewTemplateDialog
            trigger={
              <Button appearance="primary" icon={<Add16Regular />} className={styles.primaryBtn}>
                Create your first template
              </Button>
            }
          />
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <SegmentedControl<Filter>
              ariaLabel="Filter templates"
              value={filter}
              onChange={setFilter}
              items={[
                { key: 'all', label: 'All', count: counts.all },
                { key: 'published', label: 'Published', count: counts.published },
                { key: 'drafts', label: 'Drafts', count: counts.drafts },
                { key: 'inuse', label: 'In use', count: counts.inuse },
                { key: 'never', label: 'Never used', count: counts.never },
              ]}
            />
            <span className={styles.toolbarSpacer} />
            <Input
              className={styles.search}
              appearance="outline"
              placeholder="Search templates"
              value={search}
              onChange={(_, d) => setSearch(d.value)}
            />
            <Dropdown
              className={styles.sort}
              appearance="outline"
              value={SORT_LABEL[sort]}
              selectedOptions={[sort]}
              onOptionSelect={(_, d) => setSort((d.optionValue as SortKey) ?? 'used')}
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <Option key={k} value={k} text={SORT_LABEL[k]}>
                  {SORT_LABEL[k]}
                </Option>
              ))}
            </Dropdown>
          </div>

          <div className={styles.table}>
            <div className={styles.thead}>
              <span>Template</span>
              <span>Structure</span>
              <span>In use</span>
              <span>Updated</span>
              <span className={styles.theadStatus}>Status</span>
            </div>

            {shown.length === 0 ? (
              <div className={styles.emptyFilter}>No templates in this view.</div>
            ) : (
              shown.map((t, i) => {
                const status = STATUS_STYLES[statusLabel(t.statuscode)] ?? STATUS_STYLES.Draft;
                const usage = usageFor(t);
                return (
                  <Link
                    key={t.dnx_assessment_templateid}
                    to={`/templates/${t.dnx_assessment_templateid}/edit`}
                    className={styles.row}
                  >
                    <span className={styles.tName}>
                      <span className={styles.tNameTop}>
                        <span className={styles.tTitle}>{t.dnx_template_name}</span>
                        <span className={styles.vBadge}>v{t.dnx_template_version ?? 1}</span>
                      </span>
                      {t.dnx_description && <span className={styles.tDesc}>{t.dnx_description}</span>}
                    </span>

                    {i < STRUCTURE_CAP ? (
                      <StructureCell styles={styles} templateId={t.dnx_assessment_templateid} />
                    ) : (
                      <span className={styles.chipMuted}>—</span>
                    )}

                    <span>
                      {usage.assessments > 0 ? (
                        <>
                          <div className={styles.useMain}>
                            {usage.assessments} assessment{usage.assessments === 1 ? '' : 's'}
                          </div>
                          <div className={styles.useSub}>
                            {usage.projects} project{usage.projects === 1 ? '' : 's'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.useNever}>Never used</div>
                          <div className={styles.useNeverSub}>Safe to edit or delete</div>
                        </>
                      )}
                    </span>

                    <span className={styles.updated}>
                      {t.modifiedon
                        ? new Date(t.modifiedon).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                        : '—'}
                    </span>

                    <span className={styles.statusCell}>
                      <span className={styles.statusPill} style={{ backgroundColor: status.bg, color: status.color }}>
                        <span className={styles.statusDot} style={{ backgroundColor: status.dot }} />
                        {status.label}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Structure counts for one template — section/subsection/question chips.
 * Its own component so the `useTemplateLevels` query is only mounted for the
 * capped set of rows (the parent renders this for the first STRUCTURE_CAP only).
 */
function StructureCell({
  styles,
  templateId,
}: {
  styles: ReturnType<typeof useStyles>;
  templateId: string;
}) {
  const { data: levels, isLoading } = useTemplateLevels(templateId);
  if (isLoading || !levels) return <span className={styles.chipMuted}>…</span>;

  let sections = 0;
  let subsections = 0;
  let questions = 0;
  for (const l of levels) {
    const t = l.dnx_assessment_level_type;
    if (t === 1) sections += 1;
    else if (t === 2) subsections += 1;
    else if (t === 3) questions += 1;
  }
  if (sections + subsections + questions === 0) {
    return <span className={styles.chipMuted}>Empty</span>;
  }
  return (
    <span className={styles.chips}>
      {sections > 0 && <span className={styles.chip}>{sections} section{sections === 1 ? '' : 's'}</span>}
      {subsections > 0 && (
        <span className={styles.chip}>{subsections} subsection{subsections === 1 ? '' : 's'}</span>
      )}
      {questions > 0 && <span className={styles.chip}>{questions} question{questions === 1 ? '' : 's'}</span>}
    </span>
  );
}

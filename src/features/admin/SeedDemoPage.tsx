import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  Database20Regular,
  CheckmarkCircle16Filled,
  ErrorCircle16Filled,
  Sparkle16Filled,
} from '@fluentui/react-icons';
import { seedDemo, type SeedStep, type SeedResult } from './seedDemo';
import { seedAiDemo, type AiSeedResult } from './seedAiDemo';
import { seedLetterDemo, type LetterSeedResult } from './seedLetterDemo';
import {
  seedApplicationDetailsDemo,
  type AppDetailsSeedResult,
} from './seedApplicationDetailsDemo';

const useStyles = makeStyles({
  root: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  header: { marginBottom: '20px' },
  title: {
    fontSize: '20px',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--ds-text-body)',
    marginTop: '6px',
    lineHeight: 1.5,
  },
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '18px',
    marginBottom: '14px',
  },
  warningBox: {
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    border: '1px solid var(--ds-pending, #F59E0B)',
    color: 'var(--ds-text-strong)',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    lineHeight: 1.5,
    marginBottom: '14px',
  },
  warningTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#b45309',
    marginBottom: '4px',
  },
  runBtn: {
    backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
    color: '#fff !important',
    border: '1px solid var(--ds-ai-primary, #8B5CF6) !important',
    ':hover': {
      backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
      border: '1px solid var(--ds-ai-primary, #8B5CF6) !important',
    },
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-surface-base)',
  },
  stepPending: { color: 'var(--ds-text-muted)' },
  stepDone: { color: 'var(--ds-text-strong)' },
  stepError: { color: '#b91c1c' },
  stepIcon: { display: 'inline-flex', flexShrink: 0 },
  stepBullet: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1.5px solid var(--ds-text-muted)',
    display: 'inline-block',
  },
  spinDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1.5px solid var(--ds-ai-primary, #8B5CF6)',
    borderTopColor: 'transparent',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
  stepMeta: {
    fontSize: '10px',
    color: 'var(--ds-text-muted)',
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    marginLeft: 'auto',
  },
  resultLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
  },
  resultLink: {
    color: 'var(--ds-ai-primary, #8B5CF6)',
    fontWeight: 500,
    textDecoration: 'none',
    fontSize: '13px',
    ':hover': { textDecoration: 'underline' },
  },
});

/**
 * Demo data seeder.
 *
 * Mounted at /admin/seed. Single button kicks off `seedDemo()` which builds a
 * coherent dataset (one project, one rich template with rules at every cascade
 * tier, three assessments at varied states). Progress streams into the
 * step list below so the user sees what's happening — useful both as
 * feedback and as a hint that the seed touched real data.
 *
 * Re-running creates a duplicate set; this page intentionally does not check
 * for existing demo data, since detecting "demo-ness" reliably is fragile.
 */
export function SeedDemoPage() {
  const styles = useStyles();
  const [steps, setSteps] = useState<SeedStep[]>([]);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [aiResult, setAiResult] = useState<AiSeedResult | null>(null);
  const [letterResult, setLetterResult] = useState<LetterSeedResult | null>(null);
  const [appDataResult, setAppDataResult] = useState<AppDetailsSeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<null | 'full' | 'ai' | 'letter' | 'appdata'>(null);

  /** Shared runner for all seeders — same step-streaming + error handling. */
  async function run<T>(
    kind: 'full' | 'ai' | 'letter' | 'appdata',
    fn: (p: typeof setSteps) => Promise<T>,
    onDone: (r: T) => void,
  ) {
    setRunning(kind);
    setError(null);
    setResult(null);
    setAiResult(null);
    setLetterResult(null);
    setAppDataResult(null);
    setSteps([]);
    try {
      onDone(await fn(setSteps));
    } catch (e) {
      console.error('[seed] failed', e);
      setError((e as Error).message);
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.status === 'pending');
        if (idx < 0) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], status: 'error', message: (e as Error).message };
        return copy;
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Database20Regular /> Seed demo data
        </h1>
        <div className={styles.subtitle}>
          <b>Run full seed</b> — a project, a rich template with rules at every
          cascade tier, and three assessments at varied states (Draft,
          In&nbsp;progress with a reviewer flag, Complete + Suitable).
          <br />
          <b>Seed AI demo</b> — a leaner project whose questions each carry an AI
          evidence binding, plus a blank assessment ready for the auto-fill
          walkthrough. Pair it with the documents in <code>demo-files/</code>.
          <br />
          <b>Seed letter demo</b> — a "Qualifications" section with 5
          subsections, each carrying its own Reason answer, on an assessment
          that's fully answered with a varied mix. The letter layout is
          pre-built with a Grouped subsections block, so View letter shows the
          grouping immediately.
          <br />
          <b>Seed application-details demo</b> — a template with a sample JSON schema,
          detail panels on a section + subsection, and AI bindings that reference JSON
          attributes; plus an assessment with its matching JSON file already uploaded.
        </div>
      </div>

      <div className={styles.warningBox}>
        <div className={styles.warningTitle}>Heads up</div>
        Writes real rows into Dataverse under your signed-in identity. Re-running
        creates a second copy each time — clean up via the maker portal if you
        end up with too many.
      </div>

      <div className={styles.card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            className={styles.runBtn}
            icon={<Sparkle16Filled />}
            disabled={running !== null}
            onClick={() => run('full', seedDemo, setResult)}
          >
            {running === 'full' ? 'Seeding…' : 'Run full seed'}
          </Button>
          <Button
            appearance="secondary"
            icon={<Sparkle16Filled />}
            disabled={running !== null}
            onClick={() => run('ai', seedAiDemo, setAiResult)}
          >
            {running === 'ai' ? 'Seeding…' : 'Seed AI demo'}
          </Button>
          <Button
            appearance="secondary"
            icon={<Sparkle16Filled />}
            disabled={running !== null}
            onClick={() => run('letter', seedLetterDemo, setLetterResult)}
          >
            {running === 'letter' ? 'Seeding…' : 'Seed letter demo'}
          </Button>
          <Button
            appearance="secondary"
            icon={<Sparkle16Filled />}
            disabled={running !== null}
            onClick={() => run('appdata', seedApplicationDetailsDemo, setAppDataResult)}
          >
            {running === 'appdata' ? 'Seeding…' : 'Seed application-details demo'}
          </Button>
        </div>

        {error && (
          <MessageBar intent="error" style={{ marginTop: 14 }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {steps.length > 0 && (
          <div className={styles.stepList} style={{ marginTop: 16 }}>
            {steps.map((s) => (
              <div
                key={s.key}
                className={`${styles.step} ${
                  s.status === 'done'
                    ? styles.stepDone
                    : s.status === 'error'
                      ? styles.stepError
                      : styles.stepPending
                }`}
              >
                <span className={styles.stepIcon} aria-hidden>
                  {s.status === 'done' ? (
                    <CheckmarkCircle16Filled
                      style={{ color: '#047857' }}
                    />
                  ) : s.status === 'error' ? (
                    <ErrorCircle16Filled style={{ color: '#b91c1c' }} />
                  ) : running !== null ? (
                    <span className={styles.spinDot} />
                  ) : (
                    <span className={styles.stepBullet} />
                  )}
                </span>
                <span>{s.label}</span>
                {s.message && <span className={styles.stepMeta}>{s.message}</span>}
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className={styles.resultLinks}>
            <MessageBar intent="success" style={{ marginTop: 16 }}>
              <MessageBarBody>
                Seed complete. Jump straight in:
              </MessageBarBody>
            </MessageBar>
            <Link className={styles.resultLink} to={`/projects/${result.projectId}`}>
              → Open the demo project
            </Link>
            <Link
              className={styles.resultLink}
              to={`/templates/${result.templateId}/edit`}
            >
              → Open the demo template (Scoring tab shows the full rule cascade)
            </Link>
            {result.instanceIds.map((id, i) => (
              <Link key={id} className={styles.resultLink} to={`/assessments/${id}`}>
                → Open demo assessment {i + 1}
              </Link>
            ))}
          </div>
        )}

        {aiResult && (
          <div className={styles.resultLinks}>
            <MessageBar intent="success" style={{ marginTop: 16 }}>
              <MessageBarBody>
                AI demo seeded. Upload the files in <code>demo-files/</code> to the
                assessment’s evidence area, then run AI auto-fill and map these file
                variables: {aiResult.fileVariables.join(', ')}.
              </MessageBarBody>
            </MessageBar>
            <Link
              className={styles.resultLink}
              to={`/assessments/${aiResult.instanceId}`}
            >
              → Open the AI demo assessment (upload evidence → AI auto-fill)
            </Link>
            <Link
              className={styles.resultLink}
              to={`/templates/${aiResult.templateId}/edit`}
            >
              → Open the AI demo template (AI conditioning tab shows the bindings)
            </Link>
            <Link className={styles.resultLink} to={`/projects/${aiResult.projectId}`}>
              → Open the AI demo project
            </Link>
          </div>
        )}

        {letterResult && (
          <div className={styles.resultLinks}>
            <MessageBar intent="success" style={{ marginTop: 16 }}>
              <MessageBarBody>
                Letter demo seeded. The layout is pre-built — open View letter on
                the assessment to see the grouping immediately, or open the
                template's Letter tab to see it authored (Section: “
                {letterResult.sectionName}”, grouped by “
                {letterResult.groupByQuestionName}”).
              </MessageBarBody>
            </MessageBar>
            <Link
              className={styles.resultLink}
              to={`/assessments/${letterResult.instanceId}`}
            >
              → Open the letter demo assessment (View letter → grouped qualifications)
            </Link>
            <Link
              className={styles.resultLink}
              to={`/templates/${letterResult.templateId}/edit`}
            >
              → Open the letter demo template (Letter tab shows the block config)
            </Link>
            <Link
              className={styles.resultLink}
              to={`/projects/${letterResult.projectId}`}
            >
              → Open the letter demo project
            </Link>
          </div>
        )}

        {appDataResult && (
          <div className={styles.resultLinks}>
            <MessageBar intent="success" style={{ marginTop: 16 }}>
              <MessageBarBody>
                Application-details demo seeded. The assessment already has its JSON
                file uploaded — open it to see the detail panels resolve, then run AI
                auto-fill (a "Judged from application data" group answers from the JSON
                with no evidence file needed).
              </MessageBarBody>
            </MessageBar>
            <Link
              className={styles.resultLink}
              to={`/assessments/${appDataResult.instanceId}`}
            >
              → Open the demo assessment (detail panels + AI auto-fill from JSON)
            </Link>
            <Link
              className={styles.resultLink}
              to={`/templates/${appDataResult.templateId}/edit`}
            >
              → Open the template (Details tab = sample JSON + panels; AI conditioning = bindings)
            </Link>
            <Link className={styles.resultLink} to={`/projects/${appDataResult.projectId}`}>
              → Open the demo project
            </Link>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13 }}>
                Template sample JSON (copy into the Details tab)
              </summary>
              <pre
                style={{
                  background: 'var(--ds-surface-base)',
                  border: '1px solid var(--ds-border)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  overflow: 'auto',
                }}
              >
                {appDataResult.sampleJson}
              </pre>
            </details>
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13 }}>
                Per-assessment JSON (already uploaded; copy to reuse elsewhere)
              </summary>
              <pre
                style={{
                  background: 'var(--ds-surface-base)',
                  border: '1px solid var(--ds-border)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  overflow: 'auto',
                }}
              >
                {appDataResult.instanceJson}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

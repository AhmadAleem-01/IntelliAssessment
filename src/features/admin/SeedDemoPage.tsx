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

const useStyles = makeStyles({
  root: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  header: { marginBottom: '20px' },
  title: {
    fontSize: '20px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    marginTop: '6px',
    lineHeight: 1.5,
  },
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '18px',
    marginBottom: '14px',
  },
  warningBox: {
    backgroundColor: 'var(--color-amber-soft)',
    border: '0.5px solid var(--color-amber)',
    color: 'var(--color-text-primary)',
    padding: '12px 14px',
    borderRadius: 'var(--border-radius-md)',
    fontSize: '12px',
    lineHeight: 1.5,
    marginBottom: '14px',
  },
  warningTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-amber-text)',
    marginBottom: '4px',
  },
  runBtn: {
    backgroundColor: 'var(--color-purple) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-purple) !important',
    ':hover': {
      backgroundColor: 'var(--color-purple-text) !important',
      border: '0.5px solid var(--color-purple-text) !important',
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
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  stepPending: { color: 'var(--color-text-tertiary)' },
  stepDone: { color: 'var(--color-text-primary)' },
  stepError: { color: 'var(--color-red-text)' },
  stepIcon: { display: 'inline-flex', flexShrink: 0 },
  stepBullet: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1.5px solid var(--color-text-tertiary)',
    display: 'inline-block',
  },
  spinDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1.5px solid var(--color-purple)',
    borderTopColor: 'transparent',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
  stepMeta: {
    fontSize: '10px',
    color: 'var(--color-text-tertiary)',
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
    color: 'var(--color-purple-text)',
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
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    setSteps([]);
    try {
      const out = await seedDemo(setSteps);
      setResult(out);
    } catch (e) {
      console.error('[seedDemo] failed', e);
      setError((e as Error).message);
      // Mark any currently-pending step as error so the failure has a visible home.
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.status === 'pending');
        if (idx < 0) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], status: 'error', message: (e as Error).message };
        return copy;
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Database20Regular /> Seed demo data
        </h1>
        <div className={styles.subtitle}>
          One-click loader that creates a project, a rich template with rules at
          every cascade tier, and three assessments at varied states (Draft,
          In&nbsp;progress with a reviewer flag, Complete + Suitable). Designed
          for screenshots and live walkthroughs.
        </div>
      </div>

      <div className={styles.warningBox}>
        <div className={styles.warningTitle}>Heads up</div>
        Writes real rows into Dataverse under your signed-in identity. Re-running
        creates a second copy each time — clean up via the maker portal if you
        end up with too many.
      </div>

      <div className={styles.card}>
        <Button
          className={styles.runBtn}
          icon={<Sparkle16Filled />}
          disabled={running}
          onClick={handleRun}
        >
          {running ? 'Seeding…' : 'Run seed'}
        </Button>

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
                      style={{ color: 'var(--color-green-text)' }}
                    />
                  ) : s.status === 'error' ? (
                    <ErrorCircle16Filled style={{ color: 'var(--color-red-text)' }} />
                  ) : running ? (
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
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Spinner,
  makeStyles,
} from '@fluentui/react-components';
import {
  ArrowDownload20Regular,
  DocumentText20Regular,
} from '@fluentui/react-icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { useTemplateLevels } from '../templates/levels/api';
import { useAssessmentResponses } from '../assessments/api';
import { useCriteriaForLevels } from '../rules/api';
import { useTemplate, useLetterBackgroundObjectUrl } from '../templates/api';
import { lookupId } from '../../lib/dataverse';
import { LetterPreview } from './LetterPreview';
import { parseLetterLayout } from './letterLayout';
import { buildLetterDocxBlob, type DocxLetterhead } from './letterToDocx';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '880px',
    width: '94vw',
    // The letter has its own fixed-width design; keep the dialog body
    // scrollable when the letter is taller than the viewport.
    maxHeight: '90vh',
  },
  content: {
    padding: '0',
    backgroundColor: 'var(--ds-surface-base)',
    overflow: 'auto',
    maxHeight: '70vh',
  },
  printBtn: {
    backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
    color: '#fff !important',
    border: '1px solid var(--ds-ai-primary, #8B5CF6) !important',
    ':hover': {
      backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
      border: '1px solid var(--ds-ai-primary, #8B5CF6) !important',
    },
  },
  loadingPad: {
    padding: '60px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
});

/** Load an image URL just to read its intrinsic pixel size. Resolves null on error. */
function imageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Best-effort image type for the docx ImageRun, inferred from the filename. */
function guessImageType(name: string | undefined): 'png' | 'jpg' | 'gif' | 'bmp' {
  const u = (name ?? '').toLowerCase();
  if (u.includes('.jpg') || u.includes('.jpeg')) return 'jpg';
  if (u.includes('.gif')) return 'gif';
  if (u.includes('.bmp')) return 'bmp';
  return 'png';
}

/** Shared download-filename slug — used by both the PDF and Word export. */
function safeFileName(assessment: Dnx_assessment_instances): string {
  return (assessment.dnx_assessment_name || 'assessment')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

interface Props {
  assessment: Dnx_assessment_instances;
  trigger: React.ReactElement;
}

export function LetterDialog({ assessment, trigger }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<null | 'pdf' | 'word'>(null);
  const letterRef = useRef<HTMLDivElement | null>(null);
  const templateId = lookupId(assessment, 'dnx_assessmenttemplate');
  const instanceId = assessment.dnx_assessment_instanceid;

  // Only fetch when the dialog is open — letter generation is a rare action,
  // no point keeping the level/response/criteria queries warm otherwise.
  const { data: levels, isLoading: levelsLoading } = useTemplateLevels(
    open ? templateId : undefined,
  );
  const { data: responses, isLoading: respLoading } = useAssessmentResponses(
    open ? instanceId : undefined,
  );
  const { data: template } = useTemplate(open ? templateId ?? undefined : undefined);
  const layout = parseLetterLayout(template?.dnx_letter_template_json);
  const allLevelIds = (levels ?? []).map((l) => l.dnx_assessment_levelid);
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);
  // Letter background: download bytes → object URL (see gotcha AB).
  const backgroundUrl = useLetterBackgroundObjectUrl(
    open ? templateId ?? undefined : undefined,
    !!layout?.page?.image,
    template?.dnx_letter_background_name,
  );

  const loading = open && (levelsLoading || respLoading);
  const ready = open && !loading && levels && responses;

  /**
   * One-click PDF download. Strategy: rasterise the letter DOM at 2× pixel
   * density via html2canvas, then page through the resulting PNG using
   * jsPDF, splitting at A4 boundaries. Beats `window.print()` because the
   * user doesn't have to pick "Save as PDF" in the print dialog — and dodges
   * the Fluent portal multi-page duplication artefacts entirely.
   */
  async function handleDownload() {
    if (!letterRef.current || downloading) return;
    setDownloading('pdf');
    try {
      const canvas = await html2canvas(letterRef.current, {
        // 2× pixel density keeps text crisp on the PDF at A4 width.
        scale: 2,
        // Force white so the dialog backdrop / theme tints don't bleed.
        backgroundColor: '#ffffff',
        // Same-origin only — we don't load remote images so this is moot.
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');

      // A4 in mm. jsPDF works in user-space units; we picked mm so page
      // measurements are intuitive.
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const imgWidthMm = pageWidthMm;
      const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

      // If the rendered letter is taller than one A4 page, paginate by
      // shifting the image up the page each iteration. The full PNG is
      // embedded once per page with a negative Y offset that places the
      // next slice at the top.
      let remaining = imgHeightMm;
      let yOffset = 0;
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidthMm, imgHeightMm);
      remaining -= pageHeightMm;
      while (remaining > 0) {
        yOffset -= pageHeightMm;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidthMm, imgHeightMm);
        remaining -= pageHeightMm;
      }

      pdf.save(`outcome-letter-${safeFileName(assessment)}.pdf`);
    } catch (err) {
      console.error('[letter download] failed', err);
    } finally {
      setDownloading(null);
    }
  }

  /**
   * One-click Word (.docx) download. Unlike the PDF path, this doesn't
   * rasterise the DOM — `letterToDocx` builds a real `docx.Document` straight
   * from the same `LetterData` the on-screen preview renders, so the result is
   * an editable Word file with actual text, not an embedded image.
   */
  async function handleDownloadWord() {
    if (!ready || downloading) return;
    setDownloading('word');
    try {
      // Pull the background image bytes for the Word export only when the layout
      // uses one — the on-screen/PDF path renders it straight from the URL, but
      // docx needs the raw bytes embedded. Failure here is non-fatal: the doc
      // still generates, just without the background.
      let letterhead: DocxLetterhead | undefined;
      if (layout?.page?.image && templateId) {
        try {
          const client = getClient(dataSourcesInfo);
          const r = await client.downloadFileFromRecord(
            'dnx_assessment_templates',
            templateId,
            'dnx_letter_background',
          );
          if (r.success && r.data) {
            // Read intrinsic dimensions so the docx export can preserve aspect
            // ratio (avoids the full-page stretch). Uses the already-loaded
            // object URL; falls back to no dims (full-page fit) if it fails.
            const dims = backgroundUrl ? await imageDimensions(backgroundUrl) : undefined;
            letterhead = {
              backgroundBytes: r.data,
              backgroundType: guessImageType(template?.dnx_letter_background_name),
              backgroundWidth: dims?.width,
              backgroundHeight: dims?.height,
              backgroundMode: layout?.page?.backgroundMode ?? 'contain',
              backgroundScale: layout?.page?.backgroundScale ?? 1,
              backgroundPosition: layout?.page?.backgroundPosition ?? 'center',
              backgroundBleed: layout?.page?.backgroundBleed ?? false,
            };
          }
        } catch (bgErr) {
          console.warn('[letter word] background fetch failed, exporting without it', bgErr);
        }
      }
      const blob = await buildLetterDocxBlob(
        assessment,
        levels!,
        responses!,
        criteriaByLevelId,
        layout,
        letterhead,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outcome-letter-${safeFileName(assessment)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[letter word download] failed', err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            {loading && (
              <div className={styles.loadingPad}>
                <Spinner label="Preparing letter..." size="small" />
              </div>
            )}
            {ready && (
              <div ref={letterRef}>
                <LetterPreview
                  assessment={assessment}
                  levels={levels!}
                  responses={responses!}
                  criteriaByLevelId={criteriaByLevelId}
                  layout={layout}
                  backgroundUrl={backgroundUrl}
                />
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                Close
              </Button>
            </DialogTrigger>
            <Button
              type="button"
              icon={<ArrowDownload20Regular />}
              disabled={!ready || downloading !== null}
              onClick={handleDownloadWord}
            >
              {downloading === 'word' ? 'Preparing…' : 'Download Word'}
            </Button>
            <Button
              className={styles.printBtn}
              type="button"
              icon={<ArrowDownload20Regular />}
              disabled={!ready || downloading !== null}
              onClick={handleDownload}
            >
              {downloading === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Default trigger button — reused across pages so the styling stays consistent. */
export function LetterTriggerButton() {
  return (
    <Button appearance="secondary" icon={<DocumentText20Regular />}>
      View letter
    </Button>
  );
}

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
import { ArrowDownload20Regular, DocumentText20Regular } from '@fluentui/react-icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { useTemplateLevels } from '../templates/levels/api';
import { useAssessmentResponses } from '../assessments/api';
import { useCriteriaForLevels } from '../rules/api';
import { useTemplate } from '../templates/api';
import { lookupId } from '../../lib/dataverse';
import { LetterPreview } from './LetterPreview';
import { parseLetterLayout } from './letterLayout';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '880px',
    width: '94vw',
    // The letter has its own fixed-width design; keep the dialog body
    // scrollable when the letter is taller than the viewport.
    maxHeight: '90vh',
  },
  content: {
    padding: '0',
    backgroundColor: 'var(--color-background-tertiary)',
    overflow: 'auto',
    maxHeight: '70vh',
  },
  printBtn: {
    backgroundColor: 'var(--color-purple) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-purple) !important',
    ':hover': {
      backgroundColor: 'var(--color-purple-text) !important',
      border: '0.5px solid var(--color-purple-text) !important',
    },
  },
  loadingPad: {
    padding: '60px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
});

interface Props {
  assessment: Dnx_assessment_instances;
  trigger: React.ReactElement;
}

export function LetterDialog({ assessment, trigger }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
    setDownloading(true);
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

      const safeName = (assessment.dnx_assessment_name || 'assessment')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
      pdf.save(`outcome-letter-${safeName}.pdf`);
    } catch (err) {
      console.error('[letter download] failed', err);
    } finally {
      setDownloading(false);
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
              className={styles.printBtn}
              type="button"
              icon={<ArrowDownload20Regular />}
              disabled={!ready || downloading}
              onClick={handleDownload}
            >
              {downloading ? 'Preparing…' : 'Download PDF'}
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

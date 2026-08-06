import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { parseEvidenceBinding } from '../templates/levels/evidenceBinding';
import { parseDetailsLayout } from './detailsLayout';
import type { AppDataPath } from './appData';

/**
 * Every application-details attribute path the template actually **uses** —
 * i.e. bound to a question's AI judgement (`applicationDataPaths` in the
 * evidence binding) or shown in a Section/Subsection details panel
 * (`dnx_details_layout`). These are the paths whose absence from an
 * assessment's uploaded JSON silently blanks a panel or starves an AI binding,
 * so they're exactly what we validate an uploaded file against.
 *
 * Pure + de-duplicated; order is questions-then-panels as encountered.
 */
export function collectUsedPaths(
  levels: Dnx_assessment_levels[] | undefined,
): AppDataPath[] {
  const seen = new Set<AppDataPath>();
  const out: AppDataPath[] = [];
  const add = (p: string) => {
    const path = p.trim();
    if (path && !seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  };
  for (const l of levels ?? []) {
    const binding = parseEvidenceBinding(l.dnx_document_type_reference);
    binding?.applicationDataPaths?.forEach(add);
    parseDetailsLayout(l.dnx_details_layout)?.fields.forEach((f) => add(f.path));
  }
  return out;
}

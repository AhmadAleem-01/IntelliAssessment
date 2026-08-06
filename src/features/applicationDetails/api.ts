import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';
import { assessmentKeys } from '../assessments/api';
import { parseAppData } from './appData';

/**
 * Upload a per-assessment application-details JSON into the instance's
 * `dnx_application_details` File column (gotcha O two-part write — the instance
 * row already exists, so this is a one-step `uploadFileToRecord`). Accepts the
 * raw JSON string; `uploadFileToRecord` takes a string directly. Invalidates
 * the instance detail query so the new `_name` propagates.
 */
export function useSaveApplicationDetails(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { json: string; fileName: string }): Promise<void> => {
      const client = getClient(dataSourcesInfo);
      const r = await client.uploadFileToRecord(
        'dnx_assessment_instances',
        instanceId,
        'dnx_application_details',
        params.fileName,
        params.json,
      );
      if (
        r &&
        typeof r === 'object' &&
        'success' in r &&
        (r as { success: boolean }).success === false
      ) {
        console.error('[save application details] failed', r);
        throw new Error('Failed to upload the application-details file.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.detail(instanceId) });
    },
  });
}

/**
 * Read the per-assessment application-details JSON back as a parsed object.
 *
 * A File column isn't servable by URL, so this downloads the bytes via
 * `downloadFileFromRecord` (same approach as the letter background) and JSON-
 * parses them. Only fetches when `enabled` and an `instanceId` is present.
 * `refreshKey` (e.g. `dnx_application_details_name` + a client counter) forces a
 * re-download after a replacement upload. Returns `{ data, loading }`.
 */
export function useApplicationDetails(
  instanceId: string | undefined,
  enabled: boolean,
  refreshKey?: number | string,
): { data: Record<string, unknown> | null; loading: boolean } {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!instanceId || !enabled) {
      // Clear asynchronously — never call setState synchronously in an effect.
      Promise.resolve().then(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    (async () => {
      try {
        const client = getClient(dataSourcesInfo);
        const r = await client.downloadFileFromRecord(
          'dnx_assessment_instances',
          instanceId,
          'dnx_application_details',
        );
        if (cancelled) return;
        if (r.success && r.data && r.data.byteLength > 0) {
          const text = new TextDecoder().decode(r.data);
          setData(parseAppData(text));
        } else {
          setData(null);
        }
      } catch (err) {
        console.warn('[application details] load failed', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId, enabled, refreshKey]);

  return { data: enabled ? data : null, loading };
}

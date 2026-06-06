import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GetSharepointFilesService } from '../../generated/services/GetSharepointFilesService';
import { UploadSharepointFileService } from '../../generated/services/UploadSharepointFileService';
import { DeleteaSharepointfileService } from '../../generated/services/DeleteaSharepointfileService';
import { DocumentTextExtractionFlowService } from '../../generated/services/DocumentTextExtractionFlowService';
import { AIAgentFlowService } from '../../generated/services/AIAgentFlowService';

/**
 * Hooks wrapping the Power Automate flows that bridge the app to SharePoint
 * + Azure AI. Each flow takes one or two `text` fields; this layer hides the
 * encoding so feature code reads as `useUploadEvidence().mutate(files)` etc.
 *
 * Flow contracts (per the manual triggers configured in Power Automate):
 *   - UploadSharepointFile(text=JSON[{file_name,file_content_base64}], text_1=assessmentName) → "Files Uploaded Successfully"
 *   - GetSharepointFiles(text=assessmentName) → JSON[{file_name,file_content,file_path}]
 *   - DeleteaSharepointfile(text=fileName, text_1=assessmentName) → void
 *   - DocumentTextExtractionFlow(text=fileName, text_1=assessmentName) → extracted content
 *   - AIAgentFlow(text=query) → llm response
 */

export interface EvidenceFile {
  fileName: string;
  /** Base64-encoded contents — returned by GetSharepointFiles so the app can
   *  re-render the file as a download without a second round-trip. Be aware
   *  this means the list payload scales with the number of files. */
  fileContent: string;
  filePath: string;
}

export const evidenceKeys = {
  all: ['evidence'] as const,
  byAssessment: (assessmentName: string) =>
    [...evidenceKeys.all, 'byAssessment', assessmentName] as const,
};

/** Cast helper kept locally so the file isn't peppered with `as unknown as` noise. */
function asInput<T>(value: T): T {
  return value;
}

/** Read a single File via the FileReader API and return its base64 payload
 *  (the data: URL prefix is stripped). Used by the upload flow contract. */
async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl looks like `data:application/pdf;base64,JVBERi0x...` — strip
      // the prefix so the flow only receives the raw base64 body.
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

/** Files attached to an assessment, fetched from SharePoint via the Get flow. */
export function useEvidenceFiles(assessmentName: string | undefined) {
  return useQuery({
    queryKey: evidenceKeys.byAssessment(assessmentName ?? ''),
    enabled: !!assessmentName,
    queryFn: async (): Promise<EvidenceFile[]> => {
      const r = await GetSharepointFilesService.Run(
        asInput({ text: assessmentName! }),
      );
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Failed to load evidence files');
      }
      const raw = r.data?.file_data;
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => {
          const rawName = String(item.file_name ?? '');
          const filePath = String(item.file_path ?? '');
          // Power Automate's `Get file content using path` returns an object
          // wrapper of the form { "$content-type": "...", "$content": "..." }.
          // When the flow embeds that raw, `file_content` lands here as an
          // object; unwrap to the bare base64 string. Plain-string responses
          // (other flow shapes) pass through unchanged.
          const fileContentRaw: unknown = item.file_content;
          let fileContent = '';
          if (typeof fileContentRaw === 'string') {
            fileContent = fileContentRaw;
          } else if (
            fileContentRaw &&
            typeof fileContentRaw === 'object' &&
            '$content' in fileContentRaw
          ) {
            const inner = (fileContentRaw as { $content?: unknown }).$content;
            fileContent = typeof inner === 'string' ? inner : '';
          }
          // SharePoint's `Name` token strips the extension; `FullPath` keeps
          // it. Pull the basename out of the path so downstream flows
          // (extract, delete) get the file name they need.
          const nameFromPath = filePath
            ? filePath.split(/[\\/]/).pop() ?? rawName
            : rawName;
          // Prefer whichever variant actually has an extension. If both
          // lack one (rare — local dev), just take the path-derived name.
          const hasExt = (s: string) => /\.[A-Za-z0-9]{1,8}$/.test(s);
          const fileName = hasExt(nameFromPath)
            ? nameFromPath
            : hasExt(rawName)
              ? rawName
              : nameFromPath || rawName;
          return {
            fileName,
            fileContent,
            filePath,
          };
        });
      } catch (e) {
        console.warn('[useEvidenceFiles] failed to parse file_data', e);
        return [];
      }
    },
  });
}

export function useUploadEvidence(assessmentName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]): Promise<string> => {
      if (files.length === 0) return '';
      // Read every file in parallel — small enough payloads that there's no
      // point chunking unless the user is uploading dozens at once.
      const encoded = await Promise.all(
        files.map(async (f) => ({
          file_name: f.name,
          file_content: await fileToBase64(f),
        })),
      );
      const r = await UploadSharepointFileService.Run(
        asInput({
          text: JSON.stringify(encoded),
          text_1: assessmentName,
        }),
      );
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Upload failed');
      }
      return r.data?.response ?? 'Uploaded';
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.byAssessment(assessmentName) });
    },
  });
}

export function useDeleteEvidence(assessmentName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileName: string): Promise<void> => {
      const r = await DeleteaSharepointfileService.Run(
        asInput({ text: fileName, text_1: assessmentName }),
      );
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.byAssessment(assessmentName) });
    },
  });
}

export function useExtractDocumentText(assessmentName: string) {
  return useMutation({
    mutationFn: async (fileName: string): Promise<string> => {
      const r = await DocumentTextExtractionFlowService.Run(
        asInput({ text: fileName, text_1: assessmentName }),
      );
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Extraction failed');
      }
      return r.data?.content ?? '';
    },
  });
}

/** Free-form prompt → LLM response. Exposed for a future Ask-AI UI. */
export function useAskAI() {
  return useMutation({
    mutationFn: async (query: string): Promise<string> => {
      const r = await AIAgentFlowService.Run(asInput({ text: query }));
      if (!r.success) {
        throw new Error(r.error?.message ?? 'AI agent failed');
      }
      return r.data?.response ?? '';
    },
  });
}

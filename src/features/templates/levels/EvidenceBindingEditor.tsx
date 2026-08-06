import { useMemo, useState } from 'react';
import {
  Field,
  Input,
  Textarea,
  Button,
  Combobox,
  Option,
  Tag,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Save16Regular, Dismiss16Regular } from '@fluentui/react-icons';
import type { Dnx_assessment_levels } from '../../../generated/models/Dnx_assessment_levelsModel';
import { useUpdateEvidenceBinding } from './api';
import { useTemplate } from '../api';
import { flattenSchema, parseAppData } from '../../applicationDetails/appData';
import {
  parseEvidenceBinding,
  serializeEvidenceBinding,
  type EvidenceBinding,
} from './evidenceBinding';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '14px' },
  fields: { display: 'flex', flexDirection: 'column', gap: '14px' },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    alignItems: 'center',
  },
  clearBtn: { marginRight: 'auto' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' },
});

const EMPTY: EvidenceBinding = { fileVariable: '', query: '' };

interface Props {
  level: Dnx_assessment_levels;
  templateId: string;
  /** Called after a successful save / clear so the parent can collapse the row. */
  onSaved?: () => void;
}

/**
 * Inline editor for one Question's AI evidence binding (file variable +
 * extraction query). Lives in the AI conditioning tab. Loads the level's
 * current binding from `dnx_document_type_reference`, edits the two fields,
 * and persists via `useUpdateEvidenceBinding` (a targeted patch that doesn't
 * round-trip the whole level form). See gotcha V for the storage shape.
 */
export function EvidenceBindingEditor({ level, templateId, onSaved }: Props) {
  const styles = useStyles();
  const save = useUpdateEvidenceBinding(templateId);
  const { data: template } = useTemplate(templateId);
  const [binding, setBinding] = useState<EvidenceBinding>(
    () => parseEvidenceBinding(level.dnx_document_type_reference) ?? { ...EMPTY },
  );

  // Application-details attributes available to bind (from the template's
  // sample JSON authored in the Details tab). Empty when no schema is set.
  const attrFields = useMemo(
    () => flattenSchema(parseAppData(template?.dnx_application_schema)),
    [template?.dnx_application_schema],
  );
  const selectedPaths = binding.applicationDataPaths ?? [];
  function togglePath(path: string) {
    setBinding((b) => {
      const cur = b.applicationDataPaths ?? [];
      const next = cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path];
      return { ...b, applicationDataPaths: next };
    });
  }

  async function handleSave() {
    await save.mutateAsync({
      levelId: level.dnx_assessment_levelid,
      documentTypeReference: serializeEvidenceBinding(binding) ?? '',
    });
    onSaved?.();
  }

  async function handleClear() {
    setBinding({ ...EMPTY });
    await save.mutateAsync({
      levelId: level.dnx_assessment_levelid,
      documentTypeReference: '',
    });
    onSaved?.();
  }

  return (
    <div className={styles.root}>
      {save.error && (
        <MessageBar intent="error">
          <MessageBarBody>{(save.error as Error).message}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.fields}>
        <Field
          label="Evidence file variable"
          hint="A placeholder name for the evidence this question reads (e.g. q1-resume). The assessor maps it to a real uploaded file at assessment time."
        >
          <Input
            value={binding.fileVariable}
            onChange={(_, d) => setBinding((b) => ({ ...b, fileVariable: d.value }))}
            placeholder="e.g. q1-resume"
            maxLength={100}
          />
        </Field>
        <Field
          label="Extraction query"
          hint="Tell the AI what to find and how to answer this question from the evidence text."
        >
          <Textarea
            value={binding.query}
            onChange={(_, d) => setBinding((b) => ({ ...b, query: d.value }))}
            placeholder="e.g. If the extracted text contains a bachelor's degree, set this to true."
            rows={3}
            maxLength={1000}
          />
        </Field>
        {attrFields.length > 0 && (
          <Field
            label="Application-data attributes"
            hint="Structured facts from the assessment's application-details JSON to feed this question's AI judgement. Only the ticked attributes are sent."
          >
            <Combobox
              multiselect
              placeholder="Pick attributes…"
              selectedOptions={selectedPaths}
              value=""
              onOptionSelect={(_, d) => d.optionValue && togglePath(d.optionValue)}
            >
              {attrFields.map((f) => (
                <Option key={f.path} value={f.path} text={f.path}>
                  {f.label} — {f.path}
                </Option>
              ))}
            </Combobox>
            {selectedPaths.length > 0 && (
              <div className={styles.chips}>
                {selectedPaths.map((p) => (
                  <Tag
                    key={p}
                    size="small"
                    dismissible
                    dismissIcon={{ 'aria-label': `Remove ${p}` }}
                    onClick={() => togglePath(p)}
                  >
                    {p}
                  </Tag>
                ))}
              </div>
            )}
          </Field>
        )}
      </div>
      <div className={styles.actions}>
        {(level.dnx_document_type_reference ?? '').trim() !== '' && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss16Regular />}
            className={styles.clearBtn}
            disabled={save.isPending}
            onClick={() => void handleClear()}
          >
            Clear binding
          </Button>
        )}
        <Button
          appearance="primary"
          size="small"
          icon={<Save16Regular />}
          disabled={save.isPending}
          onClick={() => void handleSave()}
        >
          {save.isPending ? 'Saving…' : 'Save binding'}
        </Button>
      </div>
    </div>
  );
}

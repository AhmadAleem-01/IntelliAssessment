import { Field, Input, Textarea, Dropdown, Option, makeStyles } from '@fluentui/react-components';
import type { TemplateFormValue } from './api';

const useStyles = makeStyles({
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
});

export type StatusKey = 'Draft' | 'Published' | 'Deprecated';

export const STATUS_TO_CODE: Record<StatusKey, TemplateFormValue['statuscode']> = {
  Draft: 778540001,
  Published: 778540002,
  Deprecated: 778540003,
};

export const CODE_TO_STATUS: Record<number, StatusKey> = {
  778540001: 'Draft',
  778540002: 'Published',
  778540003: 'Deprecated',
};

const LABELS: Record<StatusKey, string> = {
  Draft: 'Draft',
  Published: 'Published',
  Deprecated: 'Deprecated',
};

interface Props {
  name: string;
  description: string;
  status: StatusKey;
  onChange: (next: { name?: string; description?: string; status?: StatusKey }) => void;
  autoFocus?: boolean;
}

export function TemplateFormFields({
  name,
  description,
  status,
  onChange,
  autoFocus,
}: Props) {
  const styles = useStyles();
  return (
    <div className={styles.fields}>
      <Field label="Template name" required>
        <Input
          value={name}
          onChange={(_, d) => onChange({ name: d.value })}
          placeholder="e.g. Skill Assessment"
          maxLength={100}
          autoFocus={autoFocus}
        />
      </Field>
      <Field label="Description" hint="Purpose and usage notes for this template">
        <Textarea
          value={description}
          onChange={(_, d) => onChange({ description: d.value })}
          placeholder="What this template is used for, who it's for, how it should be applied..."
          rows={3}
        />
      </Field>
      <Field label="Lifecycle status">
        <Dropdown
          value={LABELS[status]}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => onChange({ status: (d.optionValue as StatusKey) ?? 'Draft' })}
        >
          <Option value="Draft">Draft</Option>
          <Option value="Published">Published</Option>
          <Option value="Deprecated">Deprecated</Option>
        </Dropdown>
      </Field>
    </div>
  );
}

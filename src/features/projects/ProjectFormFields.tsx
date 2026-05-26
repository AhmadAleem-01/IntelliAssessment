import { Field, Input, Textarea, Dropdown, Option, makeStyles } from '@fluentui/react-components';
import type { ProjectFormValue } from './api';

const useStyles = makeStyles({
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
});

export type StatusKey = 'Active' | 'OnHold' | 'Archived' | 'Inactive';

export const STATUS_TO_CODE: Record<StatusKey, ProjectFormValue['statuscode']> = {
  Active: 1,
  Inactive: 2,
  Archived: 778540001,
  OnHold: 778540002,
};

export const CODE_TO_STATUS: Record<number, StatusKey> = {
  1: 'Active',
  2: 'Inactive',
  778540001: 'Archived',
  778540002: 'OnHold',
};

const LABELS: Record<StatusKey, string> = {
  Active: 'Active',
  OnHold: 'On Hold',
  Archived: 'Archived',
  Inactive: 'Inactive',
};

interface Props {
  name: string;
  code: string;
  description: string;
  status: StatusKey;
  onChange: (next: { name?: string; code?: string; description?: string; status?: StatusKey }) => void;
  autoFocus?: boolean;
}

export function ProjectFormFields({
  name,
  code,
  description,
  status,
  onChange,
  autoFocus,
}: Props) {
  const styles = useStyles();
  return (
    <div className={styles.fields}>
      <Field label="Project name" required>
        <Input
          value={name}
          onChange={(_, d) => onChange({ name: d.value })}
          placeholder="e.g. Q2 Skill Assessments"
          maxLength={100}
          autoFocus={autoFocus}
        />
      </Field>
      <Field label="Project code" hint="Short reference code">
        <Input
          value={code}
          onChange={(_, d) => onChange({ code: d.value })}
          placeholder="e.g. SA-Q2"
          maxLength={50}
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(_, d) => onChange({ description: d.value })}
          placeholder="Project scope and purpose"
          rows={3}
        />
      </Field>
      <Field label="Status">
        <Dropdown
          value={LABELS[status]}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => onChange({ status: (d.optionValue as StatusKey) ?? 'Active' })}
        >
          <Option value="Active">Active</Option>
          <Option value="OnHold">On Hold</Option>
          <Option value="Archived">Archived</Option>
          <Option value="Inactive">Inactive</Option>
        </Dropdown>
      </Field>
    </div>
  );
}

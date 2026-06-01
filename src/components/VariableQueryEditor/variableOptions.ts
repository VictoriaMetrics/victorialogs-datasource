import { TypedVariableModel } from '@grafana/data';

export interface FieldOption {
  label: string;
  value: string;
  description?: string;
}

// Maps Grafana variable models to Field-combobox options in the `$name` form
// expected by templateSrv.replace.
export const toVariableOptions = (variables: TypedVariableModel[]): FieldOption[] =>
  variables.map((v) => ({
    label: `$${v.name}`,
    value: `$${v.name}`,
    description: 'Dashboard variable',
  }));

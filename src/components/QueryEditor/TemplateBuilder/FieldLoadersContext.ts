import { createContext, useContext } from 'react';

import { ComboboxOption } from '@grafana/ui';

export interface FieldLoaders {
  loadFieldNames?: (input: string) => Promise<ComboboxOption[]>;
  loadFieldValuesForField?: (fieldName: string) => (input: string) => Promise<ComboboxOption[]>;
  loadStreamFieldNames?: (input: string) => Promise<ComboboxOption[]>;
  loadStreamFieldValuesForField?: (fieldName: string) => (input: string) => Promise<ComboboxOption[]>;
}

const FieldLoadersContext = createContext<FieldLoaders | null>(null);

export const FieldLoadersProvider = FieldLoadersContext.Provider;

export const useFieldLoaders = (): FieldLoaders => useContext(FieldLoadersContext) ?? {};

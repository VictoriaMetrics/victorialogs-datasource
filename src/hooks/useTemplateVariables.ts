import { useCallback, useMemo } from 'react';

import { getTemplateSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';

export function useTemplateVariables() {
  const variables = useMemo<ComboboxOption[]>(
    () =>
      getTemplateSrv()
        .getVariables()
        .map((v) => ({
          label: `$${v.name}`,
          value: `$${v.name}`,
          description: v.label || v.name,
        })),
    []
  );

  const variableNames = useMemo(() => new Set(variables.map((v) => v.value)), [variables]);

  const isVariable = useCallback((value: string) => variableNames.has(value), [variableNames]);

  const withVariables = useCallback(
    (options: ComboboxOption[], inputValue: string): ComboboxOption[] => {
      const filtered = inputValue
        ? variables.filter((v) => v.value?.toLowerCase().includes(inputValue.toLowerCase()))
        : variables;
      return [...filtered, ...options];
    },
    [variables]
  );

  const filterSelection = useCallback(
    (values: string[]): string[] => {
      const last = values[values.length - 1];
      if (last && isVariable(last)) {
        return [last];
      }
      return values.filter((v) => !isVariable(v));
    },
    [isVariable]
  );

  return { variables, withVariables, filterSelection, isVariable };
}

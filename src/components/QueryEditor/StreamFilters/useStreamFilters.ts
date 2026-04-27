import { useCallback, useMemo, useState } from 'react';

import { Query, StreamFilterState } from '../../../types';

import { buildStreamExtraFilters } from './streamFilterUtils';

interface Props {
  query: Query;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

const getValuesByLabel = (filters: StreamFilterState[], label: string | null): string[] => {
  if (!label) {
    return [];
  }
  return filters.find((f) => f.label === label)?.values ?? [];
};

const toggleValueInList = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/**
 * Returns a new filters array with `values` upserted under `label`:
 * — empty values + missing label  → returns the original ref (no-op).
 * — empty values + existing label → drops that filter.
 * — non-empty + missing label     → appends a new filter.
 * — non-empty + existing label    → replaces values on that filter.
 */
const withUpsertedValues = (
  filters: StreamFilterState[],
  label: string,
  values: string[]
): StreamFilterState[] => {
  const idx = filters.findIndex((f) => f.label === label);
  if (values.length === 0) {
    return idx === -1 ? filters : filters.filter((_, i) => i !== idx);
  }
  if (idx === -1) {
    return [...filters, { label, operator: 'in', values }];
  }
  return filters.map((f, i) => (i === idx ? { ...f, values } : f));
};

const serializeFilters = (filters: StreamFilterState[]): string | undefined =>
  buildStreamExtraFilters(filters) || undefined;

const serializeFiltersExceptLabel = (
  filters: StreamFilterState[],
  excludedLabel: string | null
): string | undefined => {
  if (excludedLabel === null) {
    return undefined;
  }
  return serializeFilters(filters.filter((f) => f.label !== excludedLabel));
};

export function useStreamFilters({ query, onChange, onRunQuery }: Props) {
  const streamFilters = useMemo(() => query.streamFilters || [], [query.streamFilters]);

  const [popoverLabel, setPopoverLabel] = useState<string | null>(null);

  const closePopover = useCallback(() => {
    setPopoverLabel(null);
  }, []);

  const handleLabelClick = useCallback((label: string) => {
    setPopoverLabel((current) => (current === label ? null : label));
  }, []);

  const commitFilters = useCallback(
    (nextFilters: StreamFilterState[]) => {
      onChange({
        ...query,
        streamFilters: nextFilters.length > 0 ? nextFilters : undefined,
      });
      onRunQuery();
    },
    [onChange, query, onRunQuery]
  );

  const setFilterValues = useCallback(
    (label: string, values: string[]) => {
      const next = withUpsertedValues(streamFilters, label, values);
      if (next === streamFilters) {
        return;
      }
      commitFilters(next);
    },
    [streamFilters, commitFilters]
  );

  const handleToggleValue = useCallback(
    (value: string) => {
      if (!popoverLabel) {
        return;
      }
      const current = getValuesByLabel(streamFilters, popoverLabel);
      setFilterValues(popoverLabel, toggleValueInList(current, value));
    },
    [popoverLabel, streamFilters, setFilterValues]
  );

  const handleRemoveValue = useCallback(
    (filterIndex: number, value: string) => {
      const filter = streamFilters[filterIndex];
      if (!filter) {
        return;
      }
      setFilterValues(filter.label, filter.values.filter((v) => v !== value));
    },
    [streamFilters, setFilterValues]
  );

  const clearAll = useCallback(() => {
    if (streamFilters.length === 0) {
      return;
    }
    commitFilters([]);
  }, [streamFilters.length, commitFilters]);

  const selectedValuesForPopover = useMemo(
    () => getValuesByLabel(streamFilters, popoverLabel),
    [streamFilters, popoverLabel]
  );

  // Sidebar label list uses ALL active filters — hits/counts reflect the full
  // current selection, including values just toggled in the popover.
  const sidebarExtraStreamFilters = useMemo(
    () => serializeFilters(streamFilters),
    [streamFilters]
  );

  // Popover value list uses all filters EXCEPT the one currently open,
  // so the value list isn't narrowed by its own selection.
  const popoverExtraStreamFilters = useMemo(
    () => serializeFiltersExceptLabel(streamFilters, popoverLabel),
    [streamFilters, popoverLabel]
  );

  return {
    streamFilters,
    popoverLabel,
    closePopover,
    handleLabelClick,
    handleToggleValue,
    handleRemoveValue,
    clearAll,
    selectedValuesForPopover,
    sidebarExtraStreamFilters,
    popoverExtraStreamFilters,
  };
}

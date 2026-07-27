import { useCallback, useMemo, useState } from 'react';

import { Query, QueryEditorMode, StreamFilterState } from '../../../types';
import { isInGroup } from '../../../utils/query/streamFilterToggle';
import { buildPipeForStreamFilter, withPipeInserted } from '../TemplateBuilder/moveToQuery';

import { buildStreamExtraFilters, streamFilterToString } from './streamFilterUtils';

interface Props {
  query: Query;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

// The popover edits only `in` groups; `not_in` groups (added by the Filter out
// log-details action) are managed through their chips.
const getValuesByLabel = (filters: StreamFilterState[], label: string | null): string[] => {
  if (!label) {
    return [];
  }
  return filters.find((f) => f.label === label && isInGroup(f))?.values ?? [];
};

const toggleValueInList = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/**
 * Returns a new filters array with `values` upserted under the `in` group of `label`:
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
  const idx = filters.findIndex((f) => f.label === label && isInGroup(f));
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
  return serializeFilters(filters.filter((f) => !(f.label === excludedLabel && isInGroup(f))));
};

export function useStreamFilters({ query, onChange, onRunQuery }: Props) {
  const streamFilters = useMemo(() => query.streamFilters || [], [query.streamFilters]);

  const [popoverLabel, setPopoverLabel] = useState<string | null>(null);

  // Counter of in-flight fetches across the popover (labels + values).
  // Used to disable interactive items while any request is pending.
  const [pendingFetches, setPendingFetches] = useState(0);
  const beginFetch = useCallback(() => setPendingFetches((n) => n + 1), []);
  const endFetch = useCallback(() => setPendingFetches((n) => Math.max(0, n - 1)), []);
  const isFetching = pendingFetches > 0;

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

  // Chip removals go by index (not through withUpsertedValues) so they work
  // for both `in` and `not_in` groups
  const handleRemoveValue = useCallback(
    (filterIndex: number, value: string) => {
      const filter = streamFilters[filterIndex];
      if (!filter) {
        return;
      }
      const values = filter.values.filter((v) => v !== value);
      const next = values.length
        ? streamFilters.map((f, i) => (i === filterIndex ? { ...f, values } : f))
        : streamFilters.filter((_, i) => i !== filterIndex);
      commitFilters(next);
    },
    [streamFilters, commitFilters]
  );

  const handleRemoveFilter = useCallback(
    (filterIndex: number) => {
      if (!streamFilters[filterIndex]) {
        return;
      }
      commitFilters(streamFilters.filter((_, i) => i !== filterIndex));
    },
    [streamFilters, commitFilters]
  );

  const clearAll = useCallback(() => {
    if (streamFilters.length === 0) {
      return;
    }
    commitFilters([]);
  }, [streamFilters.length, commitFilters]);

  // Moves a stream filter group into the query itself: in builder mode as a
  // pipe prepended to the model, in code mode as a `_stream:{...}` prefix
  const moveFilterToQuery = useCallback(
    (filterIndex: number) => {
      const filter = streamFilters[filterIndex];
      if (!filter) {
        return;
      }
      const rest = streamFilters.filter((_, i) => i !== filterIndex);
      const nextStreamFilters = rest.length ? rest : undefined;

      if (query.editorMode === QueryEditorMode.Builder) {
        const pipe = buildPipeForStreamFilter(filter);
        if (!pipe) {
          return;
        }
        onChange({ ...query, ...withPipeInserted(query, pipe, 'start'), streamFilters: nextStreamFilters });
      } else {
        const filterStr = streamFilterToString(filter);
        const trimmed = (query.expr ?? '').trim();
        const expr = !trimmed || trimmed === '*' ? filterStr : `${filterStr} AND ${trimmed}`;
        onChange({ ...query, expr, streamFilters: nextStreamFilters });
      }
      onRunQuery();
    },
    [streamFilters, query, onChange, onRunQuery]
  );

  const selectedValuesForPopover = useMemo(
    () => getValuesByLabel(streamFilters, popoverLabel),
    [streamFilters, popoverLabel]
  );

  // The labels list uses ALL active filters — hits/counts reflect the full
  // current selection, including values just toggled in the popover.
  const selectedExtraStreamFilters = useMemo(
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
    handleRemoveFilter,
    moveFilterToQuery,
    clearAll,
    selectedValuesForPopover,
    selectedExtraStreamFilters,
    popoverExtraStreamFilters,
    isFetching,
    beginFetch,
    endFetch,
  };
}

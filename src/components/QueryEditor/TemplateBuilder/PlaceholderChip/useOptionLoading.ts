import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ComboboxOption } from '@grafana/ui';

import { useFieldLoaders } from '../FieldLoadersContext';
import { SegmentOptionSource } from '../types';

interface UseOptionLoadingOptions {
  optionSource: SegmentOptionSource;
  staticOptions?: ComboboxOption[];
  isActive: boolean;
  dependencyValue?: string | null;
  excludeOptions?: string[];
  /** Values already selected in multi-mode — will be filtered out of returned options/optionGroups */
  multiValues?: string[];
}

export interface OptionGroup {
  groupId: string;
  groupLabel: string;
  options: ComboboxOption[];
}

interface UseOptionLoadingResult {
  /** Flat list — used when optionGroups is null */
  options: ComboboxOption[];
  /** Grouped list — non-null only for sources that return multiple groups (e.g. fieldNamesWithStream) */
  optionGroups: OptionGroup[] | null;
  loadOptions: (query: string) => Promise<void>;
}

const ALL_OPTION: ComboboxOption = { value: '*', label: '*', description: 'Match all' };

function withAllOption(query: string, opts: ComboboxOption[]): ComboboxOption[] {
  const showAll = !query || '*'.includes(query.toLowerCase());
  return showAll ? [ALL_OPTION, ...opts] : opts;
}

function filterByQuery(opts: ComboboxOption[], query: string): ComboboxOption[] {
  if (!query) {
    return opts;
  }
  const lower = query.toLowerCase();
  return opts.filter((o) => String(o.label ?? o.value).toLowerCase().includes(lower));
}

export function useOptionLoading({
  optionSource,
  staticOptions,
  isActive,
  dependencyValue,
  excludeOptions,
  multiValues,
}: UseOptionLoadingOptions): UseOptionLoadingResult {
  const [rawOptions, setOptions] = useState<ComboboxOption[]>([]);
  const [rawOptionGroups, setOptionGroups] = useState<OptionGroup[] | null>(null);
  const { loadFieldNames, loadFieldValuesForField, loadStreamFieldNames, loadStreamFieldValuesForField } = useFieldLoaders();

  // Cache stream field names for fieldNamesWithStream — loaded once per activation with query='*'
  const streamFieldsCacheRef = useRef<ComboboxOption[] | null>(null);

  useEffect(() => {
    if (!isActive) {
      streamFieldsCacheRef.current = null;
    }
  }, [isActive]);

  const applyExclude = useCallback((opts: ComboboxOption[]): ComboboxOption[] => {
    if (!excludeOptions || excludeOptions.length === 0) {
      return opts;
    }
    const excluded = new Set(excludeOptions);
    return opts.filter((o) => !excluded.has(String(o.value)));
  }, [excludeOptions]);

  const loadOptions = useCallback(async (query: string) => {
    switch (optionSource) {
      case 'fieldNames':
        if (loadFieldNames) {
          setOptions(applyExclude(await loadFieldNames(query)));
          setOptionGroups(null);
        }
        break;
      case 'fieldNamesWithStream': {
        // Stream fields are few and stable — load once with query='' and cache per activation.
        // Field names are context-aware — load on every query change.
        // Only show a stream field if it also appears in fieldNames results.
        if (streamFieldsCacheRef.current === null && loadStreamFieldNames) {
          streamFieldsCacheRef.current = await loadStreamFieldNames('');
        }
        const streamFields = streamFieldsCacheRef.current ?? [];
        const allFields = loadFieldNames ? await loadFieldNames(query) : [];
        const fieldNameSet = new Set(allFields.map((o) => String(o.value)));
        const relevantStreamFields = streamFields.filter((o) => fieldNameSet.has(String(o.value)));
        const streamSet = new Set(relevantStreamFields.map((o) => String(o.value)));
        const regularFields = applyExclude(allFields.filter((o) => !streamSet.has(String(o.value))));
        const groups: OptionGroup[] = [];
        if (relevantStreamFields.length > 0) {
          groups.push({ groupId: 'stream', groupLabel: 'Stream fields (faster)', options: filterByQuery(relevantStreamFields, query) });
        }
        if (regularFields.length > 0) {
          groups.push({ groupId: 'field', groupLabel: 'Fields', options: filterByQuery(regularFields, query) });
        }
        setOptionGroups(groups);
        setOptions(groups.flatMap((g) => g.options));
        break;
      }
      case 'fieldValues':
        if (loadFieldValuesForField && dependencyValue) {
          setOptions(withAllOption(query, await loadFieldValuesForField(dependencyValue)(query)));
          setOptionGroups(null);
        }
        break;
      case 'streamFieldNames':
        if (loadStreamFieldNames) {
          setOptions(await loadStreamFieldNames(query));
          setOptionGroups(null);
        }
        break;
      case 'streamFieldValues':
        if (loadStreamFieldValuesForField && dependencyValue) {
          setOptions(withAllOption(query, await loadStreamFieldValuesForField(dependencyValue)(query)));
          setOptionGroups(null);
        }
        break;
      case 'static': {
        const staticOpts = staticOptions ?? [];
        setOptions(filterByQuery(staticOpts, query));
        setOptionGroups(null);
        break;
      }
      default:
        setOptions([]);
        setOptionGroups(null);
    }
  }, [optionSource, staticOptions, dependencyValue, loadFieldNames, loadFieldValuesForField, loadStreamFieldNames, loadStreamFieldValuesForField, applyExclude]);

  // Reload when dependency changes while active (e.g. after field name selection)
  useEffect(() => {
    if (isActive && (optionSource === 'fieldValues' || optionSource === 'streamFieldValues') && dependencyValue) {
      loadOptions('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyValue]);

  // Filter out already-selected multi-values from options and groups
  const optionGroups = useMemo<OptionGroup[] | null>(() => {
    if (!rawOptionGroups) {
      return null;
    }
    if (!multiValues || multiValues.length === 0) {
      return rawOptionGroups;
    }
    const selected = new Set(multiValues);
    return rawOptionGroups
      .map((g) => ({ ...g, options: g.options.filter((o) => !selected.has(String(o.value))) }))
      .filter((g) => g.options.length > 0);
  }, [rawOptionGroups, multiValues]);

  const options = useMemo<ComboboxOption[]>(() => {
    if (optionGroups) {
      return optionGroups.flatMap((g) => g.options);
    }
    if (!multiValues || multiValues.length === 0) {
      return rawOptions;
    }
    const selected = new Set(multiValues);
    return rawOptions.filter((o) => !selected.has(String(o.value)));
  }, [optionGroups, rawOptions, multiValues]);

  return { options, optionGroups, loadOptions };
}

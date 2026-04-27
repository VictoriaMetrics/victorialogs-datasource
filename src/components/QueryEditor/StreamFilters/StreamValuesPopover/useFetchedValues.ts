import { useEffect, useRef, useState } from 'react';

import { ComboboxOption } from '@grafana/ui';

interface Args {
  loadStreamFieldValues: (search: string) => Promise<ComboboxOption[]>;
  search: string;
}

interface Result {
  options: ComboboxOption[] | null;
  error: string | null;
}

/**
 * Fetches values via `loadStreamFieldValues` whenever `search` changes
 * Pins the loader on first render so parent re-renders that produce a new
 * loader reference don't trigger redundant requests — the popover stays open
 * across selections, fetching only on user-typed search changes
 */
export const useFetchedValues = ({ loadStreamFieldValues, search }: Args): Result => {
  const loaderRef = useRef(loadStreamFieldValues);
  const [options, setOptions] = useState<ComboboxOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loaderRef
      .current(search)
      .then((opts) => {
        if (!cancelled) {
          setOptions(opts);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load stream values', err);
        setError(err instanceof Error ? err.message : 'Failed to load values');
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return { options, error };
};

import React, { createContext, useContext } from 'react';

import { Query } from '../../../types';

import { useStreamFilters } from './useStreamFilters';

type StreamFiltersContextValue = ReturnType<typeof useStreamFilters>;

const StreamFiltersContext = createContext<StreamFiltersContextValue | null>(null);

interface ProviderProps {
  query: Query;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
  children: React.ReactNode;
}

export const StreamFiltersProvider: React.FC<ProviderProps> = ({
  query,
  onChange,
  onRunQuery,
  children,
}) => {
  const value = useStreamFilters({ query, onChange, onRunQuery });
  return <StreamFiltersContext.Provider value={value}>{children}</StreamFiltersContext.Provider>;
};

export const useStreamFiltersContext = (): StreamFiltersContextValue => {
  const ctx = useContext(StreamFiltersContext);
  if (ctx === null) {
    throw new Error('useStreamFiltersContext must be used within a StreamFiltersProvider');
  }
  return ctx;
};

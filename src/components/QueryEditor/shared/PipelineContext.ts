import { createContext, useContext } from 'react';

interface PipelineContextValue {
  extraStreamFilters?: string;
}

export const PipelineContext = createContext<PipelineContextValue>({});

export const usePipelineContext = () => useContext(PipelineContext);

import { StreamFilterState } from '../../../../../types';
import { buildStreamExtraFilters } from '../../components/StreamFilters/streamFilterUtils';
import { PipelineStepItem } from '../types';

import { serializePipeline } from './serializePipeline';

/**
 * Returns the LogsQL expression for Builder mode.
 * Stream filters are sent separately via extra_stream_filters, so they are not included here.
 * If the pipeline is empty, returns '*'.
 */
export const getBuilderGeneratedExpr = (
  steps: PipelineStepItem[],
  _streamFilters: StreamFilterState[]
): string => {
  return serializePipeline(steps) || '*';
};

/**
 * Returns the full LogsQL expression for Code mode, including stream filters.
 * - stream filters + pipeline → "stream_filters | pipeline_expr"
 * - stream filters only      → "stream_filters"
 * - pipeline only            → "pipeline_expr"
 * - nothing                  → "*"
 */
export const getCodeModeExpr = (
  steps: PipelineStepItem[],
  streamFilters: StreamFilterState[]
): string => {
  const pipelineExpr = serializePipeline(steps);
  const streamExpr = buildStreamExtraFilters(streamFilters);

  if (streamExpr && pipelineExpr) {
    return `${streamExpr} | ${pipelineExpr}`;
  }
  if (streamExpr) {
    return streamExpr;
  }
  return pipelineExpr || '*';
};

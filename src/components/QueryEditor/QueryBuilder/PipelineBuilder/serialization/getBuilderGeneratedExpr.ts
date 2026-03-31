import { StreamFilterState } from '../../../../../types';
import { buildStreamExtraFilters } from '../../components/StreamFilters/streamFilterUtils';
import { PipelineStepItem } from '../types';

import { serializePipeline } from './serializePipeline';

/**
 * Returns the LogsQL expression that the Builder would generate for the given steps and stream filters.
 *
 * Rules:
 * - If the pipeline has steps, serialize them normally.
 * - If the pipeline is empty and there are active stream filters, return '' —
 *   the stream filters alone form the full query on the backend side.
 * - If the pipeline is empty and there are no active stream filters, return '*' —
 *   an explicit "match all" is required.
 */
export const getBuilderGeneratedExpr = (
  steps: PipelineStepItem[],
  streamFilters: StreamFilterState[]
): string => {
  const serialized = serializePipeline(steps);
  if (serialized) {
    return serialized;
  }
  const hasActiveStreamFilters = !!buildStreamExtraFilters(streamFilters);
  return hasActiveStreamFilters ? '' : '*';
};

import { DataFrame, QueryResultMeta } from '@grafana/data';

import { LogLevelRule } from '../../configuration/LogLevelRules/types';
import { getHighlighterExpressionsFromQuery } from '../../queryUtils';
import { DerivedFieldConfig, Query } from '../../types';
import { getDerivedFields } from '../fields/derivedField';
import { getStreamFields } from '../fields/labelField';
import { addLevelField } from '../fields/levelField';
import { packLabelsToLine, shouldPackLabelsToLine } from '../fields/packJsonLineField';
import { ANNOTATIONS_REF_ID, InterpolateExpr } from '../types';
import { dataFrameHasError, setFrameMeta } from '../utils/frame/frameUtils';

export function processStreamsFrames(
  frames: DataFrame[],
  queryMap: Map<string, Query>,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[],
  interpolateExpr: InterpolateExpr = (expr) => expr
): DataFrame[] {
  return frames.map((frame) => {
    const query = frame.refId !== undefined ? queryMap.get(frame.refId) : undefined;
    const isAnnotations = query?.refId === ANNOTATIONS_REF_ID;
    return processStreamFrame(frame, query, derivedFieldConfigs, logLevelRules, interpolateExpr, isAnnotations);
  });
}

function processStreamFrame(
  frame: DataFrame,
  query: Query | undefined,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[],
  interpolateExpr: InterpolateExpr,
  transformLabels = false
): DataFrame {
  const custom: Record<string, unknown> = {
    ...frame.meta?.custom, // keep the original meta.custom (incl. backend streamIds/streams)
  };

  if (dataFrameHasError(frame)) {
    custom.error = 'Error when parsing some of the logs';
  }

  const meta: QueryResultMeta = {
    preferredVisualisationType: 'logs',
    limit: query?.maxLines,
    // Highlighting must match the executed query, so resolve template
    // variables before extracting search words
    searchWords: query !== undefined ? getHighlighterExpressionsFromQuery(interpolateExpr(query.expr)) : undefined,
    custom,
  };

  const frameWithMeta = setFrameMeta(frame, meta);
  const frameWithLevel = addLevelField(frameWithMeta, logLevelRules);

  const derivedFields = getDerivedFields(frameWithLevel, derivedFieldConfigs);
  const baseFields = getStreamFields(frameWithLevel.fields, transformLabels);

  const processedFrame = {
    ...frameWithLevel,
    fields: [
      ...baseFields,
      ...derivedFields
    ]
  };

  // packing goes last so the log level and derived fields are extracted from the original message
  return shouldPackLabelsToLine(query) ? packLabelsToLine(processedFrame) : processedFrame;
}

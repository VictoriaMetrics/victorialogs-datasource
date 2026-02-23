import { DataFrame, QueryResultMeta } from '@grafana/data';

import { LogLevelRule } from '../../configuration/LogLevelRules/types';
import { getHighlighterExpressionsFromQuery } from '../../queryUtils';
import { DerivedFieldConfig, Query } from '../../types';
import { getDerivedFields } from '../fields/derivedField';
import { getStreamFields } from '../fields/labelField';
import { addLevelField } from '../fields/levelField';
import { getStreamIds } from '../fields/streamUtils';
import { ANNOTATIONS_REF_ID } from '../types';
import { dataFrameHasError, setFrameMeta } from '../utils/frame/frameUtils';

export function processStreamsFrames(
  frames: DataFrame[],
  queryMap: Map<string, Query>,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[]
): DataFrame[] {
  return frames.map((frame) => {
    const query = frame.refId !== undefined ? queryMap.get(frame.refId) : undefined;
    const isAnnotations = query?.refId === ANNOTATIONS_REF_ID;
    return processStreamFrame(frame, query, derivedFieldConfigs, logLevelRules, isAnnotations);
  });
}

function processStreamFrame(
  frame: DataFrame,
  query: Query | undefined,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[],
  transformLabels = false
): DataFrame {
  const custom: Record<string, string> = {
    ...frame.meta?.custom, // keep the original meta.custom
  };

  if (dataFrameHasError(frame)) {
    custom.error = 'Error when parsing some of the logs';
  }

  const meta: QueryResultMeta = {
    preferredVisualisationType: 'logs',
    limit: query?.maxLines,
    searchWords: query !== undefined ? getHighlighterExpressionsFromQuery(query.expr) : undefined,
    custom: {
      ...custom,
      // if the user decides to hide labels via transforms so that we can get the streamId for `Log context`
      streamIds: getStreamIds(frame),
    },
  };

  const frameWithMeta = setFrameMeta(frame, meta);
  const frameWithLevel = addLevelField(frameWithMeta, logLevelRules);

  const derivedFields = getDerivedFields(frameWithLevel, derivedFieldConfigs);
  const baseFields = getStreamFields(frameWithLevel.fields, transformLabels);

  return {
    ...frameWithLevel,
    fields: [
      ...baseFields,
      ...derivedFields
    ]
  };
}

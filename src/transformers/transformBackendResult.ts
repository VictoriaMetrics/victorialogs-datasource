import { DataQueryError, DataQueryRequest, DataQueryResponse, isDataFrame } from '@grafana/data';

import { LogLevelRule } from '../configuration/LogLevelRules/types';
import { DerivedFieldConfig, Query } from '../types';

import {
  processMetricInstantFrames,
  processMetricRangeFrames,
  processStreamsFrames
} from './frameProcessors';
import { improveError } from './utils/errorUtils';
import { getQueryMap, groupFrames } from './utils/frame/frameUtils';

export function transformBackendResult(
  response: DataQueryResponse,
  request: DataQueryRequest<Query>,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[],
): DataQueryResponse {
  const { data, errors, ...rest } = response;
  const queries = request.targets;

  // in the typescript type, data is an array of basically anything.
  // we do know that they have to be dataframes, so we make a quick check,
  // this way we can be sure, and also typescript is happy.
  const dataFrames = data.map((d) => {
    if (!isDataFrame(d)) {
      throw new Error('transformation only supports dataframe responses');
    }

    return d;
  });

  const queryMap = getQueryMap(queries) as Map<string, Query>;

  const { streamsFrames, metricInstantFrames, metricRangeFrames } = groupFrames(dataFrames, queryMap);

  const improvedErrors = errors && errors.map((error) => improveError(error, queryMap)).filter((e) => e !== undefined);

  return {
    ...rest,
    errors: improvedErrors as DataQueryError[],
    data: [
      ...processMetricRangeFrames(metricRangeFrames, request.targets, request.range.from.valueOf(), request.range.to.valueOf()),
      ...processMetricInstantFrames(metricInstantFrames),
      ...processStreamsFrames(streamsFrames, queryMap, derivedFieldConfigs, logLevelRules),
    ],
  };
}

import { DataFrame, DataFrameType, QueryResultMeta } from '@grafana/data';

import { Query } from '../../types';
import { getQueryMap, setFrameMeta } from '../utils/frame/frameUtils';
import { makeTableFrames } from '../utils/frame/makeTableFrames';
import { fillFrameWithNullValues } from '../utils/timestampUtils';

export function processMetricInstantFrames(frames: DataFrame[]): DataFrame[] {
  return frames.length > 0 ? makeTableFrames(frames) : [];
}

export function processMetricRangeFrames(frames: DataFrame[], queries: Query[], startTime: number, endTime: number): DataFrame[] {
  const meta: QueryResultMeta = { preferredVisualisationType: 'graph', type: DataFrameType.TimeSeriesMulti };
  const queryMap = getQueryMap(queries);

  return frames.map((frame) => {
    const query = queryMap.get(frame.refId || '');
    // need to fill missing timestamps with null values, so grafana can render the graph properly
    const frameWithNullValues = query ? fillFrameWithNullValues(frame, query, startTime, endTime) : frame;
    return setFrameMeta(frameWithNullValues, meta);
  });
}

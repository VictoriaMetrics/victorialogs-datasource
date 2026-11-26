import { DataFrame, DataQueryResponse, FieldType } from '@grafana/data';

const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';

/** The refId of the logs volume query made for the query with the given refId */
export const volumeRefId = (refId: string): string => `${REF_ID_STARTER_LOG_VOLUME}${refId}`;

/** The refIds of the queries whose volume has hits in the response */
export const refIdsWithHits = (hits: DataQueryResponse): Set<string> =>
  new Set(
    hits.data
      .filter((frame: DataFrame) => frame.refId?.startsWith(REF_ID_STARTER_LOG_VOLUME) && hasHits(frame))
      .map((frame: DataFrame) => frame.refId!.slice(REF_ID_STARTER_LOG_VOLUME.length))
  );

const hasHits = (frame: DataFrame): boolean =>
  frame.fields.some((field) => field.type === FieldType.number && field.values.some((value) => value > 0));

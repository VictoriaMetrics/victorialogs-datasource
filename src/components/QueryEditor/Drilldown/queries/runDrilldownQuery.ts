import { Unsubscribable } from 'rxjs';

import { DataFrame, DataQueryError, DataQueryRequest, DataQueryResponse, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import { errorMessage } from './errorMessage';
import { scheduleDrilldownQuery } from './queryScheduler';

interface DrilldownQueryHandlers {
  /** The frames of a successful run. It never fires once `onError` has fired */
  onFrames: (frames: DataFrame[]) => void;
  /** Never empty, and every entry carries a `message`. Matches the shape of `PanelData.errors` */
  onError: (errors: DataQueryError[]) => void;
}

/** Joins the errors into one line, for the hooks that keep a single error string */
export const toErrorText = (errors: DataQueryError[]): string => errors.map((e) => e.message).join('; ');

/** Fills in `message`, which the rest of the drilldown reads without checking the other fields */
const withMessage = (error: DataQueryError): DataQueryError => ({
  ...error,
  message: error.message ?? error.data?.message ?? error.statusText ?? 'Query failed',
});

/**
 * Reads the errors of one response. `errors` is the current field, and `error` is the
 * deprecated single-value predecessor that parts of Grafana still fill in on their own, so
 * fall back to it when `errors` is missing. Keeping the deprecated access here means the
 * drilldown reads it in one place
 */
export function responseErrors(resp: DataQueryResponse): DataQueryError[] {
  if (resp.errors?.length) {
    return resp.errors.map(withMessage);
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return resp.error ? [withMessage(resp.error)] : [];
}

/**
 * Runs a drilldown request through the shared scheduler and collects its frames.
 *
 * datasource.query() reports a per-query failure in two ways: inside a next emission as
 * `errors`, or through the observable's error channel. Both end up in `onError`, and an
 * emission that carries a frame alongside the errors must not reach `onFrames`, because a
 * partial frame set would render as a successful result
 */
export function runDrilldownQuery(
  datasource: VictoriaLogsDatasource,
  request: DataQueryRequest<Query>,
  { onFrames, onError }: DrilldownQueryHandlers
): Unsubscribable {
  let frames: DataFrame[] = [];
  let failed = false;

  const fail = (errors: DataQueryError[]) => {
    failed = true;
    onError(errors);
  };

  return scheduleDrilldownQuery(datasource, request).subscribe({
    next: (resp) => {
      const errors = responseErrors(resp);
      if (errors.length) {
        fail(errors);
        return;
      }
      frames = frames.concat(resp.data.map(toDataFrame));
    },
    error: (e) => fail([{ message: errorMessage(e) }]),
    complete: () => {
      if (!failed) {
        onFrames(frames);
      }
    },
  });
}

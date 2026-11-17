import { tap } from 'rxjs';

import { DataQueryError, DataQueryResponse } from '@grafana/data';

/**
 * Reads the errors of one response. `errors` is the current field, and `error` is the
 * deprecated single-value predecessor that parts of Grafana still fill in on their own, so
 * fall back to it when `errors` is missing. Keeping the deprecated access here means the
 * plugin reads it in one place
 */
export function responseErrors(resp: DataQueryResponse): DataQueryError[] {
  if (resp.errors?.length) {
    return resp.errors.map(withMessage);
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return resp.error ? [withMessage(resp.error)] : [];
}

/** An in-band error of a response fails the stream like a thrown one */
export const failOnResponseError = tap((response: DataQueryResponse) => {
  const [error] = responseErrors(response);
  if (error) {
    throw error;
  }
});

/** Fills in `message`, which the callers read without checking the other fields; an empty string counts as missing */
const withMessage = (error: DataQueryError): DataQueryError => ({
  ...error,
  message: error.message || error.data?.message || error.statusText || 'Query failed',
});

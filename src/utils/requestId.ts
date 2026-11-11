/**
 * The id of the request as its Explore pane or dashboard panel issued it. The mixed datasource prefixes
 * the request id of every sub-request with `mixed-<query index>-`.
 */
export const stripMixedRequestIdPrefix = (requestId: string): string => requestId.replace(/^mixed-\d+-/, '');

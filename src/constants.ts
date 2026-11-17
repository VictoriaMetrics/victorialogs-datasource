export const VARIABLE_ALL_VALUE = '$__all';
export const TEXT_FILTER_ALL_VALUE = '*';
export const PLUGIN_ID = 'victoriametrics-logs-datasource';

export const LOGS_LIMIT_DEFAULT = 1000;
export const LOGS_LIMIT_HARD_CAP = 10000;
export const LOGS_LIMIT_WARNING_THRESHOLD = 1000;
const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
/** The refId of the logs volume query made for the query with the given refId */
export const volumeRefId = (refId: string): string => `${REF_ID_STARTER_LOG_VOLUME}${refId}`;

export const NOT_SHOW_AGAIN_LOGS_LIMIT_WARNING_LOCAL_STORAGE_KEY = `${PLUGIN_ID}:notShowAgainLogsLimitWarning`;

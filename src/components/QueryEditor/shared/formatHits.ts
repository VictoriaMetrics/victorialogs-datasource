import { formattedValueToString, getValueFormat } from '@grafana/data';

const shortFormat = getValueFormat('short');

/** Formats a hit count the same compact way as Stream Filters (e.g. 12345 -> "12.3 K") */
export const formatHits = (hits: number): string => formattedValueToString(shortFormat(hits));

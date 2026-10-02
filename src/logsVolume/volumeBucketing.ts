import { clamp } from 'lodash';

import { DataQueryRequest, dateTime, makeTimeRange, TimeRange } from '@grafana/data';

import { Query } from '../types';
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS, WEEK_MS } from '../utils/time/constants';
import { formatSignedDuration } from '../utils/time/duration';
import { getRangeStartOffsetMinutes } from '../utils/time/timezoneOffset';

/** Bucket steps in ascending order — the VMUI histogram intervals (app/vmui constants/intervals.ts) without the sub-second ones */
const STEPS = [
  { step: '1s', ms: SECOND_MS },
  { step: '5s', ms: 5 * SECOND_MS },
  { step: '10s', ms: 10 * SECOND_MS },
  { step: '15s', ms: 15 * SECOND_MS },
  { step: '30s', ms: 30 * SECOND_MS },
  { step: '1m', ms: MINUTE_MS },
  { step: '5m', ms: 5 * MINUTE_MS },
  { step: '10m', ms: 10 * MINUTE_MS },
  { step: '15m', ms: 15 * MINUTE_MS },
  { step: '30m', ms: 30 * MINUTE_MS },
  { step: '1h', ms: HOUR_MS },
  { step: '3h', ms: 3 * HOUR_MS },
  { step: '6h', ms: 6 * HOUR_MS },
  { step: '12h', ms: 12 * HOUR_MS },
  { step: '1d', ms: DAY_MS },
  { step: '2d', ms: 2 * DAY_MS },
  { step: '7d', ms: WEEK_MS },
  { step: '14d', ms: 2 * WEEK_MS },
  { step: '28d', ms: 4 * WEEK_MS },
  { step: '91d', ms: 13 * WEEK_MS },
  { step: '182d', ms: 26 * WEEK_MS },
  { step: '364d', ms: 52 * WEEK_MS },
];

/** The VMUI desktop bar count, also the target without a panel width */
const VOLUME_BARS_MAX = 96;
const VOLUME_BARS_MIN = 24;
/** Panel pixels per bar when the bar count is derived from `maxDataPoints` */
const VOLUME_BAR_MIN_PX = 16;

/** The unix epoch started on a Thursday, so whole-week buckets are shifted by three days to start on Monday */
const WEEK_GRID_SHIFT_MS = 3 * DAY_MS;

export interface VolumeBucketing {
  /** Bucket step for the /select/logsql/hits `step` param */
  step: string;
  /** Grid shift for the /select/logsql/hits `offset` param; undefined when the grid needs no shift */
  offset: string | undefined;
  /** Grid start of every bucket the range touches, in ascending order — the timestamps VictoriaLogs returns */
  bucketStarts: number[];
}

/**
 * Calendar-aligned buckets of the range: the VMUI step closest to `range / targetBars`,
 * aligned to the local time of the given offset — the grid VictoriaLogs answers a
 * `step`/`offset` hits query with
 */
export function getVolumeBucketing(range: TimeRange, tzOffsetMinutes: number, targetBars = VOLUME_BARS_MAX): VolumeBucketing {
  const fromMs = range.from.valueOf();
  const toMs = range.to.valueOf();

  const { step, ms: stepMs } = pickStep((toMs - fromMs) / targetBars);
  const offsetMs = tzOffsetMinutes * MINUTE_MS + (stepMs % WEEK_MS === 0 ? WEEK_GRID_SHIFT_MS : 0);

  const bucketStarts: number[] = [];
  for (let start = gridStart(fromMs, stepMs, offsetMs); start < toMs; start += stepMs) {
    bucketStarts.push(start);
  }

  return {
    step,
    offset: offsetMs === 0 ? undefined : formatSignedDuration(offsetMs),
    bucketStarts,
  };
}

/**
 * Bucketing of a request: its range with the offset of its timezone at the range start, and the
 * bar count that fits the panel width Grafana passes as `maxDataPoints`
 */
export const getRequestVolumeBucketing = (request: DataQueryRequest<Query>): VolumeBucketing =>
  getVolumeBucketing(request.range, getRangeStartOffsetMinutes(request.timezone, request.range), getTargetBars(request.maxDataPoints));

/**
 * The bucket ranges of the request, newest first: the requests of the bar-by-bar volume loading.
 * The outermost bars are clipped to the range, so the bars count the same logs as one whole-range request
 */
export function getVolumeBars(request: DataQueryRequest<Query>): TimeRange[] {
  const { bucketStarts } = getRequestVolumeBucketing(request);
  const fromMs = request.range.from.valueOf();
  const toMs = request.range.to.valueOf();
  return bucketStarts
    .map((start, i) => makeTimeRange(dateTime(Math.max(start, fromMs)), dateTime(bucketStarts[i + 1] ?? toMs)))
    .reverse();
}

const getTargetBars = (maxDataPoints: number | undefined): number =>
  maxDataPoints ? clamp(Math.floor(maxDataPoints / VOLUME_BAR_MIN_PX), VOLUME_BARS_MIN, VOLUME_BARS_MAX) : VOLUME_BARS_MAX;

/** The step closest to the target on the logarithmic scale, clamped to the ends of `STEPS` */
function pickStep(targetMs: number) {
  const first = STEPS[0];
  const last = STEPS[STEPS.length - 1];
  if (targetMs <= first.ms) {
    return first;
  }
  if (targetMs >= last.ms) {
    return last;
  }
  const upper = STEPS.findIndex((s) => s.ms >= targetMs);
  const lower = upper - 1;
  const distanceToLower = Math.abs(Math.log(STEPS[lower].ms / targetMs));
  const distanceToUpper = Math.abs(Math.log(STEPS[upper].ms / targetMs));
  return distanceToLower < distanceToUpper ? STEPS[lower] : STEPS[upper];
}

/** Bucket start the way VictoriaLogs computes it: floor((t + offset) / step) * step - offset */
const gridStart = (t: number, stepMs: number, offsetMs: number): number =>
  Math.floor((t + offsetMs) / stepMs) * stepMs - offsetMs;

import { dateTime, TimeRange } from '@grafana/data';

import { DAY_MS, WEEK_MS } from './constants';

const startOfUtcDay = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const endOfUtcDay = (ms: number): number => startOfUtcDay(ms) + DAY_MS - 1;

const startOfIsoWeekUtc = (ms: number): number => {
  const d = new Date(ms);
  // getUTCDay: 0=Sun..6=Sat; remap so Monday=0..Sunday=6
  const offset = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset);
};

const endOfIsoWeekUtc = (ms: number): number => startOfIsoWeekUtc(ms) + WEEK_MS - 1;

const startOfUtcMonth = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const endOfUtcMonth = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
};

const startOfUtcYear = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
};

const endOfUtcYear = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear() + 1, 0, 1) - 1;
};

/**
 * Round a time range to a stable UTC bucket whose size scales with the original span:
 *  - Span ≤ 24h → day
 *  - ≤ 7d → ISO week (Mon–Sun)
 *  - ≤ 31d → calendar month
 *  - otherwise calendar year
 * `from` snaps down to the start of its bucket, `to` snaps up to the end of its bucket,
 * so close-by ranges produce identical bucketed boundaries.
 */
export function bucketTimeRange(range: TimeRange): TimeRange {
  const fromMs = range.from.valueOf();
  const toMs = range.to.valueOf();
  const span = Math.max(0, toMs - fromMs);

  let startFn: (ms: number) => number;
  let endFn: (ms: number) => number;

  if (span <= DAY_MS) {
    startFn = startOfUtcDay;
    endFn = endOfUtcDay;
  } else if (span <= WEEK_MS) {
    startFn = startOfIsoWeekUtc;
    endFn = endOfIsoWeekUtc;
  } else if (span <= 31 * DAY_MS) {
    startFn = startOfUtcMonth;
    endFn = endOfUtcMonth;
  } else {
    startFn = startOfUtcYear;
    endFn = endOfUtcYear;
  }

  const bucketedFrom = startFn(fromMs);
  const bucketedTo = endFn(toMs);
  const fromDt = dateTime(bucketedFrom);
  const toDt = dateTime(bucketedTo);

  return {
    from: fromDt,
    to: toDt,
    raw: { from: fromDt, to: toDt },
  };
}

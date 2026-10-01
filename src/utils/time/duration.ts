import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS, WEEK_MS } from './constants';

export const getDurationFromMilliseconds = (ms: number): string => {
  const milliseconds = Math.floor(ms % 1000);
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor((ms / 1000 / 3600) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const durs = ['d', 'h', 'm', 's', 'ms'];
  const values = [days, hours, minutes, seconds, milliseconds].map((t, i) => t ? `${t}${durs[i]}` : '');
  return values.filter(t => t).join('');
};

/** Milliseconds per duration unit; `y` is the fixed 365 days VictoriaLogs uses */
const MS_BY_UNIT: Record<string, number> = {
  y: 365 * DAY_MS,
  w: WEEK_MS,
  d: DAY_MS,
  h: HOUR_MS,
  m: MINUTE_MS,
  s: SECOND_MS,
  ms: 1,
};

// a decimal value with its unit; `ms` goes before `m` so the alternation does not stop at the `m`
const DURATION_ITEM = /(\d+(?:\.\d+)?)(ms|y|w|d|h|m|s)/g;

/** Sums the items of a duration string ("1d 2h", "1.5h", "30m") in milliseconds; unknown text adds nothing */
export const getMillisecondsFromDuration = (dur: string): number =>
  Array.from(dur.matchAll(DURATION_ITEM)).reduce((total, [, value, unit]) => total + parseFloat(value) * MS_BY_UNIT[unit], 0);

/** Formats a millisecond duration as a VictoriaLogs duration with a leading minus for negative values (e.g. "-5h30m") */
export function formatSignedDuration(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  return `${sign}${getDurationFromMilliseconds(Math.abs(ms))}`;
}

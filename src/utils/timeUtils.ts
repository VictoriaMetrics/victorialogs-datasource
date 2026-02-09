import { durationToMilliseconds } from '@grafana/data';

export const supportedDurations = [
  { long: 'years', short: 'y', possible: 'year' },
  { long: 'weeks', short: 'w', possible: 'week' },
  { long: 'days', short: 'd', possible: 'day' },
  { long: 'hours', short: 'h', possible: 'hour' },
  { long: 'minutes', short: 'm', possible: 'min' },
  { long: 'seconds', short: 's', possible: 'sec' },
  { long: 'milliseconds', short: 'ms', possible: 'millisecond' }
] as const;

type SupportedDuration = typeof supportedDurations[number];
type LongDuration = SupportedDuration['long'];
type ShortDuration = SupportedDuration['short'];
type LongDurationByShort = Record<ShortDuration, LongDuration>;
type Duration = Partial<Record<LongDuration, number>>;

export const getDurationFromMilliseconds = (ms: number): string => {
  const milliseconds = Math.floor(ms % 1000);
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor((ms / 1000 / 3600) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const durs = ['d', 'h', 'm', 's', 'ms'];
  const values = [days, hours, minutes, seconds, milliseconds].map((t, i) => t ? `${t}${durs[i]}` : '');
  return values.filter(t => t).join(' ');
};

const shortDurations = supportedDurations.map(d => d.short);
const longDurationsByShort: LongDurationByShort = supportedDurations.reduce((acc, d) => ({
  ...acc,
  [d.short]: d.long
}), {} as LongDurationByShort);

const isShortDuration = (str: string): str is ShortDuration => shortDurations.includes(str as ShortDuration);

export const isSupportedDuration = (str: string): Duration | undefined => {
  const digits = str.match(/\d+/g);
  const words = str.match(/[a-zA-Z]+/g);
  const shortDuration = words && words[0];
  if (shortDuration && digits && isShortDuration(shortDuration)) {
    const longDur = longDurationsByShort[shortDuration];
    if (longDur) {
      return { [longDur]: parseInt(digits[0], 10) };
    }
  }
  return;
};

export const getMillisecondsFromDuration = (dur: string) => {
  const shortSupportedDur = supportedDurations.map(d => d.short).join('|');
  const regexp = new RegExp(`\\d+(\\.\\d+)?[${shortSupportedDur}]+`, 'g');
  const durItems = dur.match(regexp) || [];

  const durObject = durItems.reduce((prev: Duration, curr) => {
    const dur = isSupportedDuration(curr);
    if (dur) {
      return {
        ...prev,
        ...dur
      };
    } else {
      return {
        ...prev
      };
    }
  }, {});

  const millisecondsAddition = durObject.milliseconds ? durObject.milliseconds : 0;

  // durationToMilliseconds does not handle the millisecond key, so we add it separately
  return durationToMilliseconds(durObject) + millisecondsAddition;
};

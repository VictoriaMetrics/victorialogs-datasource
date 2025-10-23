import dayjs, { UnitTypeShort } from "dayjs";

export const getDurationFromMilliseconds = (ms: number): string => {
  const milliseconds = Math.floor(ms % 1000);
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor((ms / 1000 / 3600) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const durs = ["d", "h", "m", "s", "ms"];
  const values = [days, hours, minutes, seconds, milliseconds].map((t, i) => t ? `${t}${durs[i]}` : "");
  return values.filter(t => t).join(" ");
};

export const supportedDurations = [
  { long: "years", short: "y", possible: "year" },
  { long: "weeks", short: "w", possible: "week" },
  { long: "days", short: "d", possible: "day" },
  { long: "hours", short: "h", possible: "hour" },
  { long: "minutes", short: "m", possible: "min" },
  { long: "seconds", short: "s", possible: "sec" },
  { long: "milliseconds", short: "ms", possible: "millisecond" }
];

const shortDurations = supportedDurations.map(d => d.short);

export const isSupportedDuration = (str: string): Partial<Record<UnitTypeShort, string>> | undefined => {

  const digits = str.match(/\d+/g);
  const words = str.match(/[a-zA-Z]+/g);

  if (words && digits && shortDurations.includes(words[0])) {
    return { [words[0]]: digits[0] };
  }
  return;
};

export const getMillisecondsFromDuration = (dur: string) => {
  const shortSupportedDur = supportedDurations.map(d => d.short).join("|");
  const regexp = new RegExp(`\\d+(\\.\\d+)?[${shortSupportedDur}]+`, "g");
  const durItems = dur.match(regexp) || [];

  const durObject = durItems.reduce((prev, curr) => {

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

  return dayjs.duration(durObject).asMilliseconds();
};

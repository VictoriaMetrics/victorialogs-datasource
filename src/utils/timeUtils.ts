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

// Shared constants describing the log entries that global-setup.ts ingests
// into VictoriaLogs and that the e2e tests expect to find in the Grafana UI.

export const SEED_STREAM_APP = 'victorialogs-e2e';
export const SEED_LOG_COUNT = 5;

const SEED_WINDOW_MS = 60_000;
// global-setup.ts pins the resolved seed window here. Playwright workers are
// separate processes inheriting this env, so every process queries exactly
// the same window even when the run crosses UTC midnight or the logs were
// seeded on an earlier day by a previous run against the same instance.
const SEED_WINDOW_FROM_ENV = 'E2E_SEED_WINDOW_FROM';

export const SEED_MESSAGES = Array.from({ length: SEED_LOG_COUNT }, (_, i) => `e2e log message ${i + 1}`);

// Builds the log entries to ingest: one per second, starting one second
// after the window opens.
export const buildSeedLogs = (windowFrom: Date) =>
  SEED_MESSAGES.map((message, i) => ({
    _time: new Date(windowFrom.getTime() + (i + 1) * 1000).toISOString(),
    _msg: message,
    level: 'info',
    app: SEED_STREAM_APP,
  }));

export const publishSeedWindow = (from: Date): void => {
  process.env[SEED_WINDOW_FROM_ENV] = from.toISOString();
};

// Returns the window pinned by global-setup, or today at midnight UTC as the
// default for a fresh seeding: a deterministic value that always falls within
// the VictoriaLogs retention period (entries with timestamps outside the
// retention are dropped on ingestion, so a fixed epoch would not work).
export const getSeedWindow = (): { from: Date; to: Date } => {
  const pinned = process.env[SEED_WINDOW_FROM_ENV];
  const from = pinned ? new Date(pinned) : todayMidnightUtc();
  return { from, to: new Date(from.getTime() + SEED_WINDOW_MS) };
};

const todayMidnightUtc = (): Date => {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  return midnight;
};

// Formats a date as 'YYYY-MM-DD HH:mm:ss' for the Grafana time picker. The
// browser runs in UTC (see timezoneId in playwright.config.ts), so the picker
// interprets these values as UTC.
export const toTimePickerFormat = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

import { SEED_LOG_COUNT, SEED_STREAM_APP, buildSeedLogs, getSeedWindow, publishSeedWindow } from './seed';

const VICTORIALOGS_URL = process.env.VICTORIALOGS_URL || 'http://localhost:9428';
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3000';
// Must match the datasource uid in tests/provisioning/datasources/datasources.yml.
const PROVISIONED_DATASOURCE_UID = 'victorialogs-e2e';

async function waitForVictoriaLogs(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${VICTORIALOGS_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // VictoriaLogs is not up yet, keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`VictoriaLogs is not reachable at ${VICTORIALOGS_URL} within ${timeoutMs}ms`);
}

// Waits until the provisioned datasource passes the health check. Besides
// checking that Grafana is up, this warms up the backend plugin process and
// verifies the whole Grafana -> plugin -> VictoriaLogs chain, so the tests
// don't hit the cold-start window right after the docker stack is created.
async function waitForGrafana(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${GRAFANA_URL}/api/datasources/uid/${PROVISIONED_DATASOURCE_UID}/health`, {
        headers: { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` },
      });
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Grafana is not ready at ${GRAFANA_URL} within ${timeoutMs}ms: ${lastError}`);
}

// Finds previously seeded log entries in recent history, not only in today's
// window: a stack kept running across UTC midnight still counts as seeded.
// The search window is deliberately wider than any realistic VictoriaLogs
// retention, so leftovers from older seeding logic surface as a loud error
// below instead of being silently reseeded on top of.
async function findSeededLogs(): Promise<Array<{ _time: string }>> {
  const now = Date.now();
  const params = new URLSearchParams({
    query: `{app="${SEED_STREAM_APP}"}`,
    start: new Date(now - 30 * 24 * 3_600_000).toISOString(),
    end: new Date(now + 24 * 3_600_000).toISOString(),
    limit: String(SEED_LOG_COUNT * 2),
  });
  const response = await fetch(`${VICTORIALOGS_URL}/select/logsql/query?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`VictoriaLogs query failed: ${response.status} ${await response.text()}`);
  }
  const text = (await response.text()).trim();
  return text === '' ? [] : text.split('\n').map((line) => JSON.parse(line));
}

async function ingestSeedLogs(logs: ReturnType<typeof buildSeedLogs>): Promise<void> {
  const body = logs.map((log) => JSON.stringify(log)).join('\n');
  const response = await fetch(`${VICTORIALOGS_URL}/insert/jsonline?_stream_fields=app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/stream+json' },
    body,
  });
  if (!response.ok) {
    throw new Error(`VictoriaLogs ingestion failed: ${response.status} ${await response.text()}`);
  }

  // Force flush so the ingested logs become searchable immediately,
  // see https://docs.victoriametrics.com/victorialogs/#forced-flush
  const flush = await fetch(`${VICTORIALOGS_URL}/internal/force_flush`);
  if (!flush.ok) {
    throw new Error(`VictoriaLogs forced flush failed: ${flush.status} ${await flush.text()}`);
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForVictoriaLogs();
  await waitForGrafana();

  const existing = await findSeededLogs();
  if (existing.length === SEED_LOG_COUNT) {
    // Already seeded by a previous run against the same VictoriaLogs instance:
    // adopt the window the logs were actually seeded into. The earliest entry
    // sits one second after the window start, see buildSeedLogs.
    const earliest = Math.min(...existing.map((log) => new Date(log._time).getTime()));
    publishSeedWindow(new Date(earliest - 1000));
    return;
  }
  if (existing.length !== 0) {
    throw new Error(
      `VictoriaLogs contains ${existing.length} seeded logs instead of 0 or ${SEED_LOG_COUNT}. ` +
        'Reset the e2e stack with `docker compose -f docker-compose.e2e.yaml down` and start it again.'
    );
  }

  const { from } = getSeedWindow();
  await ingestSeedLogs(buildSeedLogs(from));

  const seeded = await findSeededLogs();
  if (seeded.length !== SEED_LOG_COUNT) {
    throw new Error(`Expected ${SEED_LOG_COUNT} logs in VictoriaLogs after seeding, got ${seeded.length}`);
  }
  publishSeedWindow(from);
}

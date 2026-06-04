# E2E tests

End-to-end tests for the VictoriaLogs datasource plugin built with
[Playwright](https://playwright.dev/) and
[@grafana/plugin-e2e](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/get-started).

The tests run against a real Grafana + VictoriaLogs stack defined in
[docker-compose.e2e.yaml](../docker-compose.e2e.yaml). Before any test runs,
[global-setup.ts](./global-setup.ts) seeds VictoriaLogs with five log entries
described in [seed.ts](./seed.ts).

## Running locally

The shortest path is two make targets — build once, then run against any
versions:

```sh
make vl-e2e-build                                       # once
make vl-e2e-test GRAFANA_VERSION=11.0.0 VL_VERSION=v1.51.1
```

`vl-e2e-test` starts the stack, runs the tests, always stops the stack and
preserves the test exit code. Both versions default to `latest`.

The step-by-step flow behind it:

1. Install the dependencies, build the frontend and the linux backend binaries:

   ```sh
   yarn install
   yarn build
   make vl-backend-plugin-build-e2e
   ```

2. Install the Playwright browser (first time only):

   ```sh
   yarn playwright install chromium
   ```

3. Start the e2e stack (stop the development stack from `compose.yaml` first,
   both use ports 3000 and 9428):

   ```sh
   yarn e2e:server
   ```

4. Run the tests:

   ```sh
   yarn e2e        # headless
   yarn e2e:ui     # interactive UI mode
   ```

5. Tear the stack down:

   ```sh
   yarn e2e:server:down
   ```

## Testing against other versions

The stack is parameterized with environment variables:

```sh
GRAFANA_VERSION=11.0.0 VL_VERSION=v1.44.0 yarn e2e:server
```

The same variables work with `make vl-e2e-test`:

```sh
make vl-e2e-test GRAFANA_VERSION=11.0.0 VL_VERSION=v1.44.0
```

- `GRAFANA_IMAGE` — Grafana image name, defaults to `grafana-enterprise`
- `GRAFANA_VERSION` — Grafana image tag, defaults to `latest`
- `VL_VERSION` — VictoriaLogs image tag, defaults to `latest`
- `GRAFANA_HOST_PORT` — host port for Grafana, defaults to `3000`
- `VL_HOST_PORT` — host port for VictoriaLogs, defaults to `9428`

When using non-default host ports, point the tests at them:

```sh
GRAFANA_HOST_PORT=3001 VL_HOST_PORT=9429 yarn e2e:server
GRAFANA_URL=http://localhost:3001 VICTORIALOGS_URL=http://localhost:9429 yarn e2e
```

In CI ([.github/workflows/e2e.yml](../.github/workflows/e2e.yml)) pull requests
and pushes to `main` run the tests against the latest Grafana release
(satisfying `grafanaDependency` in `src/plugin.json`) and the latest
VictoriaLogs release. The release workflow reuses the same workflow with
`full-matrix: true`, which extends the matrix with the minimum supported
Grafana version and the previous VictoriaLogs minor version.

## Environment variables for tests

- `GRAFANA_URL` — Grafana base URL, defaults to `http://localhost:3000`
- `VICTORIALOGS_URL` — VictoriaLogs URL used for data seeding, defaults to `http://localhost:9428`

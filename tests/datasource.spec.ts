import { expect, test } from '@grafana/plugin-e2e';

// The result of "Save & test" is asserted via the alert rendered on the page
// rather than via the response returned by saveAndTest(): newer Grafana
// versions issue an automatic health check request while the new datasource
// page is still loading (with an empty URL), and saveAndTest() may resolve
// with the response of that request instead of the actual health check.
test.describe('VictoriaLogs datasource configuration', () => {
  test('creates a datasource via the UI and passes the health check', async ({
    createDataSourceConfigPage,
    readProvisionedDataSource,
    page,
  }) => {
    const provisioned = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const configPage = await createDataSourceConfigPage({ type: provisioned.type });

    // The URL input is rendered by DataSourceHttpSettings with the
    // plugin-defined default URL as a placeholder, see src/configuration/ConfigEditor.tsx.
    await page.getByPlaceholder('http://localhost:9428').fill(provisioned.url!);

    // Retry the click: on a cold Grafana frontend the button may be rendered
    // before its handler is attached, in which case the save request is lost.
    await expect(async () => {
      await configPage.saveAndTest();
      await expect(configPage).toHaveAlert('success', { hasText: 'Data source is working', timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('fails the health check when the URL points to a non-existing server', async ({
    createDataSourceConfigPage,
    readProvisionedDataSource,
    page,
  }) => {
    const provisioned = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const configPage = await createDataSourceConfigPage({ type: provisioned.type });

    await page.getByPlaceholder('http://localhost:9428').fill('http://victorialogs:1111');

    // The health check error message contains the unreachable URL, which
    // distinguishes it from errors produced by the automatic health check.
    await expect(async () => {
      await configPage.saveAndTest();
      await expect(configPage).toHaveAlert('error', { hasText: 'victorialogs:1111', timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  });
});

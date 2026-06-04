import { expect, test } from '@grafana/plugin-e2e';

import { SEED_LOG_COUNT, SEED_MESSAGES, getSeedWindow, toTimePickerFormat } from './seed';

test.describe('VictoriaLogs queries in Explore', () => {
  test('match-all query shows all seeded logs', async ({ explorePage, readProvisionedDataSource, page }) => {
    const provisioned = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    // The window is pinned by global-setup and inherited via the environment.
    const seedWindow = getSeedWindow();

    await explorePage.datasource.set(provisioned.name);
    await explorePage.timeRange.set({
      from: toTimePickerFormat(seedWindow.from),
      to: toTimePickerFormat(seedWindow.to),
    });

    // Replace the query editor content with the match-all query. The Monaco
    // editor container is labeled with the QueryField e2e selector,
    // see src/components/monaco-query-field/MonacoQueryField.tsx.
    const queryField = explorePage.getQueryEditorRow('A').getByLabel('Query field');
    await queryField.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('*');

    // Retry the run: right after the docker stack is created, the very first
    // query may be served while the frontend is not fully interactive yet.
    await expect(async () => {
      await expect(explorePage.runQuery()).toBeOK();
      await expect(page.getByText(SEED_MESSAGES[0])).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    // Every seeded log line is rendered in the logs panel.
    for (const message of SEED_MESSAGES) {
      await expect(page.getByText(message)).toBeVisible();
    }

    // And nothing else: the log rows match the seeded entries exactly.
    await expect(page.getByText(/e2e log message \d+/)).toHaveCount(SEED_LOG_COUNT);
  });
});

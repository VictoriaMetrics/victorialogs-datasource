import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { VictoriaLogsRequirement, VictoriaLogsSupport, VictoriaLogsSupportCache } from '../../victoriaLogsCompat/victoriaLogsSupport';

import { VictoriaLogsSupportAlert } from './VictoriaLogsSupportAlert';

const sortDirection: VictoriaLogsRequirement = {
  feature: 'The order of raw logs',
  needs: 'the sort_direction query arg',
  link: 'https://github.com/VictoriaMetrics/VictoriaLogs/pull/1355',
  pluginVersion: 'v0.36.0',
  minVersion: 'v1.54.0',
};

const renderAlert = (support: VictoriaLogsSupport) => {
  const cache = new VictoriaLogsSupportCache();
  const datasource = { uid: 'ds', getResource: jest.fn().mockResolvedValue(support) };
  return { datasource, ...render(<VictoriaLogsSupportAlert datasource={datasource} cache={cache} />) };
};

describe('VictoriaLogsSupportAlert', () => {
  it('renders nothing for a supported VictoriaLogs', async () => {
    const { container, datasource } = renderAlert({ version: 'v1.54.0', versionKnown: true, minVersion: 'v1.54.0', supported: true });
    await waitFor(() => expect(datasource.getResource).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('warns about an older VictoriaLogs with the required version and the requirements it does not meet', async () => {
    renderAlert({
      version: 'v1.53.0',
      versionKnown: true,
      minVersion: 'v1.54.0',
      supported: false,
      reason: 'VictoriaLogs v1.53.0 is older than v1.54.0',
      unmet: [sortDirection],
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('VictoriaLogs v1.53.0 is not supported by this plugin version');
    expect(alert).toHaveTextContent('requires VictoriaLogs v1.54.0 or newer');
    expect(alert).toHaveTextContent('What does not work with it:');
    expect(alert).toHaveTextContent('The order of raw logs needs the sort_direction query arg since VictoriaLogs v1.54.0');
    expect(screen.getByRole('link', { name: 'details' })).toHaveAttribute('href', sortDirection.link);
  });

  it('warns when the version is unknown, listing every requirement as what may not work', async () => {
    // the backend answers an unknown version with every requirement
    renderAlert({
      version: '',
      versionKnown: false,
      minVersion: 'v1.54.0',
      supported: false,
      reason: 'VictoriaLogs version is unknown: got response code 404',
      unmet: [sortDirection],
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('VictoriaLogs of an unknown version is not supported by this plugin version');
    expect(alert).toHaveTextContent('got response code 404');
    expect(alert).toHaveTextContent('What may not work with it:');
    expect(alert).toHaveTextContent('The order of raw logs needs');
  });

  it('tells that the check itself failed when the plugin backend could not be asked', async () => {
    renderAlert({ version: '', versionKnown: false, minVersion: '', supported: false, reason: 'Error loading datasource' });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The VictoriaLogs version could not be checked');
    expect(alert).toHaveTextContent('Error loading datasource');
    expect(alert).not.toHaveTextContent('or newer');
  });
});

import { VictoriaLogsRequirement, VictoriaLogsSupport } from '../../../victoriaLogsCompat/victoriaLogsSupport';

import { findUnmetCsvExport } from './useUnmetCsvExport';

const requirement = (id: string, minVersion: string): VictoriaLogsRequirement => ({
  id,
  feature: id,
  needs: id,
  link: 'https://example.com',
  pluginVersion: 'v0.35.0',
  minVersion,
});

const csvExport = requirement('csvExport', 'v1.49.0');
const sortDirection = requirement('sortDirection', 'v1.54.0');

const support = (overrides: Partial<VictoriaLogsSupport>): VictoriaLogsSupport => ({
  version: 'v1.54.0',
  versionKnown: true,
  minVersion: 'v1.54.0',
  supported: true,
  ...overrides,
});

describe('findUnmetCsvExport', () => {
  it('returns the requirement for a VictoriaLogs that is older than CSV needs', () => {
    const old = support({ version: 'v1.48.0', supported: false, unmet: [sortDirection, csvExport] });
    expect(findUnmetCsvExport(old)).toBe(csvExport);
  });

  it('returns nothing for a VictoriaLogs that is too old for other features only', () => {
    const old = support({ version: 'v1.53.0', supported: false, unmet: [sortDirection] });
    expect(findUnmetCsvExport(old)).toBeUndefined();
  });

  it('returns nothing for a supported VictoriaLogs', () => {
    expect(findUnmetCsvExport(support({}))).toBeUndefined();
  });

  it('returns nothing for an unknown version, which lists every requirement as unmet', () => {
    const unknown = support({ version: '', versionKnown: false, supported: false, unmet: [sortDirection, csvExport] });
    expect(findUnmetCsvExport(unknown)).toBeUndefined();
  });

  it('returns nothing before the answer of the backend', () => {
    expect(findUnmetCsvExport(undefined)).toBeUndefined();
  });
});

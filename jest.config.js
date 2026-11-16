// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

// Add ESM-only modules missing from grafanaESModules to the list of modules
// that need to be transformed
const additionalESModules = ['@react-hookz/web', '@ver0/deep-equal'];

// The scaffolded config declares a single transform (@swc/jest) for js/ts files
const [swcTransform] = Object.values(require('./.config/jest.config').transform);

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // Transform .mjs files too: some ESM-only modules (e.g. d3-interpolate, d3-color)
  // ship their entry point as .mjs, which the scaffolded pattern does not match
  transform: {
    ...require('./.config/jest.config').transform,
    '^.+\\.mjs$': swcTransform,
  },
  // Override transformIgnorePatterns to include the additional ESM-only modules
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, ...additionalESModules])],
  // Add module name mapper to resolve react-router/dom
  moduleNameMapper: {
    ...require('./.config/jest.config').moduleNameMapper,
    '^react-router/dom$': 'react-router-dom',
  },
};

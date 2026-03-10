// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

// Add d3-scale-chromatic to the list of modules that need to be transformed
const additionalESModules = ['d3-scale-chromatic'];

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // Override transformIgnorePatterns to include d3-scale-chromatic
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, ...additionalESModules])],
  // Add module name mapper to resolve react-router/dom
  moduleNameMapper: {
    ...require('./.config/jest.config').moduleNameMapper,
    '^react-router/dom$': 'react-router-dom',
  },
};

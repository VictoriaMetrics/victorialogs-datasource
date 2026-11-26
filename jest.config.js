// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // Add module name mapper to resolve react-router/dom
  moduleNameMapper: {
    ...require('./.config/jest.config').moduleNameMapper,
    '^react-router/dom$': 'react-router-dom',
  },
};

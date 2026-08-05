import ESLintPlugin from 'eslint-webpack-plugin';
import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  // A lint error must not kill `yarn dev`: with the scaffold's default `failOnError`
  // webpack-cli turns the processAssets hook error into a fatal exit (code 2).
  // The scaffolded config must not be edited directly, so the dev-only ESLint plugin
  // is re-created here with its original options plus the override
  baseConfig.plugins = baseConfig.plugins?.map((plugin) =>
    plugin instanceof ESLintPlugin ? new ESLintPlugin({ ...plugin.options, failOnError: false }) : plugin
  );

  return merge(baseConfig, {
    // update output configuration
    // other configurations stay the same
    output: {
      ...baseConfig.output,
      clean: {
        keep: new RegExp(`(.*?_(amd64|arm(64)?|s390x)(.exe)?|go_plugin_build_manifest)`),
      },
    },
  });
};

export default config;

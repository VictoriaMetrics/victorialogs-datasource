import ESLintPlugin from 'eslint-webpack-plugin';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';

const PLUGIN_DIST_DIR = path.resolve(process.cwd(), 'plugins/victoriametrics-logs-datasource');

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  baseConfig.plugins = baseConfig.plugins?.map((plugin) => {
    // A lint error must not kill `yarn dev`. The 7.9.1 scaffold already resolves
    // `failOnError` to false in development, so today this override is a defensive
    // pin: pre-7.9.1 scaffolds defaulted to true and webpack-cli turned the lint
    // error into a fatal exit (code 2), and scaffold updates regenerate .config
    if (plugin instanceof ESLintPlugin) {
      return new ESLintPlugin({ ...plugin.options, failOnError: false });
    }
    // The %VERSION%/%TODAY%/%PLUGIN_ID% substitution must run against the overridden
    // output directory — the scaffold rules are reused as-is, only `dir` is redirected
    if (plugin instanceof ReplaceInFileWebpackPlugin) {
      return new ReplaceInFileWebpackPlugin(plugin.options.map((option) => ({ ...option, dir: PLUGIN_DIST_DIR })));
    }
    return plugin;
  });

  return merge(baseConfig, {
    // update output configuration
    // other configurations stay the same
    output: {
      ...baseConfig.output,
      path: PLUGIN_DIST_DIR,
      clean: {
        keep: new RegExp(`(.*?_(amd64|arm(64)?|s390x)(.exe)?|go_plugin_build_manifest)`),
      },
    },
  });
};

export default config;

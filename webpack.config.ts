import DiagnosticsPlugin from 'diagnostics-webpack-plugin';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';

const PLUGIN_DIST_DIR = path.resolve(process.cwd(), 'plugins/victoriametrics-logs-datasource');

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  baseConfig.plugins = baseConfig.plugins?.map((plugin) => {
    // The scaffold plugin fails the build on a lint error. `yarn lint` owns that
    // check, so the build reports lint errors as warnings
    if (plugin instanceof DiagnosticsPlugin) {
      return new DiagnosticsPlugin({ ...plugin.given, reportAs: { errors: 'warning' } });
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

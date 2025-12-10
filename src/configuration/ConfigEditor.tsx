import React from 'react';
import { coerce, gte } from 'semver';

import { DataSourcePluginOptionsEditorProps, DataSourceSettings, FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineSwitch, InlineField, DataSourceHttpSettings, Space } from "@grafana/ui";

import { Options } from '../types';

import { AlertingSettings } from './AlertingSettings';
import { DerivedFields } from "./DerivedFields";
import { HelpfulLinks } from "./HelpfulLinks";
import { LimitsSettings } from "./LimitSettings";
import { LogLevelRulesEditor } from "./LogLevelRules/LogLevelRulesEditor";
import { LogsSettings } from './LogsSettings';
import { QuerySettings } from './QuerySettings';
import { TenantSettings } from "./TenantSettings";

const grafanaVersion = coerce(config.buildInfo.version);

export type PropsConfigEditor = DataSourcePluginOptionsEditorProps<Options>;

const makeJsonUpdater = <T,>(field: keyof Options) =>
  (options: DataSourceSettings<Options>, value: T): DataSourceSettings<Options> => ({
    ...options,
    jsonData: {
      ...options.jsonData,
      [field]: value,
    },
  })

const setMaxLines = makeJsonUpdater('maxLines');
const setDerivedFields = makeJsonUpdater('derivedFields');

const ConfigEditor = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <HelpfulLinks/>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:9428"
        dataSourceConfig={options}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
      />
      <AlertingSettings {...props}/>

      <Space v={5}/>

      <TenantSettings {...props} />

      <LimitsSettings {...props}>
        <QuerySettings
          maxLines={options.jsonData.maxLines || ''}
          onMaxLinedChange={(value) => onOptionsChange(setMaxLines(options, value))}
        />
      </LimitsSettings>

      <LogsSettings {...props}/>

      <DerivedFields
        fields={options.jsonData.derivedFields}
        onChange={(value) => onOptionsChange(setDerivedFields(options, value))}
      />

      <LogLevelRulesEditor {...props}/>

      {config.featureToggles['secureSocksDSProxyEnabled' as keyof FeatureToggles] && grafanaVersion && gte(grafanaVersion, '10.0.0') && (
        <>
          <InlineField
            label="Secure Socks Proxy"
            tooltip={
              <>
                Enable proxying the data source connection through the
                secure socks proxy to a
                different network.
                See{' '}
                <a
                  href="https://grafana.com/docs/grafana/next/setup-grafana/configure-grafana/proxy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Configure a data source connection proxy.
                </a>
              </>
            }
          >
            <InlineSwitch
              value={options.jsonData.enableSecureSocksProxy}
              onChange={(e) => {
                onOptionsChange({
                  ...options,
                  jsonData: {
                    ...options.jsonData,
                    enableSecureSocksProxy: e.currentTarget.checked
                  },
                });
              }}
            />
          </InlineField>
        </>
      )}
    </>
  );
};

export default ConfigEditor;

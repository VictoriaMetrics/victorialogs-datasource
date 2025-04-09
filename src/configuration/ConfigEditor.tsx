import React from 'react';
import { gte } from 'semver';

import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineSwitch, InlineField, DataSourceHttpSettings, SecureSocksProxySettings } from "@grafana/ui";

import { Options } from '../types';

import { AlertingSettings } from './AlertingSettings';
import { DerivedFields } from "./DerivedFields";
import { HelpfulLinks } from "./HelpfulLinks";
import { LimitsSettings } from "./LimitSettings";
import { LogsSettings } from './LogsSettings';
import { QuerySettings } from './QuerySettings';

export type Props = DataSourcePluginOptionsEditorProps<Options>;

const makeJsonUpdater = <T extends any>(field: keyof Options) =>
  (options: DataSourceSettings<Options>, value: T): DataSourceSettings<Options> => ({
    ...options,
    jsonData: {
      ...options.jsonData,
      [field]: value,
    },
  })

const setMaxLines = makeJsonUpdater('maxLines');
const setDerivedFields = makeJsonUpdater('derivedFields');

const ConfigEditor = (props: Props) => {
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
      <AlertingSettings options={options} onOptionsChange={onOptionsChange}/>
      <QuerySettings
        maxLines={options.jsonData.maxLines || ''}
        onMaxLinedChange={(value) => onOptionsChange(setMaxLines(options, value))}
      />
      <DerivedFields
        fields={options.jsonData.derivedFields}
        onChange={(value) => onOptionsChange(setDerivedFields(options, value))}
      />

      <LogsSettings {...props}/>

      <LimitsSettings {...props}/>

      {config.featureToggles['secureSocksDSProxyEnabled' as keyof FeatureToggles] && gte(config.buildInfo.version, '10.0.0') && (
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

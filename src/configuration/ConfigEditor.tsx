import React from 'react';

import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings, SecureSocksProxySettings } from "@grafana/ui";

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

      {config.secureSocksDSProxyEnabled && (
        <SecureSocksProxySettings options={props.options} onOptionsChange={onOptionsChange} />
      )}
    </>
  );
};

export default ConfigEditor;

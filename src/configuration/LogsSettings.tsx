import React, { SyntheticEvent, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineSwitch, Input, Stack, Text } from '@grafana/ui';

import { Options } from '../types';

import { PropsConfigEditor } from './ConfigEditor';
import { getValueFromEventItem } from './utils';

export const getDefaultVmuiUrl = (serverUrl = '') => `${serverUrl.replace(/\/$/, '')}/select/vmui/#/`;

export const LogsSettings = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;

  const optionsWithHttpMethod = useMemo(() => getOptionsWithHttpMethod(options), [options]);

  return (
    <Stack direction='column' gap={2}>
      <div>
        <Text variant='h4'>Misc</Text>
      </div>

      <div className='gf-form-group'>
        <div className='gf-form max-width-30'>
          <InlineField
            label='Custom query parameters'
            labelWidth={28}
            tooltip='Add Custom parameters to all queries.'
            interactive={true}
          >
            <Input
              className='width-25'
              value={optionsWithHttpMethod.jsonData.customQueryParameters}
              onChange={onChangeHandler('customQueryParameters', optionsWithHttpMethod, onOptionsChange)}
              spellCheck={false}
              placeholder='Example: max_source_resolution=5m&timeout=10'
            />
          </InlineField>
        </div>
        <div className='gf-form max-width-30'>
          <InlineField
            label='Link on vmui'
            labelWidth={28}
            tooltip={<>The link you want to use when clicking the <code>Run in vmui</code> button</>}
          >
            <Input
              className='width-25'
              value={optionsWithHttpMethod.jsonData.vmuiUrl}
              onChange={onChangeHandler('vmuiUrl', optionsWithHttpMethod, onOptionsChange)}
              spellCheck={false}
              placeholder={getDefaultVmuiUrl(optionsWithHttpMethod.url)}
            />
          </InlineField>
        </div>
        <div className='gf-form max-width-30'>
          <InlineField
            label='Use dataplane format'
            labelWidth={28}
            tooltip='Use Grafana dataplane log format (timestamp/body field names, DataFrameType.LogLines). Enables automatic label variables in correlations. May break existing client-side transformations that reference Time/Line field names.'
          >
            <InlineSwitch
              value={options.jsonData.useDataplaneFormat}
              onChange={(e) => {
                onOptionsChange({
                  ...options,
                  jsonData: {
                    ...options.jsonData,
                    useDataplaneFormat: e.currentTarget.checked,
                  },
                });
              }}
            />
          </InlineField>
        </div>
      </div>
    </Stack>
  );
};

const getOptionsWithHttpMethod = (options: PropsConfigEditor['options']): PropsConfigEditor['options'] => {
  // We are explicitly adding httpMethod so it is correctly displayed in dropdown. This way, it is more predictable for users.
  return !options.jsonData.httpMethod
    ? {
      ...options,
      jsonData: {
        ...options.jsonData,
        httpMethod: 'POST',
      },
    }
    : options;
};

const onChangeHandler =
  (key: keyof Options, options: PropsConfigEditor['options'], onOptionsChange: PropsConfigEditor['onOptionsChange']) =>
    (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
      onOptionsChange({
        ...options,
        jsonData: {
          ...options.jsonData,
          [key]: getValueFromEventItem(eventItem),
        },
      });
    };

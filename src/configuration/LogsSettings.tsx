import React, { SyntheticEvent } from 'react';

import {
    DataSourcePluginOptionsEditorProps,
    SelectableValue,
} from '@grafana/data';
import {
  InlineField,
  regexValidation,
  Input, validate
} from '@grafana/ui';

import { Options } from '../types';

type Props = Pick<DataSourcePluginOptionsEditorProps<Options>, 'options' | 'onOptionsChange'>;

export const LogsSettings = (props: Props) => {
  const {options, onOptionsChange} = props;

  // We are explicitly adding httpMethod so it is correctly displayed in dropdown. This way, it is more predictable for users.

  if (!options.jsonData.httpMethod) {
    options.jsonData.httpMethod = 'POST';
  }
  return (
    <>
      <h3 className="page-heading">Misc</h3>
      <div className="gf-form-group">
        <div className="gf-form max-width-30">
          <InlineField
            label="Custom query parameters"
            labelWidth={14}
            tooltip="Add Custom parameters to all queries."
            interactive={true}
           >
            <Input
              className="width-25"
              value={options.jsonData.customQueryParameters}
              onChange={onChangeHandler('customQueryParameters', options, onOptionsChange)}
              spellCheck={false}
              placeholder="Example: max_source_resolution=5m&timeout=10"
            />
          </InlineField>
        </div>
      </div>
    </>
  );
};

export const getValueFromEventItem = (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
  if (!eventItem) {
    return '';
  }

  if (eventItem.hasOwnProperty('currentTarget')) {
    return eventItem.currentTarget.value;
  }

  return (eventItem as SelectableValue<string>).value;
};

const onChangeHandler =
  (key: keyof Options, options: Props['options'], onOptionsChange: Props['onOptionsChange']) =>
  (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        [key]: getValueFromEventItem(eventItem),
      },
    });
  };


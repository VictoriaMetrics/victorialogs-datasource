import React, { SyntheticEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import {
  InlineField,
  Input,
  Stack,
  Text
} from '@grafana/ui';

import { Options } from '../types';

import { PropsConfigEditor } from "./ConfigEditor";
import { getValueFromEventItem } from "./utils";

export const LogsSettings = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;

  // We are explicitly adding httpMethod so it is correctly displayed in dropdown. This way, it is more predictable for users.

  if (!options.jsonData.httpMethod) {
    options.jsonData.httpMethod = 'POST';
  }
  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Misc</Text>
      </div>

      <div className="gf-form-group">
        <div className="gf-form max-width-30">
          <InlineField
            label="Custom query parameters"
            labelWidth={28}
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
    </Stack>
  );
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


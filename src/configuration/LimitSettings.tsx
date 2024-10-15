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

import { FilterFieldType, Options } from "../types";

const validationRule = regexValidation(
  /^$|^\d+$/,
  'Value is not valid, you can use number'
)

const limitFields = [
  {
    label: "Field values",
    tooltip: <>In the Query Builder, the <code>/select/logsql/field_values</code> endpoint allows an optional <code>limit=N</code> parameter to restrict the number of returned values to <code>N</code>. For more details, see the documentation <a href="https://docs.victoriametrics.com/victorialogs/querying/#querying-field-values" target="_blank" rel="noreferrer">here</a>.</>,
    placeholder: "",
    key: FilterFieldType.FieldValue
  }
]

type Props = Pick<DataSourcePluginOptionsEditorProps<Options>, 'options' | 'onOptionsChange'>;

export const LimitsSettings = (props: Props) => {
  const { options, onOptionsChange } = props;

  const [error, setError] = React.useState<string | null>(null)

  const handleBlur = (event: SyntheticEvent<HTMLInputElement>) => {
    const errors = validate(event.currentTarget.value, [validationRule])
    setError(errors?.[0] || null)
  }

  return (
    <>
      <h3 className="page-heading">Limits</h3>
      <p className="text-help">Leave the field blank or set the value to <code>0</code> to remove the limit</p>
      <div className="gf-form-group">
        {limitFields.map((field) => (
          <div className="gf-form" key={field.key}>
            <InlineField
              label={field.label}
              labelWidth={28}
              tooltip={field.tooltip}
              interactive={true}
              error={error}
              invalid={!!error}
            >
              <Input
                className="width-6"
                value={`${options.jsonData?.queryBuilderLimits?.[field.key] || ''}`}
                onChange={onChangeHandler(field.key, options, onOptionsChange)}
                spellCheck={false}
                placeholder={field.placeholder}
                onBlur={handleBlur}
              />
            </InlineField>
          </div>
        ))}
      </div>
    </>
  )
};

const getValueFromEventItem = (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
  if (!eventItem) {
    return '';
  }

  if (eventItem.hasOwnProperty('currentTarget')) {
    return eventItem.currentTarget.value;
  }

  return (eventItem as SelectableValue<string>).value;
};

const onChangeHandler =
  (key: string, options: Props['options'], onOptionsChange: Props['onOptionsChange']) =>
    (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
      onOptionsChange({
        ...options,
        jsonData: {
          ...options.jsonData,
          queryBuilderLimits: {
            ...options.jsonData.queryBuilderLimits,
            [key]: getValueFromEventItem(eventItem),
          }
        },
      });
    };

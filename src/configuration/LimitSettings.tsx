import React, { SyntheticEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import {
  InlineField,
  regexValidation,
  Input,
  validate,
  TextLink,
  Stack,
  Text
} from '@grafana/ui';

import { VICTORIA_LOGS_DOCS_HOST } from "../conf";
import { FilterFieldType } from "../types";

import { PropsConfigEditor } from "./ConfigEditor";
import { getValueFromEventItem } from "./utils";

const validationRule = regexValidation(
  /^$|^\d+$/,
  'Value is not valid, you can use number'
)

const documentationLink = (
  <TextLink
    external
    variant="bodySmall"
    href={`${VICTORIA_LOGS_DOCS_HOST}/victorialogs/querying/#querying-field-values`}
  >
    Learn more about querying field values
  </TextLink>
)


const limitFields = [
  {
    label: "Field values",
    tooltip: (<>
      In the Query Builder, the <code>/select/logsql/field_values</code> endpoint allows an
      optional <code>limit=N</code> parameter to restrict the number of returned values to <code>N</code>.
      Leave the field blank or set the value to <code>0</code> to remove the limit
    </>),
    placeholder: "",
    key: FilterFieldType.FieldValue
  }
]

type Props = PropsConfigEditor & {
  children?: React.ReactNode
};

export const LimitsSettings = (props: Props) => {
  const { options, onOptionsChange, children } = props;

  const [error, setError] = React.useState<string | null>(null)

  const handleBlur = (event: SyntheticEvent<HTMLInputElement>) => {
    const errors = validate(event.currentTarget.value, [validationRule])
    setError(errors?.[0] || null)
  }

  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Limits</Text>
        <Text variant="bodySmall" color="disabled" element="p">
          Sets a limit on how many values are returned in query results. {documentationLink}
        </Text>
      </div>

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
                className="width-8"
                value={`${options.jsonData?.queryBuilderLimits?.[field.key] || ''}`}
                onChange={onChangeHandler(field.key, options, onOptionsChange)}
                spellCheck={false}
                placeholder={field.placeholder}
                onBlur={handleBlur}
              />
            </InlineField>
          </div>
        ))}
        {children}
      </div>
    </Stack>
  )
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

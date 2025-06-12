import React, { SyntheticEvent } from 'react';

import { SelectableValue } from "@grafana/data";
import { InlineField, Input, Stack, Text, TextLink } from '@grafana/ui';

import { TenantHeaderNames } from "../types";

import { PropsConfigEditor } from "./ConfigEditor";
import { getValueFromEventItem } from "./utils";

const documentationLink = (
  <TextLink
    external
    variant="bodySmall"
    href="https://docs.victoriametrics.com/victorialogs/#multitenancy">
    Learn more about multitenancy
  </TextLink>
)

const fields = [
  {
    label: "Account ID",
    placeholder: "0",
    key: TenantHeaderNames.AccountID
  },
  {
    label: "Project ID",
    placeholder: "0",
    key: TenantHeaderNames.ProjectID
  }
];

export const TenantSettings = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;
  console.log(options)
  const multitenancyHeaders = options.jsonData?.multitenancyHeaders;

  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Multitenancy</Text>
        <Text variant="bodySmall" color="disabled" element="p">
          Manage tenants and multitenancy settings. {documentationLink}
        </Text>
      </div>

      <div className="gf-form-group">
        {fields.map((field) => (
          <div className="gf-form" key={field.key}>
            <InlineField
              label={field.label}
              labelWidth={28}
              interactive={true}
            >
              <Input
                className="width-8"
                spellCheck={false}
                type="number"
                placeholder={field.placeholder}
                value={`${multitenancyHeaders?.[field.key] || ''}`}
                onChange={onChangeHandler(field.key, options, onOptionsChange)}
              />
            </InlineField>
          </div>
        ))}
      </div>
    </Stack>
  );
};

const onChangeHandler = (
  key: TenantHeaderNames,
  options: PropsConfigEditor['options'],
  onOptionsChange: PropsConfigEditor['onOptionsChange']
) => (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
  onOptionsChange({
    ...options,
    jsonData: {
      ...options.jsonData,
      multitenancyHeaders: {
        ...options.jsonData.multitenancyHeaders,
        [key]: getValueFromEventItem(eventItem),
      }
    },
  });
};

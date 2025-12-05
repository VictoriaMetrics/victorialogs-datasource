import React, { SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { SelectableValue } from "@grafana/data";
import { getBackendSrv } from '@grafana/runtime';
import { Combobox, ComboboxOption, InlineField, Input, Stack, Text, TextLink } from '@grafana/ui';

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

export const TenantSettings = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;
  const multitenancyHeaders = options.jsonData?.multitenancyHeaders;

  const [accountIds, setAccountIds] = useState<ComboboxOption[]>([]);
  const [projectIds, setProjectIds] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenantIds = useCallback(async () => {
    // Only try to load if datasource is saved (has ID and URL)
    if (!options.id || !options.url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await getBackendSrv().post(
        `/api/datasources/${options.id}/resources/select/tenant_ids`,
        {}
      );

      // Check if response is an array
      if (Array.isArray(response)) {
        const accountIDSet = new Set<string>();
        const projectIDSet = new Set<string>();

        response.forEach((item: { account_id: number; project_id: number }) => {
          accountIDSet.add(String(item.account_id));
          projectIDSet.add(String(item.project_id));
        });

        setAccountIds(Array.from(accountIDSet).map(id => ({ label: id, value: id })));
        setProjectIds(Array.from(projectIDSet).map(id => ({ label: id, value: id })));
      }
    } catch (error) {
      // Silently fail - tenant IDs are optional
      console.error('Failed to load tenant IDs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options.id, options.url]);

  useEffect(() => {
    void loadTenantIds();
  }, [loadTenantIds]);

  const onAccountIdChange = (option: ComboboxOption<string> | null) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        multitenancyHeaders: {
          ...options.jsonData.multitenancyHeaders,
          [TenantHeaderNames.AccountID]: option?.value || '',
        }
      },
    });
  };

  const onProjectIdChange = (option: ComboboxOption<string> | null) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        multitenancyHeaders: {
          ...options.jsonData.multitenancyHeaders,
          [TenantHeaderNames.ProjectID]: option?.value || '',
        }
      },
    });
  };

  const onInputChange = (
    key: TenantHeaderNames
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

  const hasTenants = accountIds.length > 0 || projectIds.length > 0;

  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Multitenancy</Text>
        <Text variant="bodySmall" color="disabled" element="p">
          Manage tenants and multitenancy settings. {documentationLink}
        </Text>
      </div>

      <div className="gf-form-group">
        <div className="gf-form">
          <InlineField
            label="Account ID"
            labelWidth={28}
            interactive={true}
          >
            {hasTenants ? (
              <Combobox
                placeholder="Select Account ID"
                isClearable
                options={accountIds}
                value={multitenancyHeaders?.[TenantHeaderNames.AccountID]}
                onChange={onAccountIdChange}
                loading={isLoading}
                width={30}
              />
            ) : (
              <Input
                className="width-8"
                spellCheck={false}
                type="number"
                placeholder="0"
                value={`${multitenancyHeaders?.[TenantHeaderNames.AccountID] || ''}`}
                onChange={onInputChange(TenantHeaderNames.AccountID)}
              />
            )}
          </InlineField>
        </div>

        <div className="gf-form">
          <InlineField
            label="Project ID"
            labelWidth={28}
            interactive={true}
          >
            {hasTenants ? (
              <Combobox
                placeholder="Select Project ID"
                isClearable
                options={projectIds}
                value={multitenancyHeaders?.[TenantHeaderNames.ProjectID]}
                onChange={onProjectIdChange}
                loading={isLoading}
                width={30}
              />
            ) : (
              <Input
                className="width-8"
                spellCheck={false}
                type="number"
                placeholder="0"
                value={`${multitenancyHeaders?.[TenantHeaderNames.ProjectID] || ''}`}
                onChange={onInputChange(TenantHeaderNames.ProjectID)}
              />
            )}
          </InlineField>
        </div>
      </div>
    </Stack>
  );
};

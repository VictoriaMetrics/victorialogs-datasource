import React, { SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { SelectableValue } from "@grafana/data";
import { getDataSourceSrv } from '@grafana/runtime';
import { Combobox, ComboboxOption, InlineField, Input, Stack, Text, TextLink } from '@grafana/ui';

import { VictoriaLogsDatasource } from "../datasource";
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
  const isReadOnly = options.readOnly;

  const [tenants, setTenants] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenantIds = useCallback(async () => {
    // Only try to load if datasource is saved (has ID and URL)
    if (!options.id || !options.url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const ds = await getDataSourceSrv().get(options.uid) as VictoriaLogsDatasource;
      const tenantList = await ds.fetchTenantIds();

      setTenants(tenantList.map(id => ({ label: id, value: id })));
    } catch (error) {
      // Silently fail - tenant IDs are optional
      console.error('Failed to load tenant IDs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options.id, options.url, options.uid]);

  useEffect(() => {
    void loadTenantIds();
  }, [loadTenantIds]);

  const onTenantChange = (option: ComboboxOption<string> | null) => {
    const [accountId = '', projectId = ''] = option?.value?.split(':') || ['0', '0'];

    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        multitenancyHeaders: {
          ...options.jsonData.multitenancyHeaders,
          [TenantHeaderNames.AccountID]: accountId,
          [TenantHeaderNames.ProjectID]: projectId,
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

  const hasTenants = tenants.length > 0;

  // Combine current accountId and projectId into tenant format
  const currentTenant = multitenancyHeaders?.[TenantHeaderNames.AccountID] && multitenancyHeaders?.[TenantHeaderNames.ProjectID]
    ? `${multitenancyHeaders[TenantHeaderNames.AccountID]}:${multitenancyHeaders[TenantHeaderNames.ProjectID]}`
    : '';

  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Multitenancy</Text>
        <Text variant="bodySmall" color="disabled" element="p">
          Manage tenants and multitenancy settings. {documentationLink}
        </Text>
      </div>

      <div className="gf-form-group">
        {hasTenants ? (
          <div className="gf-form">
            <InlineField
              label="Tenant"
              labelWidth={28}
              interactive={true}
              tooltip="Format: accountId:projectId (e.g., 1:2)"
              disabled={isReadOnly || isLoading}
            >
              <Combobox
                placeholder="Select Tenant"
                isClearable
                options={tenants}
                value={currentTenant}
                onChange={onTenantChange}
                loading={isLoading}
                width={30}
                disabled={isReadOnly || isLoading}
              />
            </InlineField>
          </div>
        ) : (
          <>
            <div className="gf-form">
              <InlineField
                label="Account ID"
                labelWidth={28}
                interactive={true}
                disabled={isReadOnly || isLoading}
              >
                <Input
                  className="width-8"
                  spellCheck={false}
                  type="number"
                  placeholder="0"
                  value={`${multitenancyHeaders?.[TenantHeaderNames.AccountID] || ''}`}
                  onChange={onInputChange(TenantHeaderNames.AccountID)}
                  disabled={isReadOnly || isLoading}
                />
              </InlineField>
            </div>

            <div className="gf-form">
              <InlineField
                label="Project ID"
                labelWidth={28}
                interactive={true}
                disabled={isReadOnly || isLoading}
              >
                <Input
                  className="width-8"
                  spellCheck={false}
                  type="number"
                  placeholder="0"
                  value={`${multitenancyHeaders?.[TenantHeaderNames.ProjectID] || ''}`}
                  onChange={onInputChange(TenantHeaderNames.ProjectID)}
                  disabled={isReadOnly || isLoading}
                />
              </InlineField>
            </div>
          </>
        )}
      </div>
    </Stack>
  );
};

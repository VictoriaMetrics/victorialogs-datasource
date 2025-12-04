import { css } from "@emotion/css";
import React, { useCallback, useEffect, useState } from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { Combobox, ComboboxOption, InlineField, useStyles2 } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../datasource";
import { Query } from "../../types";

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  onChange: (query: Query) => void;
}

export const TenantSelector = ({ datasource, query, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const [accountIds, setAccountIds] = useState<ComboboxOption<string>[]>([]);
  const [projectIds, setProjectIds] = useState<ComboboxOption<string>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenantIds = useCallback(async () => {
    setIsLoading(true);
    try {
      const tenantIds = await datasource.fetchTenantIds();

      // Check if both arrays are empty (unsupported version)
      const hasAccountIds = tenantIds.accountIDs && tenantIds.accountIDs.length > 0;
      const hasProjectIds = tenantIds.projectIDs && tenantIds.projectIDs.length > 0;

      if (!hasAccountIds || !hasProjectIds) {
        return;
      }

      if (tenantIds.accountIDs) {
        setAccountIds(tenantIds.accountIDs.map(id => ({ label: id, value: id })));
      }

      if (tenantIds.projectIDs) {
        setProjectIds(tenantIds.projectIDs.map(id => ({ label: id, value: id })));
      }
    } catch (error) {
      // Should not happen as fetchTenantIds handles errors internally
      console.error('Failed to load tenant IDs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [datasource]);

  useEffect(() => {
    void loadTenantIds();
  }, [loadTenantIds]);

  // Don't render if not yet initialized or endpoint is not supported
  if (!accountIds.length && !projectIds.length) {
    return null;
  }

  const handleAccountIdChange = (option: ComboboxOption<string> | null) => {
    onChange({
      ...query,
      accountId: option?.value,
    });
  };

  const handleProjectIdChange = (option: ComboboxOption<string> | null) => {
    onChange({
      ...query,
      projectId: option?.value,
    });
  };

  return (
    <div className={styles.container}>
      <InlineField label="AccountID" labelWidth={14} tooltip="Override datasource AccountID for this query">
        <Combobox
          placeholder="Select AccountID"
          isClearable
          options={accountIds}
          value={query.accountId}
          onChange={handleAccountIdChange}
          loading={isLoading}
          width={20}
        />
      </InlineField>

      <InlineField label="ProjectID" labelWidth={14} tooltip="Override datasource ProjectID for this query">
        <Combobox
          placeholder="Select ProjectID"
          isClearable
          options={projectIds}
          value={query.projectId}
          onChange={handleProjectIdChange}
          loading={isLoading}
          width={20}
        />
      </InlineField>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
});

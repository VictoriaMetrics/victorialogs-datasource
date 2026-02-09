import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';

import { FilterVisualQuery, Query } from '../../types';

import { buildVisualQueryFromString } from './QueryBuilder/utils/parseFromString';

interface AdHocFiltersControlProps {
  query: Query;
  app?: CoreApp;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

export const AdHocFiltersControl: React.FC<AdHocFiltersControlProps> = ({
  query,
  app,
  onChange,
  onRunQuery,
}) => {
  const styles = useStyles2(getStyles);

  // Parse extra_filters into individual filter strings
  const adHocFilters = useMemo(() => {
    if (!query.extraFilters) {
      return [];
    }

    try {
      const parsed = buildVisualQueryFromString(query.extraFilters);
      const filters: string[] = [];

      // Extract individual filter values from the parsed structure
      const extractFilters = (values: (string | FilterVisualQuery)[]) => {
        for (const value of values) {
          if (typeof value === 'string') {
            // Only add if it looks like a complete filter (has a colon)
            if (value.includes(':')) {
              filters.push(value);
            }
          } else if (value && typeof value === 'object' && value.values) {
            // Recursively extract from nested filters
            extractFilters(value.values);
          }
        }
      };

      extractFilters(parsed.query.filters.values);
      return filters;
    } catch (e) {
      console.error('Failed to parse extra_filters:', e);
      return [];
    }
  }, [query.extraFilters]);

  const handleDeleteFilter = (filterToDelete: string) => {
    if (!query.extraFilters) {
      return;
    }

    const remainingFilters = adHocFilters.filter(f => f !== filterToDelete);
    const newExtraFilters = remainingFilters.join(' AND ');

    onChange({
      ...query,
      extraFilters: newExtraFilters || undefined,
    });
    onRunQuery();
  };

  const handleMoveToQuery = (filterToMove: string) => {
    if (!query.extraFilters) {
      return;
    }

    // Remove from extra_filters
    const remainingFilters = adHocFilters.filter(f => f !== filterToMove);
    const newExtraFilters = remainingFilters.join(' AND ');

    // Add to query expression
    const currentExpr = query.expr?.trim() || '*';
    const newExpr = currentExpr === '*'
      ? filterToMove
      : `${filterToMove} AND ${currentExpr}`;

    onChange({
      ...query,
      expr: newExpr,
      extraFilters: newExtraFilters || undefined,
    });
    onRunQuery();
  };

  // Only show on Explore page and when there are filters
  if (app !== CoreApp.Explore || adHocFilters.length === 0) {
    return null;
  }

  return (
    <div className={styles.adHocFiltersContainer}>
      <div className={styles.adHocFiltersLabel}>
        <Icon name='filter' size='sm' />
        <span>Ad-hoc filters:</span>
      </div>
      {adHocFilters.map((filter, index) => (
        <div key={index} className={styles.adHocFilterItem}>
          <span className={styles.filterText}>{filter}</span>
          <div className={styles.filterActions}>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => handleMoveToQuery(filter)}
              tooltip='Move to query'
              fill='text'
            >
              <Icon name='arrow-up' />
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => handleDeleteFilter(filter)}
              tooltip='Delete filter'
              fill='text'
            >
              <Icon name='times' />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    adHocFiltersContainer: css`
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing(1)};
      width: fit-content;
      margin-top: ${theme.spacing(1)};
      padding: ${theme.spacing(1)};
      background-color: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
    `,
    adHocFiltersLabel: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.secondary};
      white-space: nowrap;
    `,
    adHocFilterItem: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
      padding: ${theme.spacing(0.25, 0.25, 0.25, 1)};
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};

      &:hover {
        border-color: ${theme.colors.border.medium};
      }
    `,
    filterText: css`
      color: ${theme.colors.text.primary};
      white-space: nowrap;
      margin-right: ${theme.spacing(0.5)};
    `,
    filterActions: css`
      display: flex;
      align-items: center;
      padding-left: ${theme.spacing(0.25)};
      border-left: 1px solid ${theme.colors.border.weak};
      
      button {
        padding: 0 ${theme.spacing(0.25)};
        color: ${theme.colors.text.secondary};
        
        &:hover {
          color: ${theme.colors.text.primary};
        }
      }
    `,
  };
};

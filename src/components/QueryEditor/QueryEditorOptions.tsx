import React, { useMemo } from 'react';

import { CoreApp, isValidGrafanaDuration, SelectableValue } from '@grafana/data';
import { AutoSizeInput, InlineSwitch, Input, RadioButtonGroup, TextLink } from '@grafana/ui';

import { VICTORIA_LOGS_DOCS_HOST } from '../../conf';
import { LOGS_LIMIT_HARD_CAP, LOGS_LIMIT_WARNING_THRESHOLD } from '../../constants';
import { Query, QueryType } from '../../types';
import { isVariable } from '../../utils/isVariable';
import { useMaxLinesWarning } from '../shared/shared/useMaxLinesWarning';

import EditorField from './EditorField';
import { EditorRow } from './EditorRow';
import QueryEditorOptionsGroup from './QueryEditorOptionsGroup';

export interface Props {
  query: Query;
  onChange: (update: Query) => void;
  onRunQuery: () => void;
  maxLines: number;
  app?: CoreApp;
}

export const queryTypeOptions: Array<SelectableValue<QueryType>> = [
  {
    value: QueryType.Instant,
    label: 'Raw Logs',
    filter: ({ app }: Props) => app !== CoreApp.UnifiedAlerting && app !== CoreApp.CloudAlerting,
    description: 'Use `/select/logsql/query` for querying logs.',
  },
  {
    value: QueryType.StatsRange,
    label: 'Range',
    description: 'Use `/select/logsql/stats_query_range` for querying log stats over the given time range.'
  },
  {
    value: QueryType.Stats,
    label: 'Instant',
    description: 'Use `/select/logsql/stats_query` for querying log stats at the given time.'
  },
];

export const QueryEditorOptions = React.memo<Props>(({ app, query, maxLines, onChange, onRunQuery }) => {
  const filteredOptions = queryTypeOptions.filter(option => option.filter?.({ app }) ?? true);
  const queryType = query.queryType;

  const isValidStep = useMemo(() => {
    return !query.step || isValidGrafanaDuration(query.step) || !isNaN(+query.step) || isVariable(query.step);
  }, [query.step]);

  const collapsedInfo = getCollapsedInfo({
    app,
    query,
    queryType,
    maxLines,
    isValidStep,
  });

  const isOverCap = query.maxLines !== undefined && query.maxLines > LOGS_LIMIT_HARD_CAP;
  const { modal: maxLinesWarningModal, requestConfirmation } = useMaxLinesWarning(onRunQuery);

  const onMaxLinesChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.currentTarget.value, 10);
    let newMaxLines = isNaN(parsed) || parsed < 0 ? undefined : parsed;
    if (newMaxLines !== undefined && newMaxLines > LOGS_LIMIT_HARD_CAP){
      newMaxLines = LOGS_LIMIT_HARD_CAP;
    }
    onChange({ ...query, maxLines: newMaxLines });
  };

  const onMaxLinesBlur = () => {
    if (query.maxLines !== undefined && query.maxLines > LOGS_LIMIT_WARNING_THRESHOLD) {
      requestConfirmation(query.maxLines);
    }

    if (query.maxLines === undefined) {
      onRunQuery();
      return;
    }
  };

  const onQueryTypeChange = (value: QueryType) => {
    onChange({ ...query, queryType: value });
    onRunQuery();
  };

  const onLegendFormatChanged = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, legendFormat: e.currentTarget.value });
    onRunQuery();
  };

  const onStepChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({ ...query, step: e.currentTarget.value.trim() });
    onRunQuery();
  };

  const onFiltersToRootQueryChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({ ...query, isApplyExtraFiltersToRootQuery: e.currentTarget.checked });
    onRunQuery();
  };

  return (
    <EditorRow>
      {maxLinesWarningModal}
      <QueryEditorOptionsGroup
        title='Options'
        collapsedInfo={collapsedInfo}
      >
        <EditorField
          label='Legend'
          tooltip='Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname.'
        >
          <AutoSizeInput
            placeholder='{{label}}'
            type='string'
            minWidth={14}
            defaultValue={query.legendFormat}
            onCommitChange={onLegendFormatChanged}
          />
        </EditorField>
        <div>
          <EditorField label='Type'>
            <RadioButtonGroup options={filteredOptions} value={queryType} onChange={onQueryTypeChange} />
          </EditorField>
          <TextLink
            href={`${VICTORIA_LOGS_DOCS_HOST}/victorialogs/querying/`}
            icon='external-link-alt'
            variant={'bodySmall'}
            external
          >
            Learn more about querying logs
          </TextLink>
        </div>
        {queryType === QueryType.Instant && (
          <EditorField
            label='Line limit'
            tooltip={`Upper limit for number of log lines returned by query. Maximum: ${LOGS_LIMIT_HARD_CAP}.`}
            invalid={isOverCap}
            error={`Maximum value is ${LOGS_LIMIT_HARD_CAP}.`}
          >
            <Input
              id='line-limit-input'
              className='width-4'
              placeholder={maxLines.toString()}
              type='number'
              min={0}
              max={LOGS_LIMIT_HARD_CAP}
              value={query.maxLines?.toString() ?? ''}
              onChange={onMaxLinesChange}
              onBlur={onMaxLinesBlur}
            />
          </EditorField>
        )}
        {queryType === QueryType.StatsRange && (
          <EditorField
            label='Step'
            tooltip='Use the `step` parameter when making metric queries. If not specified, Grafana will use a calculated interval. Example values: 1s, 5m, 10h, 1d.'
            invalid={!isValidStep}
            error={'Invalid step. Example valid values: 1s, 5m, 10h, 1d. Supports $variable referencing.'}
          >
            <AutoSizeInput
              className='width-6'
              placeholder={'auto'}
              type='string'
              defaultValue={query.step ?? ''}
              onCommitChange={onStepChange}
            />
          </EditorField>
        )}
        {app !== CoreApp.Explore && (
          <EditorField
            label='Ad-hoc filters to root query'
            tooltip='When enabled, ad-hoc filters are prepended to the query expression instead of being sent as extra_filters parameter. This prevents filters from propagating into join/union subqueries.'
          >
            <InlineSwitch
              value={query.isApplyExtraFiltersToRootQuery ?? false}
              onChange={onFiltersToRootQueryChange}
            />
          </EditorField>
        )}
      </QueryEditorOptionsGroup>
    </EditorRow>
  );
}
);

QueryEditorOptions.displayName = 'QueryEditorOptions';

interface CollapsedInfoProps {
  app?: CoreApp;
  query: Query;
  maxLines: number,
  isValidStep: boolean,
  queryType?: string;
}

function getCollapsedInfo({ app, query, queryType, maxLines, isValidStep }: CollapsedInfoProps): string[] {
  const items: string[] = [];

  const queryTypeLabel = queryTypeOptions.find(option => option.value === queryType)?.label || 'unknown';
  items.push(`Type: ${queryTypeLabel}`);

  query.legendFormat && items.push(`Legend: ${query.legendFormat}`);

  if (queryType === QueryType.StatsRange && query.step) {
    items.push(`Step: ${isValidStep ? query.step : 'Invalid value'}`);
  }

  if (queryType === QueryType.Instant && maxLines) {
    items.push(`Line limit: ${query.maxLines ?? maxLines}`);
  }

  if (app !== CoreApp.Explore) {
    if (query.isApplyExtraFiltersToRootQuery) {
      items.push('Ad-hoc filters: root query');
    } else {
      items.push('Ad-hoc filters: extra_filters');
    }
  }

  return items;
}

import React, { useMemo } from 'react';

import { CoreApp, isValidGrafanaDuration, SelectableValue } from '@grafana/data';
import { AutoSizeInput, RadioButtonGroup, TextLink } from '@grafana/ui';

import { Query, QueryType } from "../../types";

import EditorField from "./EditorField";
import { EditorRow } from "./EditorRow";
import QueryEditorOptionsGroup from "./QueryEditorOptionsGroup";

export interface Props {
  query: Query;
  onChange: (update: Query) => void;
  onRunQuery: () => void;
  maxLines: number;
  app?: CoreApp;
}

export const queryTypeOptions: Array<SelectableValue<QueryType>> = [
  {
    value: QueryType.Hits,
    label: 'Hits',
    filter: ({ app }: Props) => app !== CoreApp.UnifiedAlerting && app !== CoreApp.CloudAlerting,
    description: "Use `/select/logsql/hits` for querying logs.",
  },
  {
    value: QueryType.Instant,
    label: 'Raw Logs',
    filter: ({ app }: Props) => app !== CoreApp.UnifiedAlerting && app !== CoreApp.CloudAlerting,
    description: "Use `/select/logsql/query` for querying logs.",
  },
  {
    value: QueryType.StatsRange,
    label: 'Range',
    description: "Use `/select/logsql/stats_query_range` for querying log stats over the given time range."
  },
  {
    value: QueryType.Stats,
    label: 'Instant',
    description: "Use `/select/logsql/stats_query` for querying log stats at the given time."
  },
];

export const QueryEditorOptions = React.memo<Props>(({ app, query, maxLines, onChange, onRunQuery }) => {
    const filteredOptions = queryTypeOptions.filter(option => option.filter?.({ app }) ?? true);
    const queryType = query.queryType;

    const isValidStep = useMemo(() => {
      return !query.step || isValidGrafanaDuration(query.step) || !isNaN(+query.step);
    }, [query.step]);

    const collapsedInfo = getCollapsedInfo({
      query,
      queryType,
      maxLines,
      isValidStep,
    });

    const onQueryTypeChange = (value: QueryType) => {
      onChange({ ...query, queryType: value });
      onRunQuery();
    };

    const onLegendFormatChanged = (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...query, legendFormat: e.currentTarget.value });
      onRunQuery();
    };

    const onMaxLinesChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
      const maxLines = parseInt(e.currentTarget.value, 10);
      const newMaxLines = isNaN(maxLines) || maxLines < 0 ? undefined : maxLines;

      if (query.maxLines !== newMaxLines) {
        onChange({ ...query, maxLines: newMaxLines });
        onRunQuery();
      }
    }

    const onStepChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
      onChange({ ...query, step: e.currentTarget.value.trim() });
      onRunQuery();
    }

    return (
      <EditorRow>
        <QueryEditorOptionsGroup
          title="Options"
          collapsedInfo={collapsedInfo}
        >
          <EditorField
            label="Legend"
            tooltip="Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname."
          >
            <AutoSizeInput
              placeholder="{{label}}"
              type="string"
              minWidth={14}
              defaultValue={query.legendFormat}
              onCommitChange={onLegendFormatChanged}
            />
          </EditorField>
          <div>
            <EditorField label="Type">
              <RadioButtonGroup options={filteredOptions} value={queryType} onChange={onQueryTypeChange}/>
            </EditorField>
            <TextLink
              href="https://docs.victoriametrics.com/victorialogs/querying/"
              icon="external-link-alt"
              variant={"bodySmall"}
              external
            >
              Learn more about querying logs
            </TextLink>
          </div>
          {queryType === QueryType.Instant && (
            <EditorField label="Line limit" tooltip="Upper limit for number of log lines returned by query.">
              <AutoSizeInput
                className="width-4"
                placeholder={maxLines.toString()}
                type="number"
                min={0}
                defaultValue={query.maxLines?.toString() ?? ''}
                onCommitChange={onMaxLinesChange}
              />
            </EditorField>
          )}
          {queryType === QueryType.StatsRange && (
            <EditorField
              label="Step"
              tooltip="Use the `step` parameter when making metric queries. If not specified, Grafana will use a calculated interval. Example values: 1s, 5m, 10h, 1d."
              invalid={!isValidStep}
              error={'Invalid step. Example valid values: 1s, 5m, 10h, 1d.'}
            >
              <AutoSizeInput
                className="width-6"
                placeholder={'auto'}
                type="string"
                defaultValue={query.step ?? ''}
                onCommitChange={onStepChange}
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
  query: Query;
  maxLines: number,
  isValidStep: boolean,
  queryType?: string;
}

function getCollapsedInfo({ query, queryType, maxLines, isValidStep }: CollapsedInfoProps): string[] {
  const items: string[] = [];

  const queryTypeLabel = queryTypeOptions.find(option => option.value === queryType)?.label || "unknown";
  items.push(`Type: ${queryTypeLabel}`);

  query.legendFormat && items.push(`Legend: ${query.legendFormat}`);

  if (queryType === QueryType.StatsRange && query.step) {
    items.push(`Step: ${isValidStep ? query.step : 'Invalid value'}`);
  }

  if (queryType === QueryType.Instant && maxLines) {
    items.push(`Line limit: ${query.maxLines ?? maxLines}`);
  }

  return items;
}

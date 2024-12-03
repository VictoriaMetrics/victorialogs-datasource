import React from 'react';

import { CoreApp, SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

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
    value: QueryType.Instant,
    label: 'Raw',
    filter: ({ app }: Props) => app !== CoreApp.UnifiedAlerting && app !== CoreApp.CloudAlerting,
  },
  {
    value: QueryType.StatsRange,
    label: 'Range',
  },
  {
    value: QueryType.Stats,
    label: 'Instant',
  },
];

export const QueryEditorOptions = React.memo<Props>(({ app, query, onChange, onRunQuery }) => {
    const filteredOptions = queryTypeOptions.filter(option => option.filter?.({ app }) ?? true);
    const queryType = query.queryType;

    const collapsedInfo = getCollapsedInfo({
      queryType: query.queryType
    });

    const onQueryTypeChange = (value: QueryType) => {
      onChange({ ...query, queryType: value });
      onRunQuery();
    };

    return (
      <EditorRow>
        <QueryEditorOptionsGroup
          title="Options"
          collapsedInfo={collapsedInfo}
        >
          <EditorField label="Type">
            <RadioButtonGroup options={filteredOptions} value={queryType} onChange={onQueryTypeChange}/>
          </EditorField>
        </QueryEditorOptionsGroup>
      </EditorRow>
    );
  }
);

QueryEditorOptions.displayName = 'QueryEditorOptions';

interface CollapsedInfoProps {
  queryType?: string;
}

function getCollapsedInfo({ queryType }: CollapsedInfoProps): string[] {
  const items: string[] = [];

  const queryTypeLabel = queryTypeOptions.find(option => option.value === queryType)?.label || "Unknown";

  items.push(`Type: ${queryTypeLabel}`);
  return items;
}

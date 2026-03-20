import React, { memo } from 'react';

import { TimeRange } from '@grafana/data';
import { AutoSizeInput } from '@grafana/ui';


import { VictoriaLogsDatasource } from '../../../../../../datasource';

export interface ValueComponentProps {
  values: string[];
  onChange: (values: string[]) => void;
  fieldName: string;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
}

const TextValueInput = memo<ValueComponentProps>(({ values, onChange }) => {
  const handleCommit = (e: React.FormEvent<HTMLInputElement>) => {
    onChange([e.currentTarget.value]);
  };

  return (
    <AutoSizeInput placeholder='Value' defaultValue={values[0] ?? ''} minWidth={12} onCommitChange={handleCommit} />
  );
});

export default TextValueInput;

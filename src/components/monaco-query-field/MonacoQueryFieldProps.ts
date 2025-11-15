import { HistoryItem, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../datasource';
import { Query } from '../../types';

export type Props = {
  initialValue: string;
  history: Array<HistoryItem<Query>>;
  placeholder: string;
  readOnly?: boolean;
  timeRange?: TimeRange;
  datasource: VictoriaLogsDatasource;
  onRunQuery: (value: string) => void;
  onBlur: (value: string) => void;
};

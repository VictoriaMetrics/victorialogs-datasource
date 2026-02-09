import { HistoryItem } from '@grafana/data';

import { Query } from '../../types';

export type Props = {
  initialValue: string;
  history: Array<HistoryItem<Query>>;
  placeholder: string;
  readOnly?: boolean;
  onRunQuery: (value: string) => void;
  onBlur: (value: string) => void;
};

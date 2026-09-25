import { css } from '@emotion/css';
import React from 'react';

import { Text } from '@grafana/ui';

interface NoDataPlaceholderProps {
  /** Match the height of the panel this replaces */
  height: number;
}

const container = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/** Replaces a panel that loaded no data, so an empty refetch does not collapse the layout */
export const NoDataPlaceholder: React.FC<NoDataPlaceholderProps> = ({ height }) => (
  <div className={container} style={{ height }}>
    <Text color='secondary'>No data</Text>
  </div>
);

import { css } from '@emotion/css';
import React from 'react';

import { Text } from '@grafana/ui';

interface NoDataPlaceholderProps {
  /** Fixed height matching the panel it replaces, so the layout doesn't jump when a refetch comes back empty */
  height: number;
}

const container = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/** Fixed-height placeholder shown instead of an empty-but-loaded panel, so an empty refetch doesn't collapse the surrounding layout */
export const NoDataPlaceholder: React.FC<NoDataPlaceholderProps> = ({ height }) => (
  <div className={container} style={{ height }}>
    <Text color='secondary'>No data</Text>
  </div>
);

import React, { memo } from 'react';

import PackJsonEditor from '../../shared/PackJsonEditor';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const PackEditor = memo(function PackEditor({ row, onChange, datasource, timeRange }: ModifyRowContentProps) {
  return <PackJsonEditor row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} />;
});

export default PackEditor;

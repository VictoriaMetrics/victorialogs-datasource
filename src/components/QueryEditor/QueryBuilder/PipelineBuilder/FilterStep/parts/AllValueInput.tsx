import React, { memo } from 'react';

import { Input } from '@grafana/ui';

import { FilterRowContentProps } from './StandardFilterContent';

const AllValueInput = memo<FilterRowContentProps>(function AllValueInput() {
  return <Input value='*' disabled width={4} />;
});

export default AllValueInput;

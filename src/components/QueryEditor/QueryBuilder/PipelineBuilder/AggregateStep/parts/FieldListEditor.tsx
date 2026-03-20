import React, { memo } from 'react';

import SharedFieldListEditor from '../../shared/FieldListEditor';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const FieldListEditor = memo(function FieldListEditor(props: AggregateRowContentProps) {
  return <SharedFieldListEditor {...props} showIfFilter />;
});

export default FieldListEditor;

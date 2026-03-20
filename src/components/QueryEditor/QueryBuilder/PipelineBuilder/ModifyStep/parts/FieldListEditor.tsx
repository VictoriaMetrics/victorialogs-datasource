import React, { memo } from 'react';

import SharedFieldListEditor from '../../shared/FieldListEditor';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const FieldListEditor = memo(function FieldListEditor(props: ModifyRowContentProps) {
  return <SharedFieldListEditor {...props} />;
});

export default FieldListEditor;

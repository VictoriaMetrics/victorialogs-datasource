import React, { Suspense } from 'react';

import Field from './MonacoQueryField'
import { Props } from './MonacoQueryFieldProps';

export const MonacoQueryFieldLazy = (props: Props) => {
  return (
    <Suspense fallback={null}>
      <Field {...props} />
    </Suspense>
  );
};

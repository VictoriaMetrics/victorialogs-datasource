import { createStepContent } from '../shared/createStepContent';
import { ModifyStep, PipelineStepItem } from '../types';

import ModifyRowContainer from './ModifyRowContainer';
import { ModifyRow } from './types';

export default createStepContent<ModifyRow>(
  {
    getRows: (step: PipelineStepItem) => (step as ModifyStep).rows ?? [],
    RowContainer: ModifyRowContainer,
  },
  'ModifyStepContent'
);

import { createStepContent } from '../shared/createStepContent';
import { LimitStep, PipelineStepItem } from '../types';

import LimitRowContainer from './LimitRowContainer';
import { LimitRow } from './types';

export default createStepContent<LimitRow>(
  {
    getRows: (step: PipelineStepItem) => (step as LimitStep).rows ?? [],
    RowContainer: LimitRowContainer,
  },
  'LimitStepContent'
);

import { createStepContent } from '../shared/createStepContent';
import { AggregateModifyStep as AggregateModifyStepType, PipelineStepItem } from '../types';

import AggregateModifyRowContainer from './AggregateModifyRowContainer';
import { AggregateModifyRow } from './types';

export default createStepContent<AggregateModifyRow>(
  {
    getRows: (step: PipelineStepItem) => (step as AggregateModifyStepType).rows ?? [],
    RowContainer: AggregateModifyRowContainer,
  },
  'AggregateModifyStepContent'
);

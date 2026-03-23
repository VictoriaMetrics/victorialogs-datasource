import { createStepContent } from '../shared/createStepContent';
import { FilterStep, PipelineStepItem } from '../types';

import FilterRowContainer from './FilterRowContainer';
import { FilterRow } from './types';

export default createStepContent<FilterRow>(
  {
    getRows: (step: PipelineStepItem) => (step as FilterStep).rows ?? [],
    RowContainer: FilterRowContainer,
  },
  'FilterStepContent'
);

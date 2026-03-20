import React from 'react';

import { Menu } from '@grafana/ui';

import { createStepContent } from '../shared/createStepContent';
import { FilterStep, PipelineStepItem } from '../types';

import FilterRowContainer from './FilterRowContainer';
import FILTER_TYPE_CONFIG, { FILTER_TYPE_FLAT_ENTRIES } from './filterTypeConfig';
import { createFilterRow, FILTER_TYPE, FilterRow, FilterType } from './types';

const addFilter = (handleAddRow: (row: FilterRow) => void, filterType: FilterType) => {
  const config = FILTER_TYPE_CONFIG[filterType];
  handleAddRow(createFilterRow(filterType, config.defaultOperator));
};

export default createStepContent<FilterRow>(
  {
    getRows: (step: PipelineStepItem) => (step as FilterStep).rows ?? [],
    RowContainer: FilterRowContainer,
    addButtonLabel: 'Add filter',
    renderMenu: (handleAddRow) => (
      <Menu>
        {FILTER_TYPE_FLAT_ENTRIES.map(({ filterType, label, description }) => (
          <Menu.Item
            key={filterType}
            label={label}
            description={description}
            onClick={() => addFilter(handleAddRow, filterType)}
          />
        ))}
        <Menu.Divider />
        <Menu.Item label='Custom' onClick={() => addFilter(handleAddRow, FILTER_TYPE.CustomPipe)} />
      </Menu>
    ),
  },
  'FilterStepContent'
);

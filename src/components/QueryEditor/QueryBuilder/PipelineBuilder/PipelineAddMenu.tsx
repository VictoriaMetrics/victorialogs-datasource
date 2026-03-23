import React, { memo, ReactElement, useCallback } from 'react';

import { Button, Dropdown, Menu } from '@grafana/ui';

import AGGREGATE_MODIFY_TYPE_CONFIG, { AGGREGATE_MODIFY_TYPE_ENTRIES } from './AggregateModifyStep/aggregateModifyTypeConfig';
import { AggregateModifyType, createAggregateModifyRow } from './AggregateModifyStep/types';
import AGGREGATE_TYPE_CONFIG, { AGGREGATE_TYPE_FLAT_ENTRIES } from './AggregateStep/aggregateTypeConfig';
import { AGGREGATE_TYPE, AggregateType, createAggregateRow } from './AggregateStep/types';
import FILTER_TYPE_CONFIG, { FILTER_TYPE_FLAT_ENTRIES } from './FilterStep/filterTypeConfig';
import { createFilterRow, FILTER_TYPE, FilterType } from './FilterStep/types';
import LIMIT_TYPE_CONFIG, { LIMIT_TYPE_GROUPED_ENTRIES } from './LimitStep/limitTypeConfig';
import { createLimitRow, LIMIT_TYPE, LimitType } from './LimitStep/types';
import MODIFY_TYPE_CONFIG, { MODIFY_TYPE_GROUPED_ENTRIES } from './ModifyStep/modifyTypeConfig';
import { createModifyRow, MODIFY_TYPE, ModifyType } from './ModifyStep/types';
import { STEP_CONFIG } from './stepConfig';
import { PIPELINE_STEP_TYPE, PipelineStepPatch, PipelineStepType } from './types';

interface Props {
  allowedTypes: PipelineStepType[];
  onAddStep: (type: PipelineStepType, initialPatch?: PipelineStepPatch) => void;
}

type OnAdd = (patch: PipelineStepPatch) => void;

const buildFilterItems = (onAdd: OnAdd): ReactElement[] => [
  ...FILTER_TYPE_FLAT_ENTRIES.map(({ filterType, label, description }) => (
    <Menu.Item
      key={filterType}
      label={label}
      description={description}
      onClick={() => onAdd({ rows: [createFilterRow(filterType as FilterType, FILTER_TYPE_CONFIG[filterType as FilterType].defaultOperator)] })}
    />
  )),
  <Menu.Divider key='divider' />,
  <Menu.Item
    key='custom'
    label='Custom'
    onClick={() => onAdd({ rows: [createFilterRow(FILTER_TYPE.CustomPipe, FILTER_TYPE_CONFIG[FILTER_TYPE.CustomPipe].defaultOperator)] })}
  />,
];

const buildModifyItems = (onAdd: OnAdd): ReactElement[] => {
  const items: ReactElement[] = [];
  MODIFY_TYPE_GROUPED_ENTRIES.forEach(({ group, entries }, groupIndex) => {
    if (groupIndex > 0) {
      items.push(<Menu.Divider key={`divider-${group}`} />);
    }
    entries.forEach(({ modifyType, label, description }) => {
      items.push(
        <Menu.Item
          key={modifyType}
          label={label}
          description={description}
          onClick={() => onAdd({ rows: [createModifyRow(modifyType as ModifyType, MODIFY_TYPE_CONFIG[modifyType as ModifyType].createInitialRow())] })}
        />
      );
    });
  });
  items.push(<Menu.Divider key='divider-custom' />);
  items.push(
    <Menu.Item
      key='custom'
      label='Custom'
      onClick={() => onAdd({ rows: [createModifyRow(MODIFY_TYPE.CustomPipe, MODIFY_TYPE_CONFIG[MODIFY_TYPE.CustomPipe].createInitialRow())] })}
    />
  );
  return items;
};

const buildAggregateItems = (onAdd: OnAdd): ReactElement[] => [
  ...AGGREGATE_TYPE_FLAT_ENTRIES.map(({ aggregateType, label, description }) => (
    <Menu.Item
      key={aggregateType}
      label={label}
      description={description}
      onClick={() => onAdd({ rows: [createAggregateRow(aggregateType as AggregateType, AGGREGATE_TYPE_CONFIG[aggregateType as AggregateType].createInitialRow())] })}
    />
  )),
  <Menu.Divider key='divider' />,
  <Menu.Item
    key='custom'
    label='Custom'
    onClick={() => onAdd({ rows: [createAggregateRow(AGGREGATE_TYPE.CustomPipe, AGGREGATE_TYPE_CONFIG[AGGREGATE_TYPE.CustomPipe].createInitialRow())] })}
  />,
];

const buildAggregateModifyItems = (onAdd: OnAdd): ReactElement[] =>
  AGGREGATE_MODIFY_TYPE_ENTRIES.map(({ aggregateModifyType, label, description }) => (
    <Menu.Item
      key={aggregateModifyType}
      label={label}
      description={description}
      onClick={() => onAdd({ rows: [createAggregateModifyRow(aggregateModifyType as AggregateModifyType, AGGREGATE_MODIFY_TYPE_CONFIG[aggregateModifyType as AggregateModifyType].createInitialRow())] })}
    />
  ));

const buildLimitItems = (onAdd: OnAdd): ReactElement[] => {
  const items: ReactElement[] = [];
  LIMIT_TYPE_GROUPED_ENTRIES.forEach(({ group, entries }, groupIndex) => {
    if (groupIndex > 0) {
      items.push(<Menu.Divider key={`divider-${group}`} />);
    }
    entries.forEach(({ limitType, label, description }) => {
      items.push(
        <Menu.Item
          key={limitType}
          label={label}
          description={description}
          onClick={() => onAdd({ rows: [createLimitRow(limitType as LimitType, LIMIT_TYPE_CONFIG[limitType as LimitType].createInitialRow())] })}
        />
      );
    });
  });
  items.push(<Menu.Divider key='divider-custom' />);
  items.push(
    <Menu.Item
      key='custom'
      label='Custom'
      onClick={() => onAdd({ rows: [createLimitRow(LIMIT_TYPE.CustomPipe, LIMIT_TYPE_CONFIG[LIMIT_TYPE.CustomPipe].createInitialRow())] })}
    />
  );
  return items;
};

const FILTER_TYPES = new Set<PipelineStepType>([
  PIPELINE_STEP_TYPE.Filter,
  PIPELINE_STEP_TYPE.ModifyFilter,
  PIPELINE_STEP_TYPE.AggregateFilter,
  PIPELINE_STEP_TYPE.AggregateModifyFilter,
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getChildItems = (type: PipelineStepType, onAdd: OnAdd): Array<React.ReactElement<any>> | undefined => {
  if (FILTER_TYPES.has(type)) {
    return buildFilterItems(onAdd);
  }
  switch (type) {
    case PIPELINE_STEP_TYPE.Modify:
      return buildModifyItems(onAdd);
    case PIPELINE_STEP_TYPE.Aggregate:
      return buildAggregateItems(onAdd);
    case PIPELINE_STEP_TYPE.AggregateModify:
      return buildAggregateModifyItems(onAdd);
    case PIPELINE_STEP_TYPE.Limit:
      return buildLimitItems(onAdd);
    default:
      return undefined;
  }
};

const PipelineAddMenu = memo<Props>(({ allowedTypes, onAddStep }) => {
  const handleAdd = useCallback(
    (type: PipelineStepType, patch?: PipelineStepPatch) => onAddStep(type, patch),
    [onAddStep]
  );

  const menu = (
    <Menu>
      {allowedTypes.map((type) => {
        const config = STEP_CONFIG[type];
        const childItems = getChildItems(type, (patch) => handleAdd(type, patch));

        if (childItems) {
          return <Menu.Item key={type} label={config.label} childItems={childItems} />;
        }

        return <Menu.Item key={type} label={config.label} onClick={() => handleAdd(type)} />;
      })}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement='bottom-start'>
      <Button variant='secondary' icon='plus' size='sm'>
        Add pipe
      </Button>
    </Dropdown>
  );
});

PipelineAddMenu.displayName = 'PipelineAddMenu';

export default PipelineAddMenu;

export const buildPipelineMenu = (
  allowedTypes: PipelineStepType[],
  onAddStep: (type: PipelineStepType, initialPatch?: PipelineStepPatch) => void
): ReactElement => (
  <Menu>
    {allowedTypes.map((type) => {
      const config = STEP_CONFIG[type];
      const childItems = getChildItems(type, (patch) => onAddStep(type, patch));

      if (childItems) {
        return <Menu.Item key={type} label={config.label} childItems={childItems} />;
      }

      return <Menu.Item key={type} label={config.label} onClick={() => onAddStep(type)} />;
    })}
  </Menu>
);

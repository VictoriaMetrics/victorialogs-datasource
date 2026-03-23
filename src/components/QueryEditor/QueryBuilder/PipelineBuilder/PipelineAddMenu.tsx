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
  prevStepType?: PipelineStepType;
}

type OnAdd = (patch: PipelineStepPatch) => void;

const CUSTOM_PATCH_CREATORS: Partial<Record<PipelineStepType, () => PipelineStepPatch>> = {
  [PIPELINE_STEP_TYPE.Filter]: () => ({ rows: [createFilterRow(FILTER_TYPE.CustomPipe, FILTER_TYPE_CONFIG[FILTER_TYPE.CustomPipe].defaultOperator)] }),
  [PIPELINE_STEP_TYPE.ModifyFilter]: () => ({ rows: [createFilterRow(FILTER_TYPE.CustomPipe, FILTER_TYPE_CONFIG[FILTER_TYPE.CustomPipe].defaultOperator)] }),
  [PIPELINE_STEP_TYPE.AggregateFilter]: () => ({ rows: [createFilterRow(FILTER_TYPE.CustomPipe, FILTER_TYPE_CONFIG[FILTER_TYPE.CustomPipe].defaultOperator)] }),
  [PIPELINE_STEP_TYPE.AggregateModifyFilter]: () => ({ rows: [createFilterRow(FILTER_TYPE.CustomPipe, FILTER_TYPE_CONFIG[FILTER_TYPE.CustomPipe].defaultOperator)] }),
  [PIPELINE_STEP_TYPE.Modify]: () => ({ rows: [createModifyRow(MODIFY_TYPE.CustomPipe, MODIFY_TYPE_CONFIG[MODIFY_TYPE.CustomPipe].createInitialRow())] }),
  [PIPELINE_STEP_TYPE.Aggregate]: () => ({ rows: [createAggregateRow(AGGREGATE_TYPE.CustomPipe, AGGREGATE_TYPE_CONFIG[AGGREGATE_TYPE.CustomPipe].createInitialRow())] }),
  [PIPELINE_STEP_TYPE.Limit]: () => ({ rows: [createLimitRow(LIMIT_TYPE.CustomPipe, LIMIT_TYPE_CONFIG[LIMIT_TYPE.CustomPipe].createInitialRow())] }),
};

const resolveCustom = (
  prevStepType: PipelineStepType | undefined,
  allowedTypes: PipelineStepType[]
): { stepType: PipelineStepType; createPatch: () => PipelineStepPatch } | null => {
  const preferred = prevStepType ?? PIPELINE_STEP_TYPE.Filter;
  if (allowedTypes.includes(preferred) && CUSTOM_PATCH_CREATORS[preferred]) {
    return { stepType: preferred, createPatch: CUSTOM_PATCH_CREATORS[preferred] };
  }
  const fallback = allowedTypes.find((t) => CUSTOM_PATCH_CREATORS[t]);
  if (fallback) {
    return { stepType: fallback, createPatch: CUSTOM_PATCH_CREATORS[fallback]! };
  }
  return null;
};

const buildFilterItems = (onAdd: OnAdd): ReactElement[] =>
  FILTER_TYPE_FLAT_ENTRIES.map(({ filterType, label, description }) => (
    <Menu.Item
      key={filterType}
      label={label}
      description={description}
      onClick={() => onAdd({ rows: [createFilterRow(filterType as FilterType, FILTER_TYPE_CONFIG[filterType as FilterType].defaultOperator)] })}
    />
  ));

const buildModifyItems = (onAdd: OnAdd): ReactElement[] =>
  MODIFY_TYPE_GROUPED_ENTRIES
    .filter(({ entries }) => entries.length > 0)
    .map(({ group, entries }) => (
      <Menu.Item
        key={group}
        label={group}
        childItems={entries.map(({ modifyType, label, description }) => (
          <Menu.Item
            key={modifyType}
            label={label}
            description={description}
            onClick={() => onAdd({ rows: [createModifyRow(modifyType as ModifyType, MODIFY_TYPE_CONFIG[modifyType as ModifyType].createInitialRow())] })}
          />
        ))}
      />
    ));

const buildAggregateItems = (onAdd: OnAdd): ReactElement[] =>
  AGGREGATE_TYPE_FLAT_ENTRIES.map(({ aggregateType, label, description }) => (
    <Menu.Item
      key={aggregateType}
      label={label}
      description={description}
      onClick={() => onAdd({ rows: [createAggregateRow(aggregateType as AggregateType, AGGREGATE_TYPE_CONFIG[aggregateType as AggregateType].createInitialRow())] })}
    />
  ));

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

const PipelineAddMenu = memo<Props>(({ allowedTypes, onAddStep, prevStepType }) => {
  const handleAdd = useCallback(
    (type: PipelineStepType, patch?: PipelineStepPatch) => onAddStep(type, patch),
    [onAddStep]
  );

  const menu = buildPipelineMenu(allowedTypes, handleAdd, prevStepType);

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
  onAddStep: (type: PipelineStepType, initialPatch?: PipelineStepPatch) => void,
  prevStepType?: PipelineStepType
): ReactElement => {
  const custom = resolveCustom(prevStepType, allowedTypes);

  return (
    <Menu>
      {allowedTypes.map((type) => {
        const config = STEP_CONFIG[type];
        const childItems = getChildItems(type, (patch) => onAddStep(type, patch));

        if (childItems) {
          return <Menu.Item key={type} label={config.label} childItems={childItems} />;
        }

        return <Menu.Item key={type} label={config.label} onClick={() => onAddStep(type)} />;
      })}
      {custom && (
        <>
          <Menu.Divider key='divider-custom' />
          <Menu.Item
            key='custom'
            label='Custom'
            onClick={() => onAddStep(custom.stepType, custom.createPatch())}
          />
        </>
      )}
    </Menu>
  );
};

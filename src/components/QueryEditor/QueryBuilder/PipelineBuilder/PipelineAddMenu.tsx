import React, { memo, ReactElement, useCallback } from 'react';

import { Button, Dropdown, Menu } from '@grafana/ui';

import { AGGREGATE_MODIFY_TYPE_ENTRIES } from './AggregateModifyStep/aggregateModifyTypeConfig';
import { AGGREGATE_TYPE_FLAT_ENTRIES } from './AggregateStep/aggregateTypeConfig';
import { AGGREGATE_TYPE, createAggregateRow } from './AggregateStep/types';
import { FILTER_TYPE_FLAT_ENTRIES } from './FilterStep/filterTypeConfig';
import { FILTER_TYPE, createFilterRow } from './FilterStep/types';
import { LIMIT_TYPE_GROUPED_ENTRIES } from './LimitStep/limitTypeConfig';
import { LIMIT_TYPE, createLimitRow } from './LimitStep/types';
import { MODIFY_TYPE_GROUPED_ENTRIES } from './ModifyStep/modifyTypeConfig';
import { MODIFY_TYPE, createModifyRow } from './ModifyStep/types';
import { STEP_CONFIG } from './stepConfig';
import { PIPELINE_STEP_TYPE, PipelineStepPatch, PipelineStepType } from './types';

interface Props {
  allowedTypes: PipelineStepType[];
  onAddStep: (type: PipelineStepType, initialPatch?: PipelineStepPatch) => void;
  prevStepType?: PipelineStepType;
}

type OnAdd = (patch: PipelineStepPatch) => void;

const createFilterCustomPatch = (): PipelineStepPatch => ({
  rows: [createFilterRow(FILTER_TYPE.CustomPipe)],
});

const CUSTOM_PATCH_CREATORS: Partial<Record<PipelineStepType, () => PipelineStepPatch>> = {
  [PIPELINE_STEP_TYPE.Filter]:                createFilterCustomPatch,
  [PIPELINE_STEP_TYPE.ModifyFilter]:          createFilterCustomPatch,
  [PIPELINE_STEP_TYPE.AggregateFilter]:       createFilterCustomPatch,
  [PIPELINE_STEP_TYPE.AggregateModifyFilter]: createFilterCustomPatch,
  [PIPELINE_STEP_TYPE.Modify]:        () => ({ rows: [createModifyRow(MODIFY_TYPE.CustomPipe)] }),
  [PIPELINE_STEP_TYPE.Aggregate]:     () => ({ rows: [createAggregateRow(AGGREGATE_TYPE.CustomPipe)] }),
  [PIPELINE_STEP_TYPE.Limit]:         () => ({ rows: [createLimitRow(LIMIT_TYPE.CustomPipe)] }),
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
  FILTER_TYPE_FLAT_ENTRIES.map(({ filterType, label, description, createPatch }) => (
    <Menu.Item key={filterType} label={label} description={description} onClick={() => onAdd(createPatch())} />
  ));

const buildModifyItems = (onAdd: OnAdd): ReactElement[] =>
  MODIFY_TYPE_GROUPED_ENTRIES
    .filter(({ entries }) => entries.length > 0)
    .map(({ group, entries }) => (
      <Menu.Item
        key={group}
        label={group}
        childItems={entries.map(({ modifyType, label, description, createPatch }) => (
          <Menu.Item key={modifyType} label={label} description={description} onClick={() => onAdd(createPatch())} />
        ))}
      />
    ));

const buildAggregateItems = (onAdd: OnAdd): ReactElement[] =>
  AGGREGATE_TYPE_FLAT_ENTRIES.map(({ aggregateType, label, description, createPatch }) => (
    <Menu.Item key={aggregateType} label={label} description={description} onClick={() => onAdd(createPatch())} />
  ));

const buildAggregateModifyItems = (onAdd: OnAdd): ReactElement[] =>
  AGGREGATE_MODIFY_TYPE_ENTRIES.map(({ aggregateModifyType, label, description, createPatch }) => (
    <Menu.Item key={aggregateModifyType} label={label} description={description} onClick={() => onAdd(createPatch())} />
  ));

const buildLimitItems = (onAdd: OnAdd): ReactElement[] => {
  const items: ReactElement[] = [];
  LIMIT_TYPE_GROUPED_ENTRIES.forEach(({ group, entries }, groupIndex) => {
    if (groupIndex > 0) {
      items.push(<Menu.Divider key={`divider-${group}`} />);
    }
    entries.forEach(({ limitType, label, description, createPatch }) => {
      items.push(
        <Menu.Item key={limitType} label={label} description={description} onClick={() => onAdd(createPatch())} />
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

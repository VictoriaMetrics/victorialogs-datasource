import React, { memo, ReactElement, useCallback } from 'react';

import { Button, Dropdown, Menu } from '@grafana/ui';

import { STEP_CONFIG, StepMenuConfig } from './stepConfig';
import { PipelineStepPatch, PipelineStepType } from './types';

interface Props {
  allowedTypes: PipelineStepType[];
  onAddStep: (type: PipelineStepType, initialPatch?: PipelineStepPatch) => void;
}

type OnAdd = (patch: PipelineStepPatch) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildMenuItems = (menuConfig: StepMenuConfig, onAdd: OnAdd): Array<React.ReactElement<any>> => {
  switch (menuConfig.variant) {
    case 'flat':
      return menuConfig.entries.map(({ key, label, description, createPatch }) => (
        <Menu.Item key={key} label={label} description={description} onClick={() => onAdd(createPatch())} />
      ));
    case 'grouped-nested':
      return menuConfig.groups
        .filter(({ entries }) => entries.length > 0)
        .map(({ group, entries }) => (
          <Menu.Item
            key={group}
            label={group}
            childItems={entries.map(({ key, label, description, createPatch }) => (
              <Menu.Item key={key} label={label} description={description} onClick={() => onAdd(createPatch())} />
            ))}
          />
        ));
    case 'grouped-divider': {
      const items: ReactElement[] = [];
      menuConfig.groups.forEach(({ group, entries }, groupIndex) => {
        if (groupIndex > 0) {
          items.push(<Menu.Divider key={`divider-${group}`} />);
        }
        entries.forEach(({ key, label, description, createPatch }) => {
          items.push(
            <Menu.Item key={key} label={label} description={description} onClick={() => onAdd(createPatch())} />
          );
        });
      });
      return items;
    }
  }
};

const PipelineAddMenu = memo<Props>(({ allowedTypes, onAddStep }) => {
  const handleAdd = useCallback(
    (type: PipelineStepType, patch?: PipelineStepPatch) => onAddStep(type, patch),
    [onAddStep]
  );

  const menu = buildPipelineMenu(allowedTypes, handleAdd);

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
): ReactElement => {
  return (
    <Menu>
      {allowedTypes.map((type) => {
        const config = STEP_CONFIG[type];
        const childItems = config.menuConfig
          ? buildMenuItems(config.menuConfig, (patch) => onAddStep(type, patch))
          : undefined;

        if (childItems) {
          return <Menu.Item key={type} label={config.label} childItems={childItems} />;
        }

        return <Menu.Item key={type} label={config.label} onClick={() => onAddStep(type)} />;
      })}
    </Menu>
  );
};

import React, { memo, ReactElement } from 'react';

import { Button, Dropdown, Menu } from '@grafana/ui';

import { getMenuGroups } from './templates/registry';

interface Props {
  allowedCategories?: string[];
  onAdd: (templateType: string) => void;
}

export const AddPipeButton = memo<Props>(({ allowedCategories, onAdd }) => {
  const groups = getMenuGroups(allowedCategories);

  const menu: ReactElement = (
    <Menu style={{ maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group.label}>
          {groupIndex > 0 && <Menu.Divider />}
          <Menu.Group label={group.label}>
            {group.items.map((item) => (
              <Menu.Item
                key={item.type}
                label={item.label}
                description={item.description}
                onClick={() => onAdd(item.type)}
              />
            ))}
          </Menu.Group>
        </React.Fragment>
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement='bottom-start'>
      <Button variant='secondary' icon='plus' size='md' aria-label='Add pipe' />
    </Dropdown>
  );
});

AddPipeButton.displayName = 'AddPipeButton';

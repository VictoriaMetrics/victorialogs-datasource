import React, { memo } from 'react';

import { Dropdown, IconButton, Menu } from '@grafana/ui';

import { OptionalExtension } from './templates/types';

interface Props {
  extensions: OptionalExtension[];
  activeKeys: Set<string>;
  onAdd: (key: string) => void;
  onVisibleChange?: (visible: boolean) => void;
}

export const OptionalExtensionMenu = memo<Props>(({ extensions, activeKeys, onAdd, onVisibleChange }) => {
  const available = extensions.filter((e) => !activeKeys.has(e.key));
  if (available.length === 0) {
    return null;
  }

  const menu = (
    <Menu>
      {available.map((ext) => (
        <Menu.Item key={ext.key} label={ext.label} onClick={() => onAdd(ext.key)} />
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement='bottom-start' onVisibleChange={onVisibleChange}>
      <IconButton name='ellipsis-h' size='sm' tooltip='Add optional clause' />
    </Dropdown>
  );
});

OptionalExtensionMenu.displayName = 'OptionalExtensionMenu';

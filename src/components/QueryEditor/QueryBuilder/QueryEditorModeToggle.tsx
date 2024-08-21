import React from 'react';

import { RadioButtonGroup } from '@grafana/ui';

import { QueryEditorMode } from "../../../types";

export interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
}

const editorModes = [
  { label: 'Beta Builder', value: QueryEditorMode.Builder },
  { label: 'Code', value: QueryEditorMode.Code },
];

export function QueryEditorModeToggle({ mode, onChange }: Props) {
  return (
    <div>
      <RadioButtonGroup options={editorModes} size="sm" value={mode} onChange={onChange} />
    </div>
  );
}

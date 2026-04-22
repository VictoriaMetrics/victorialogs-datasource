import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Icon, Select, Stack, Text, Tooltip } from '@grafana/ui';

import { OperatorLabels } from '../LogLevelRules/const';

import { SEVERITY_FIELD_CANDIDATES } from './constants';
import { buildLogLevelRulesBySeverity } from './preset-builder';
import { OpenTelemetryPresetSeverity } from './types';

const SeverityFieldTooltip = () => (
  <div>
    <div>Detection priority:</div>
    {SEVERITY_FIELD_CANDIDATES.map((f, i) => (
      <div key={f}>{i + 1}. {f}</div>
    ))}
  </div>
);

const severityFieldOptions = (names: string[]): Array<SelectableValue<string>> =>
  names.map(n => ({ label: n, value: n }));

const RulesTooltipContent = ({ severity }: { severity: OpenTelemetryPresetSeverity }) => {
  const rules = useMemo(() => buildLogLevelRulesBySeverity(severity), [severity]);
  const lines = useMemo(() => {
    return rules.map(rule => `${rule.field} ${OperatorLabels[rule.operator]} ${rule.value} -> ${rule.level}`);
  }, [rules]);
  
  return <div style={{ whiteSpace: 'pre' }}>{lines.join('\n')}</div>;
};

interface SeverityRowProps {
  severity: OpenTelemetryPresetSeverity | undefined;
  isChanging: boolean;
  fieldNames: string[];
  onChoice: (v: SelectableValue<string> | null) => void;
  onStartChanging: () => void;
  onCancelChanging: () => void;
}

export const SeverityRow = ({
  severity,
  isChanging,
  fieldNames,
  onChoice,
  onStartChanging,
  onCancelChanging,
}: SeverityRowProps) => {
  if (!severity) {
    return (
      <Stack direction='row' gap={1} alignItems='center'>
        <Text variant='bodySmall'><strong>Severity field:</strong> not auto-detected</Text>
        <Select
          placeholder='Choose severity field'
          options={severityFieldOptions(fieldNames)}
          onChange={onChoice}
          width={32}
        />
      </Stack>
    );
  }

  if (isChanging) {
    return (
      <Stack direction='row' gap={1} alignItems='center'>
        <Text variant='bodySmall'><strong>Severity field:</strong></Text>
        <Select
          placeholder='Choose severity field'
          options={severityFieldOptions(fieldNames)}
          onChange={onChoice}
          width={32}
        />
        <Button variant='secondary' size='sm' onClick={onCancelChanging}>Cancel</Button>
      </Stack>
    );
  }

  return (
    <Stack direction='row' gap={1} alignItems='center'>
      <Text variant='bodySmall'>
        <strong>Severity field</strong>
        <Tooltip content={<SeverityFieldTooltip />} placement='top'>
          <Icon name='info-circle' size='sm' style={{ marginLeft: 4, marginRight: 4, cursor: 'help' }} />
        </Tooltip>
        : {severity.field},{' '}
        <Tooltip content={<RulesTooltipContent severity={severity} />} placement='top'>
          <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>
            generated log level rules
          </span>
        </Tooltip>
      </Text>
      <Button variant='secondary' size='sm' onClick={onStartChanging}>Change</Button>
    </Stack>
  );
};

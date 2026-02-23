import React from 'react';

import { LogLevel } from '@grafana/data';
import { Button, Stack, InlineSwitch, Input, Select, Text, Tooltip, Badge, useTheme2 } from '@grafana/ui';

import { PropsConfigEditor } from '../ConfigEditor';

import { LOG_LEVEL_COLOR, LOG_LEVEL_OPTIONS, LOG_OPERATOR_OPTIONS } from './const';
import { LogLevelRule, LogLevelRuleType } from './types';

export const LogLevelRulesEditor = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;
  const theme = useTheme2();

  const onChangeHandler = (rules: LogLevelRule[]) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        logLevelRules: rules,
      },
    });
  };

  const rules = options.jsonData.logLevelRules || [];

  const handleRuleChange = (index: number, updatedRule: Partial<LogLevelRule>) => {
    const updatedRules = [...rules];
    updatedRules[index] = { ...updatedRules[index], ...updatedRule };
    onChangeHandler(updatedRules);
  };

  const addRule = () => {
    onChangeHandler([
      ...rules,
      {
        field: '',
        operator: LogLevelRuleType.Equals,
        value: '',
        level: LogLevel.info,
        enabled: true,
      },
    ]);
  };

  const removeRule = (index: number) => {
    const updatedRules = [...rules];
    updatedRules.splice(index, 1);
    onChangeHandler(updatedRules);
  };

  return (
    <Stack direction='column' gap={2}>
      <div>
        <Text variant='h4'>Log Level Rules</Text>
        <Text variant='bodySmall' color='disabled' element='p'>
          Define rules to normalize log levels based on specific field values. Useful for mapping custom log formats to
          structured levels like <code>info</code>, <code>error</code>, <code>critical</code>, etc.
        </Text>
      </div>

      {rules.length > 0 && (
        <Stack direction='column' gap={0}>
          {rules.map(({ enabled = true, field, value, level = LogLevel.unknown, operator }, index) => (
            <Stack direction='row' gap={0} key={index}>
              <div>
                <InlineSwitch
                  label='Enabled'
                  value={enabled}
                  onChange={(e) => handleRuleChange(index, { enabled: e.currentTarget.checked })}
                />
              </div>

              <Input
                placeholder={'Field name'}
                value={field}
                onChange={(e) => handleRuleChange(index, { field: e.currentTarget.value })}
                suffix={
                  field === 'level' && (
                    <Tooltip content={'This rule will be ignored if the log entry already contains a level field.'}>
                      <div>
                        <Badge text={'May be skipped'} color={'orange'} icon='exclamation-triangle' />
                      </div>
                    </Tooltip>
                  )
                }
              />

              <div>
                <Select
                  width={8}
                  options={LOG_OPERATOR_OPTIONS}
                  value={LOG_OPERATOR_OPTIONS.find((opt) => opt.value === operator)}
                  onChange={(v) => handleRuleChange(index, { operator: v?.value })}
                />
              </div>

              <Input
                placeholder='Value'
                value={String(value ?? '')}
                onChange={(e) => handleRuleChange(index, { value: e.currentTarget.value })}
              />

              <div>
                <Select
                  width={14}
                  options={LOG_LEVEL_OPTIONS}
                  value={LOG_LEVEL_OPTIONS.find((opt) => opt.value === level)}
                  onChange={(v) => handleRuleChange(index, { level: v?.value })}
                />
              </div>

              <div className='gf-form-label'>
                {LOG_LEVEL_COLOR[level] && (
                  <div
                    style={{
                      width: theme.spacing(2.5),
                      height: theme.spacing(2.5),
                      backgroundColor: LOG_LEVEL_COLOR[level],
                      borderRadius: '50%',
                      display: 'inline-block',
                      margin: `0 ${theme.spacing(1)}`,
                    }}
                  />
                )}
              </div>

              <Button aria-label='Remove rule' variant={'secondary'} onClick={() => removeRule(index)} icon='times' />
            </Stack>
          ))}
        </Stack>
      )}

      <div>
        <Button icon='plus' onClick={addRule} variant='secondary'>
          Add rule
        </Button>
      </div>
    </Stack>
  );
};

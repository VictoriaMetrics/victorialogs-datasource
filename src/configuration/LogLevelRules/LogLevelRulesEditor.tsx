import React from 'react';

import { LogLevel, } from '@grafana/data';
import { Button, Stack, InlineSwitch, Input, Select, Text } from '@grafana/ui';

import { PropsConfigEditor } from "../ConfigEditor";

import { LOG_LEVEL_COLOR, LOG_LEVEL_OPTIONS, LOG_OPERATOR_OPTIONS } from "./const";
import { LogLevelRule, LogLevelRuleType } from "./types";

export const LogLevelRulesEditor = (props: PropsConfigEditor) => {
  const { options, onOptionsChange } = props;

  const onChangeHandler = (rules: LogLevelRule[]) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        logLevelRules: rules,
      },
    });
  }

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
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Log Level Rules</Text>
        <Text variant="bodySmall" color="disabled" element="p">
          Define rules to normalize log levels based on specific field values.
          Useful for mapping custom log formats to structured levels
          like <code>info</code>, <code>error</code>, <code>critical</code>, etc.
        </Text>
      </div>

      {rules.length > 0 && (
        <Stack direction="column" gap={0}>
          {rules.map((rule, index) => (
            <Stack direction="row" gap={0} key={index}>

              <div>
                <InlineSwitch
                  label="Enabled"
                  value={rule.enabled}
                  onChange={(e) => handleRuleChange(index, { enabled: e.currentTarget.checked })}
                />
              </div>

              <Input
                placeholder={"Field name"}
                value={rule.field}
                onChange={(e) => handleRuleChange(index, { field: e.currentTarget.value })}
              />

              <div>
                <Select
                  width={8}
                  options={LOG_OPERATOR_OPTIONS}
                  value={LOG_OPERATOR_OPTIONS.find(opt => opt.value === rule.operator)}
                  onChange={(v) => handleRuleChange(index, { operator: v?.value! })}
                />
              </div>

              <Input
                placeholder="Value"
                value={String(rule.value ?? '')}
                onChange={(e) => handleRuleChange(index, { value: e.currentTarget.value })}
              />

              <div>
                <Select
                  width={14}
                  options={LOG_LEVEL_OPTIONS}
                  value={LOG_LEVEL_OPTIONS.find(opt => opt.value === rule.level)}
                  onChange={(v) => handleRuleChange(index, { level: v?.value! })}
                />
              </div>

              <div className="gf-form-label">
                {LOG_LEVEL_COLOR[rule.level] && (
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: LOG_LEVEL_COLOR[rule.level],
                      borderRadius: '50%',
                      display: 'inline-block',
                      margin: '0 8px',
                    }}
                  />
                )}
              </div>

              <Button
                variant={"secondary"}
                onClick={() => removeRule(index)}
                icon="times"
              />
            </Stack>
          ))}
        </Stack>
      )}

      <div>
        <Button icon="plus" onClick={addRule} variant="secondary">
          Add rule
        </Button>
      </div>
    </Stack>
  );
};


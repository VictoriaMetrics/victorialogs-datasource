import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, IconButton, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../FilterStep/parts/FieldNameSelect';
import { FieldPair } from '../../types';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const FieldPairEditor = memo(function FieldPairEditor({ row, onChange, datasource, timeRange }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);
  const pairs = row.fieldPairs ?? [{ src: '', dst: '' }];

  const handlePairChange = useCallback(
    (index: number, field: keyof FieldPair, value: string) => {
      const newPairs = pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p));
      onChange({ ...row, fieldPairs: newPairs });
    },
    [pairs, onChange, row]
  );

  const handleAddPair = useCallback(() => {
    onChange({ ...row, fieldPairs: [...pairs, { src: '', dst: '' }] });
  }, [pairs, onChange, row]);

  const handleRemovePair = useCallback(
    (index: number) => {
      if (pairs.length <= 1) {
        return;
      }
      onChange({ ...row, fieldPairs: pairs.filter((_, i) => i !== index) });
    },
    [pairs, onChange, row]
  );

  return (
    <Stack direction='column' gap={0.5}>
      {pairs.map((pair, index) => (
        <Stack key={index} direction='row' gap={0.5} alignItems='center'>
          <FieldNameSelect
            value={pair.src}
            onChange={(v) => handlePairChange(index, 'src', v)}
            datasource={datasource}
            timeRange={timeRange}
          />
          <span className={styles.label}>as</span>
          <AutoSizeInput
            placeholder='new field name'
            defaultValue={pair.dst}
            minWidth={12}
            onCommitChange={(e) => handlePairChange(index, 'dst', e.currentTarget.value)}
          />
          {pairs.length > 1 && (
            <IconButton name='times' size='sm' tooltip='Remove pair' onClick={() => handleRemovePair(index)} />
          )}
        </Stack>
      ))}
      <IconButton name='plus' size='sm' tooltip='Add pair' onClick={handleAddPair} />
    </Stack>
  );
});

export default FieldPairEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});

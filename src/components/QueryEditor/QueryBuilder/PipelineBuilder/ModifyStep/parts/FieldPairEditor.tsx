import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import { ModifyRowContentProps } from '../modifyTypeConfig';
import { FieldPair } from '../types';

const FieldPairEditor = memo(function FieldPairEditor({ row, onChange, datasource, timeRange, queryContext }: ModifyRowContentProps) {
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
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      {pairs.map((pair, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className={styles.separator}>,</span>}
          <FieldNameSelect
            value={pair.src}
            onChange={(v) => handlePairChange(index, 'src', v)}
            datasource={datasource}
            timeRange={timeRange}
            queryContext={queryContext}
          />
          <span className={styles.label}>as</span>
          <div className={pairs.length > 1 ? styles.inputNoRightRadius : undefined}>
            <AutoSizeInput
              placeholder='new field name'
              defaultValue={pair.dst}
              minWidth={12}
              onCommitChange={(e) => handlePairChange(index, 'dst', e.currentTarget.value)}
            />
          </div>
          {pairs.length > 1 && (
            <div className={styles.removeButtonContainer}>
              <IconButton className={styles.removeButton} name='times' size='sm' tooltip='Remove pair' onClick={() => handleRemovePair(index)} />
            </div>
          )}
        </React.Fragment>
      ))}
      <Button variant='secondary' size='sm' icon='plus' onClick={handleAddPair}>Add pair</Button>
    </Stack>
  );
});

export default FieldPairEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  separator: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  inputNoRightRadius: css`
    & * {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  `,
  removeButtonContainer: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    width: 23px;
    border: 1px solid ${theme.colors.border.medium};
    border-left: none;
    border-radius: 0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0;
  `,
  removeButton: css`
    margin: 0;
    width: 100%;
    height: 100%;
    &::before {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  `,
});

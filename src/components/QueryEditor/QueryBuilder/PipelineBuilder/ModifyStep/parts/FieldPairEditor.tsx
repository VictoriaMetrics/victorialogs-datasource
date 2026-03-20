import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import { getSharedStyles } from '../../shared/styles';
import { ModifyRowContentProps } from '../modifyTypeConfig';
import { FieldPair } from '../types';

const FieldPairEditor = memo(function FieldPairEditor({ row, onChange, datasource, timeRange, queryContext }: ModifyRowContentProps) {
  const shared = useStyles2(getSharedStyles);
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
          {index > 0 && <span className={styles.pairSeparator}>,</span>}
          <FieldNameSelect
            value={pair.src}
            onChange={(v) => handlePairChange(index, 'src', v)}
            datasource={datasource}
            timeRange={timeRange}
            queryContext={queryContext}
          />
          <span className={styles.label}>as</span>
          <div className={pairs.length > 1 ? shared.inputNoRightRadius : undefined}>
            <AutoSizeInput
              placeholder='new field name'
              defaultValue={pair.dst}
              minWidth={12}
              onCommitChange={(e) => handlePairChange(index, 'dst', e.currentTarget.value)}
            />
          </div>
          {pairs.length > 1 && (
            <div className={shared.removeButtonContainer}>
              <IconButton className={shared.removeButton} name='times' size='sm' tooltip='Remove pair' onClick={() => handleRemovePair(index)} />
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
  pairSeparator: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});

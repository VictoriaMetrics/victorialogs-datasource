import React from 'react';

import { InlineField, Input } from '@grafana/ui';

type Props = {
  maxLines: string;
  onMaxLinedChange: (value: string) => void;
};

export const QuerySettings = (props: Props) => {
  const { maxLines, onMaxLinedChange } = props;
  return (
    <div>
      <InlineField
        label="Maximum lines"
        labelWidth={22}
        tooltip={
          <>
            VictoriaLogs queries must contain a limit of the maximum number of lines returned (default: 1000). Increase this
            limit to have a bigger result set for ad-hoc analysis. Decrease this limit if your browser becomes sluggish
            when displaying the log results.
          </>
        }
      >
        <Input
          type="number"
          value={maxLines}
          onChange={(event: React.FormEvent<HTMLInputElement>) => onMaxLinedChange(event.currentTarget.value)}
          width={16}
          placeholder="1000"
          spellCheck={false}
        />
      </InlineField>

    </div>
  );
};

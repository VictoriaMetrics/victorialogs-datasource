import React from 'react';

import { EmptyState, Stack, Text } from '@grafana/ui';

/**
 * A compatibility wrapper for EmptyState that uses the Grafana component in Grafana 11+
 * and a plain text block in older versions where it is not exported
 */
export const CompatibleEmptyState: typeof EmptyState = (props) => {
  if (EmptyState) {
    return <EmptyState {...props} />;
  }

  const { message, children } = props;

  return (
    <Stack direction='column' alignItems='center' gap={1}>
      <Text variant='h4' textAlignment='center'>
        {message}
      </Text>
      {children && (
        <Text color='secondary' textAlignment='center'>
          {children}
        </Text>
      )}
    </Stack>
  );
};

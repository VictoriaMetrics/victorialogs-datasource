import React from 'react';

import { Button, Card, Stack, Text } from '@grafana/ui';

interface DetectionErrorCardProps {
  error: string;
  isDetecting: boolean;
  onRedetect: () => void;
}

export const DetectionErrorCard = ({ error, isDetecting, onRedetect }: DetectionErrorCardProps) => (
  <Card>
    <Stack direction='column' gap={1}>
      <Text color='warning'>Detection failed: {error}</Text>
      <div>
        <Button variant='secondary' size='sm' onClick={onRedetect} disabled={isDetecting}>
          {isDetecting ? 'Detecting…' : 'Re-detect'}
        </Button>
      </div>
    </Stack>
  </Card>
);

import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { PlaceholderChip } from './PlaceholderChip';
import { getStyles } from './styles';
import { PlaceholderSegment, Segment } from './types';

interface Props {
  segments: Segment[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onValueChange: (segmentId: string, value: string | null) => void;
  onMultiValuesChange: (segmentId: string, values: string[]) => void;
  onConfirm: () => void;
  onDeactivate: () => void;
  onStreamFieldSelected?: (fieldName: string) => void;
}

export const SegmentRenderer: React.FC<Props> = ({
  segments,
  activeId,
  onActivate,
  onValueChange,
  onMultiValuesChange,
  onConfirm,
  onDeactivate,
  onStreamFieldSelected,
}) => {
  const styles = useStyles2(getStyles);

  const getDependencyValue = (segment: PlaceholderSegment): string | null => {
    if (!segment.dependsOn) {
      return null;
    }
    const dep = segments.find(
      (s) => s.type === 'placeholder' && s.id === segment.dependsOn
    );
    return dep?.type === 'placeholder' ? dep.value : null;
  };

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <span key={index} className={styles.staticText}>
              {segment.value}
            </span>
          );
        }

        return (
          <PlaceholderChip
            key={segment.id}
            segment={segment}
            isActive={activeId === segment.id}
            onClick={() => onActivate(segment.id)}
            onValueChange={(value) => onValueChange(segment.id, value)}
            onMultiValuesChange={(values) => onMultiValuesChange(segment.id, values)}
            onConfirm={onConfirm}
            onDeactivate={onDeactivate}
            onStreamFieldSelected={segment.optionSource === 'fieldNamesWithStream' ? onStreamFieldSelected : undefined}
            dependencyValue={getDependencyValue(segment)}
          />
        );
      })}
    </>
  );
};

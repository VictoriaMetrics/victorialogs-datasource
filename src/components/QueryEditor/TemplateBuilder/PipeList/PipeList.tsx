import React, { ReactNode } from 'react';

import { useStyles2 } from '@grafana/ui';

import { InsertableSeparator } from './InsertableSeparator';
import { STREAM_TEMPLATE_TYPE } from '../segmentHelpers';
import { getStyles } from '../styles';
import { Pipe } from '../types';

interface Props {
  pipes: Pipe[];
  renderPipe: (pipe: Pipe, index: number) => ReactNode;
  onInsertAt: (index: number, buttonEl: HTMLButtonElement) => void;
}

/**
 * Renders each pipe individually, wrapping stream pipes in `{...}` braces.
 * The `|` separators are interactive — hovering reveals a `+` button to insert a pipe.
 */
export const PipeList: React.FC<Props> = ({ pipes, renderPipe, onInsertAt }) => {
  const styles = useStyles2(getStyles);

  const elements: ReactNode[] = [];

  for (let i = 0; i < pipes.length; i++) {
    if (i > 0) {
      elements.push(<InsertableSeparator key={`sep-${i}`} index={i} onInsertAt={onInsertAt} />);
    }

    if (pipes[i].templateType === STREAM_TEMPLATE_TYPE) {
      elements.push(<span key={`brace-open-${i}`} className={styles.staticText}>{'{'}</span>);
      elements.push(renderPipe(pipes[i], i));
      elements.push(<span key={`brace-close-${i}`} className={styles.staticText}>{'}'}</span>);
    } else {
      elements.push(renderPipe(pipes[i], i));
    }
  }

  return <>{elements}</>;
};

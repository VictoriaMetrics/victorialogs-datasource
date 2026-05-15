import React, { ReactNode } from 'react';

import { Pipe } from '../types';

import { InsertableSeparator } from './InsertableSeparator';


interface Props {
  pipes: Pipe[];
  renderPipe: (pipe: Pipe, index: number) => ReactNode;
  onInsertAt: (index: number, buttonEl: HTMLButtonElement) => void;
}

/**
 * Renders each pipe individually.
 * The `|` separators are interactive — hovering reveals a `+` button to insert a pipe.
 */
export const PipeList: React.FC<Props> = ({ pipes, renderPipe, onInsertAt }) => {
  const elements: ReactNode[] = [];

  for (let i = 0; i < pipes.length; i++) {
    if (i > 0) {
      elements.push(<InsertableSeparator key={`sep-${i}`} index={i} onInsertAt={onInsertAt} />);
    }

    elements.push(renderPipe(pipes[i], i));
  }

  return <>{elements}</>;
};

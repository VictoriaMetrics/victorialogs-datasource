import { css } from '@emotion/css';
import React, { useRef } from 'react';
import { useLatest } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2, ReactMonacoEditor, monacoTypes } from '@grafana/ui';

import { Props } from './MonacoQueryFieldProps';

const options: monacoTypes.editor.IStandaloneEditorConstructionOptions = {
  codeLens: false,
  contextmenu: false,
  // we need `fixedOverflowWidgets` because otherwise in grafana-dashboards
  // the popup is clipped by the panel-visualizations.
  fixedOverflowWidgets: true,
  folding: false,
  fontSize: 14,
  lineDecorationsWidth: 8, // used as "padding-left"
  lineNumbers: 'off',
  minimap: { enabled: false },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  padding: {
    // these numbers were picked so that visually this matches the previous version
    // of the query-editor the best
    top: 4,
    bottom: 5,
  },
  renderLineHighlight: 'none',
  scrollbar: {
    vertical: 'hidden',
    verticalScrollbarSize: 8, // used as "padding-right"
    horizontal: 'hidden',
    horizontalScrollbarSize: 0,
  },
  scrollBeyondLastLine: false,
  suggestFontSize: 12,
  wordWrap: 'on',
};

// this number was chosen by testing various values. it might be necessary
// because of the width of the border, not sure.
//it needs to do 2 things:
// 1. when the editor is single-line, it should make the editor height be visually correct
// 2. when the editor is multi-line, the editor should not be "scrollable" (meaning,
//    you do a scroll-movement in the editor, and it will scroll the content by a couple pixels
//    up & down. this we want to avoid)
const EDITOR_HEIGHT_OFFSET = 2;

const getStyles = (theme: GrafanaTheme2, placeholder: string) => {
  return {
    container: css`
      border-radius: ${theme.shape.borderRadius()};
      border: 1px solid ${theme.components.input.borderColor};
    `,
    placeholder: css`
      ::after {
        content: '${placeholder}';
        font-family: ${theme.typography.fontFamilyMonospace};
        opacity: 0.3;
      }
    `,
  };
};

const MonacoQueryField = (props: Props) => {
  // we need only one instance of `overrideServices` during the lifetime of the react component
  const containerRef = useRef<HTMLDivElement>(null);
  const { onBlur, onRunQuery, initialValue, placeholder, readOnly } = props;

  const onRunQueryRef = useLatest(onRunQuery);
  const onBlurRef = useLatest(onBlur);

  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);

  return (
    <div
      aria-label={selectors.components.QueryField.container}
      className={styles.container}
      ref={containerRef}
    >
      <ReactMonacoEditor
        options={{
          ...options,
          readOnly
        }}
        language="promql"
        value={initialValue}
        onMount={(editor, monaco) => {
          // we setup on-blur
          editor.onDidBlurEditorWidget(() => {
            onBlurRef.current(editor.getValue());
          });

          const updateElementHeight = () => {
            const containerDiv = containerRef.current;
            if (containerDiv !== null) {
              const pixelHeight = editor.getContentHeight();
              containerDiv.style.height = `${pixelHeight + EDITOR_HEIGHT_OFFSET}px`;
              containerDiv.style.width = '100%';
              const pixelWidth = containerDiv.clientWidth;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(updateElementHeight);
          updateElementHeight();

          // handle: shift + enter
          editor.addAction({
            id: "execute-shift-enter",
            label: "Execute",
            keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
            run: () => onRunQueryRef.current(editor.getValue() || "")
          });

          /* Something in this configuration of monaco doesn't bubble up [mod]+K, which the
          command palette uses. Pass the event out of monaco manually
          */
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, function () {
            global.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          });

          if (placeholder) {
            const placeholderDecorators = [
              {
                range: new monaco.Range(1, 1, 1, 1),
                contents: [
                  { value: "**bold** _italics_ regular `code`" }
                ],
                options: {
                  className: styles.placeholder,
                  isWholeLine: true,
                },
              },
            ];

            let decorators: string[] = [];

            const checkDecorators: () => void = () => {
              const model = editor.getModel();

              if (!model) {
                return;
              }

              const newDecorators = model.getValueLength() === 0 ? placeholderDecorators : [];
              decorators = model.deltaDecorations(decorators, newDecorators);
            };

            checkDecorators();
            editor.onDidChangeModelContent(checkDecorators);
          }
        }}
      />
    </div>
  );
};

// we will lazy-load this module using React.lazy,
// and that only supports default-exports,
// so we have to default-export this, even if
// it is against the style-guidelines.

export default MonacoQueryField;

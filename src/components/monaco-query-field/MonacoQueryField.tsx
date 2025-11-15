import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import { useLatest } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2, ReactMonacoEditor, monacoTypes, Monaco } from '@grafana/ui';

import { languageConfiguration, monarchlanguage } from '../../language';

import { Props } from './MonacoQueryFieldProps';
import { CompletionDataProvider } from './completion/CompletionDataProvider';
import { getCompletionProvider, getSuggestOptions } from './completion/completionUtils';

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
  suggest: getSuggestOptions(),
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

// we must only run the lang-setup code once
let LANGUAGE_SETUP_STARTED = false;
const LANG_ID = 'victorialogs-logsql';

function ensureVictoriaLogsLogsQL(monaco: Monaco) {
  if (LANGUAGE_SETUP_STARTED === false) {
    LANGUAGE_SETUP_STARTED = true;
    monaco.languages.register({ id: LANG_ID });

    monaco.languages.setMonarchTokensProvider(LANG_ID, monarchlanguage);
    monaco.languages.setLanguageConfiguration(LANG_ID, {
      ...languageConfiguration,
      wordPattern: /(-?\d*\.\d\w*)|([^`~!#%^&*()+\[{\]}\\|;:',.<>\/?\s]+)/g,
      // Default:  /(-?\d*\.\d\w*)|([^`~!#%^&*()\-=+\[{\]}\\|;:'",.<>\/?\s]+)/g
      // Removed `"`, `=`, and `-`, from the exclusion list, so now the completion provider can decide to overwrite any matching words, or just insert text at the cursor
    });
  }
}

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
  const { onBlur, onRunQuery, initialValue, placeholder, readOnly, history, timeRange, datasource } = props;

  const onRunQueryRef = useLatest(onRunQuery);
  const onBlurRef = useLatest(onBlur);
  const historyRef = useLatest(history);
  const langProviderRef = useLatest(datasource.languageProvider);
  const completionDataProviderRef = useRef<CompletionDataProvider | null>(null);
  const autocompleteCleanupCallback = useRef<(() => void) | null>(null);

  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);

  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteCleanupCallback.current?.();
    };
  }, []);

  return (
    <div aria-label={selectors.components.QueryField.container} className={styles.container} ref={containerRef}>
      <ReactMonacoEditor
        options={{ ...options, readOnly }}
        language={LANG_ID}
        value={initialValue}
        beforeMount={(monaco) => {
          ensureVictoriaLogsLogsQL(monaco);
        }}
        onMount={(editor, monaco) => {
          // we setup on-blur
          editor.onDidBlurEditorWidget(() => {
            onBlurRef.current(editor.getValue());
          });

          const dataProvider = new CompletionDataProvider(langProviderRef.current!, historyRef, timeRange);
          completionDataProviderRef.current = dataProvider;
          const completionProvider = getCompletionProvider(monaco, dataProvider);

          // completion-providers in monaco are not registered directly to editor-instances,
          // they are registered to languages. this makes it hard for us to have
          // separate completion-providers for every query-field-instance
          // (but we need that, because they might connect to different datasources).
          // the trick we do is, we wrap the callback in a "proxy",
          // and in the proxy, the first thing is, we check if we are called from
          // "our editor instance", and if not, we just return nothing. if yes,
          // we call the completion-provider.
          const filteringCompletionProvider: monacoTypes.languages.CompletionItemProvider = {
            ...completionProvider,
            provideCompletionItems: (model, position, context, token) => {
              // if the model-id does not match, then this call is from a different editor-instance,
              // not "our instance", so return nothing
              if (editor.getModel()?.id !== model.id) {
                return { suggestions: [] };
              }
              return completionProvider.provideCompletionItems(model, position, context, token);
            },
          };
          const { dispose } = monaco.languages.registerCompletionItemProvider(LANG_ID, filteringCompletionProvider);

          autocompleteCleanupCallback.current = dispose;
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
            id: 'execute-shift-enter',
            label: 'Execute',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
            run: () => onRunQueryRef.current(editor.getValue() || ''),
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
                contents: [{ value: '**bold** _italics_ regular `code`' }],
                options: { className: styles.placeholder, isWholeLine: true },
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

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import grafanaEslintConfig from '@grafana/eslint-config/flat.js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jest from 'eslint-plugin-jest';
import lodash from 'eslint-plugin-lodash';
import deprecation from 'eslint-plugin-deprecation';
import prettier from 'eslint-config-prettier';
import unusedImports from "eslint-plugin-unused-imports";
import * as emotionPlugin from '@emotion/eslint-plugin';
import { fixupPluginRules } from "@eslint/compat";
import importPlugin from 'eslint-plugin-import';

export default defineConfig([
    eslint.configs.recommended,
    tseslint.configs.recommended,
    grafanaEslintConfig,
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.yarn/**',
        '**/.cache/**',
        '**/.config/**',
        '**/vendor/**',
        '**/pkg/**',
        '**/plugins/**',
        '**/bin/**',
        '**/*.min.js',
        '.prettierrc.js',
        'webpack.config.ts',
        'jest.config.js',
        'jest-setup.js',
      ],
    },
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      plugins: {
        '@typescript-eslint': tseslint.plugin,
        'react-hooks': reactHooks,
        'react': react,
        'jest': jest,
        'lodash': lodash,
        'deprecation': deprecation,
        'unused-imports': unusedImports,
        '@emotion': fixupPluginRules(emotionPlugin),
        'import': importPlugin,
      },
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true,
          },
          project: './tsconfig.json',
        },
        globals: {
          // Browser globals
          window: 'readonly',
          document: 'readonly',
          navigator: 'readonly',
          console: 'readonly',
          // Node globals
          process: 'readonly',
          __dirname: 'readonly',
          __filename: 'readonly',
          module: 'readonly',
          require: 'readonly',
        },
      },


      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        "unused-imports/no-unused-imports": "error",
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        "react/prop-types": "off",
        "@emotion/jsx-import": "error",
        "object-curly-spacing": [2, "always"],
        "lodash/import-scope": [2, "member"],
        "jest/no-focused-tests": "error",
        "@typescript-eslint/array-type": 0,
        "no-useless-escape": 0,
        "no-prototype-builtins": 0,
        "import/order": [
          "error",
          {
            "groups": [["builtin", "external"], "internal", "parent", "sibling", "index"],
            'pathGroups': [
              {
                pattern: '@grafana/**',
                group: 'external',
                position: 'after'
              }
            ],
            'pathGroupsExcludedImportTypes': ['react', 'react-dom'],
            "newlines-between": "always",
            "alphabetize": { "order": "asc" }
          }
        ],

        // Use typescript's no-redeclare for compatibility with overrides
        "no-redeclare": "off",
        "@typescript-eslint/no-redeclare": ["error"]
      },
    },

    {
      files: ['**/*.test.{ts,tsx,js,jsx}', '**/__tests__/**'],
      plugins: {
        jest,
      },
      rules: {
        ...jest.configs.recommended.rules,
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    prettier,
  ]
);

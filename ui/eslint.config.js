import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/reviewer-v2/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(?!shared(/|$))',
              message:
                'reviewer-v2/ files must not import from outside the subtree ' +
                '(exception: ../shared/** is allowed). ' +
                'Copy the utility into reviewer-v2/utils/ or reviewer-v2/hooks/ if you need it locally.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/code-review/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../reviewer-v2/**', '*/reviewer-v2/**'],
              message:
                'code-review/ files must not import from reviewer-v2/. ' +
                'Copy the utility into code-review/ or extract to shared/.',
            },
          ],
        },
      ],
    },
  },
])

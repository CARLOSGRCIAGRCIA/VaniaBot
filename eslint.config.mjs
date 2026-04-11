import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'vaniasession/**',
      'data/temp/**',
      'logs/**',
      '**/*.js',
    ],
  },
  {
    files: ['src/**/*.ts', 'vania.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'off',

      'no-console': 'off',
      'no-debugger': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      eqeqeq: 'off',
      'no-throw-literal': 'off',

      'prettier/prettier': 'off',
      ...prettierConfig.rules,
    },
  },
];

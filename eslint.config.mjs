import pluginJs from '@eslint/js';
import rxjsPlugin from '@smarttools/eslint-plugin-rxjs';
import stylistic from '@stylistic/eslint-plugin';
import angular from 'angular-eslint';
import checkFile from 'eslint-plugin-check-file';
import eslintConfigPrettier from 'eslint-config-prettier';
import importXPlugin from 'eslint-plugin-import-x';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const forbiddenUppercaseAbbreviations = 'ID|URL|HTTP|JSON|XML';
const underscoreTemplate = '^_';
const entityTypes = [
  'component',
  'directive',
  'pipe',
  'service',
  'guard',
  'resolver',
  'interceptor',
  'module',
  'enum',
  'interface',
  'store',
  'util',
  'config',
  'routes',
  'spec',
].join('|');

export default tseslint.config(
  { ignores: ['dist/*', '.angular/*', 'coverage/*'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    extends: [pluginJs.configs.recommended],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      sonarjs.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@stylistic': stylistic,
      '@smarttools/rxjs': rxjsPlugin,
      'import-x': importXPlugin,
    },
    rules: {
      'import-x/order': [
        'error',
        {
          'newlines-between': 'always',
          groups: [
            ['external', 'builtin'],
            ['internal'],
            ['parent', 'sibling', 'index'],
          ],
          alphabetize: { order: 'asc' },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-mutable-exports': 'error',

      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variableLike',
          modifiers: ['unused'],
          format: null,
          custom: { regex: underscoreTemplate, match: true },
        },
        {
          selector: ['variableLike', 'method'],
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
          custom: { regex: forbiddenUppercaseAbbreviations, match: false },
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          custom: { regex: forbiddenUppercaseAbbreviations, match: false },
          prefix: [
            'is',
            'has',
            'can',
            'should',
            'are',
            'did',
            'will',
            'was',
            'must',
          ],
          filter: { regex: '^(actual|value|result|expected)$', match: false },
        },
        {
          selector: ['interface', 'typeAlias'],
          format: ['PascalCase'],
          custom: {
            regex: `^I[A-Z]|(Interface|Type)$|${forbiddenUppercaseAbbreviations}`,
            match: false,
          },
        },
        {
          selector: 'class',
          format: ['PascalCase'],
          custom: { regex: forbiddenUppercaseAbbreviations, match: false },
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
          custom: { regex: forbiddenUppercaseAbbreviations, match: false },
        },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: underscoreTemplate,
          argsIgnorePattern: underscoreTemplate,
          caughtErrorsIgnorePattern: underscoreTemplate,
        },
      ],
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/member-ordering': 'error',

      eqeqeq: 'error',
      'no-nested-ternary': 'error',
      'no-console': 'error',
      'no-implicit-coercion': 'error',
      'object-shorthand': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(ImportNamespaceSpecifier, ExportAllDeclaration, ExportNamespaceSpecifier)',
          message: 'Импортируйте и экспортируйте только нужные сущности',
        },
      ],

      '@stylistic/lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'always', prev: 'method', next: '*' },
          ],
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'never', prev: 'case', next: '*' },
        { blankLine: 'never', prev: '*', next: 'case' },
      ],

      '@smarttools/rxjs/no-subscribe-handlers': 'error',
      '@smarttools/rxjs/finnish': [
        'error',
        {
          functions: false,
          methods: false,
          parameters: false,
          strict: true,
        },
      ],
      '@smarttools/rxjs/suffix-subjects': [
        'error',
        { suffix: '$$', methods: false, functions: false },
      ],
      '@smarttools/rxjs/no-unsafe-takeuntil': 'error',

      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/no-async-lifecycle-method': 'error',
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
    },
  },
  {
    files: ['**/*.component.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      '@angular-eslint/template/no-call-expression': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'error',
      '@angular-eslint/template/button-has-type': 'error',
      '@angular-eslint/template/attributes-order': [
        'error',
        {
          alphabetical: false,
          order: [
            'ATTRIBUTE_BINDING',
            'TEMPLATE_REFERENCE',
            'STRUCTURAL_DIRECTIVE',
            'INPUT_BINDING',
            'TWO_WAY_BINDING',
            'OUTPUT_BINDING',
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,html,scss}'],
    ignores: [
      'src/main.ts',
      'src/test-setup.ts',
      'src/index.html',
      'src/styles.scss',
    ],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { 'src/**/*.{ts,html,scss}': `+([a-z0-9-]).@(${entityTypes})?(.spec)` },
        { ignoreMiddleExtensions: false },
      ],
    },
  },
  {
    files: ['src/**/*.{html,scss}'],
    ignores: ['src/index.html', 'src/styles.scss'],
    plugins: { 'check-file': checkFile },
    processor: 'check-file/eslint-processor-check-file',
  },
  eslintConfigPrettier
);

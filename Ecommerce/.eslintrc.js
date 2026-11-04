module.exports = {
  root: true,
  extends: '@react-native',
  plugins: ['import'],
  rules: {
    // Legacy screens are split as each feature moves to the new data layer.
    // Keep the debt visible without blocking unrelated foundation work.
    'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-magic-numbers': [
      'warn',
      { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true, enforceConst: true },
    ],
    // Forbid deep relative imports; use @ aliases instead.
    // Existing screens still use deep relative imports. Keep the migration
    // visible while features move to their public aliases.
    'no-restricted-imports': ['warn', { patterns: ['../../*', '../../../*', '../../../../*'] }],
    'import/no-cycle': 'error',
    'react/jsx-no-bind': ['warn', { allowArrowFunctions: false }],
    'react-hooks/exhaustive-deps': 'error',
  },
  settings: {
    'import/resolver': {
      'babel-module': {},
    },
  },
};

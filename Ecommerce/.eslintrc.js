module.exports = {
  root: true,
  extends: '@react-native',
  plugins: ['import'],
  rules: {
    'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-magic-numbers': [
      'warn',
      { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true, enforceConst: true },
    ],
    // Forbid deep relative imports; use @ aliases instead.
    'no-restricted-imports': [
      'error',
      { patterns: ['../../*', '../../../*', '../../../../*'] },
    ],
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

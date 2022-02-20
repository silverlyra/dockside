module.exports = {
  root: true,
  env: {node: true},
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'prettier', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
    ],
  },
}

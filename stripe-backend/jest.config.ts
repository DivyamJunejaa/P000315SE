export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: [
    'api/**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  testTimeout: 15000,
};
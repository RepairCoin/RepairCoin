module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/?(*.)+(spec|test).ts'
  ],
  // Integration suites that require a seeded database are excluded from the default run.
  // Run them explicitly with `npm run test:integration` against a seeded DB.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/integration/full-flow.test.ts',
    '<rootDir>/tests/unit/wallet-detection.test.ts',
    '<rootDir>/tests/subscription/subscription.edge-cases.test.ts'
  ],
  transform: {
    // isolatedModules skips per-file type-checking (CI runs `tsc --noEmit` separately),
    // which is the dominant cost in the unit run.
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/app.ts', // Entry point
    '!src/types/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
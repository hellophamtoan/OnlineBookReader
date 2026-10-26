// Keep Node's built-in node:test suite out of Jest discovery when running Jest locally.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', 'new-contract\\.node\\.test\\.js$'],
};

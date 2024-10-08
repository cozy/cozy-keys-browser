const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../shared/tsconfig.libs");

const sharedConfig = require("../shared/jest.config.ts");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "libs/cozy tests",
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),
};

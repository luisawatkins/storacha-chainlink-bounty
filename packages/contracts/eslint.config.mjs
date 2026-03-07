import { config } from "@storacha-chainlink/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: [
      "ignition/deployments/**",
      "artifacts/**",
      "cache/**",
      "typechain-types/**",
      "coverage/**",
    ],
  },
  {
    files: ["test/**/*.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

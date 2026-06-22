import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    rules: {
      // This is a TypeScript project — types already validate props, so the
      // PropTypes rule only produces false positives on our typed components.
      "react/prop-types": "off",
    },
  },
];

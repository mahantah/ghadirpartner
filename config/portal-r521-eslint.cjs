const tseslint = require("typescript-eslint");
module.exports = [
  ...tseslint.configs.strict,
  {
    files: ["scripts/portal-r521.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

const tseslint = require("typescript-eslint");
module.exports = [
  ...tseslint.configs.strict,
  {
    files: ["scripts/persian-digits-v1.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

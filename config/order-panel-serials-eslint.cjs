const tseslint = require("typescript-eslint");
module.exports = [
  ...tseslint.configs.strict,
  {
    files: ["scripts/order-panel-serials-v1.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
export default [{files:['**/*.ts'],languageOptions:{parser,parserOptions:{ecmaVersion:2020,sourceType:'script'}},plugins:{'@typescript-eslint':plugin},rules:{...plugin.configs.recommended.rules,'@typescript-eslint/no-unused-vars':'off','@typescript-eslint/no-explicit-any':'error','no-debugger':'error','no-constant-condition':'error','no-duplicate-case':'error','no-unreachable':'error','no-unsafe-finally':'error'}}];

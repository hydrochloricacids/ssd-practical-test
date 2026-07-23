import js from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      sourceType: "commonjs"
    },
    plugins: {
      security
    },
    rules: {
      ...security.configs.recommended.rules,
      "security/detect-eval-with-expression": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-non-literal-fs-filename": "warn"
    }
  }
];

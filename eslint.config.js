import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      ".sources/**",
      ".vite/**",
      ".wrangler/**",
      ".worker-measurement-dist/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "ARCHITECTURE_AUDIT.md",
      "PROJECT_REVIEW_NOTES.md",
      "SECURITY_AUDIT.md",
      "engine.js",
      "equipment.js",
      "gamedata.js",
      "market.js",
      "planner-core.js",
      "planner.jsx",
      "trip.js",
      "views.jsx"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  },
  {
    files: ["src/**/*.{ts,tsx}", "*.config.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  }
];

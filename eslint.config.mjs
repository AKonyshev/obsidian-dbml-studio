import love from "eslint-config-love";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import tseslint from "typescript-eslint";

// `eslint-config-love` is what `eslint-config-standard-with-typescript`
// became, and it has grown a long way past it. The rules below are the ones
// love enables that standard-with-typescript 43 did not, and they stay off so
// that moving to ESLint 9 changes the tooling and not what the code is held
// to. Adopting one is deleting its line here and fixing what it reports.
// Successors of rules the old set had (`no-require-imports` for
// `no-var-requires`, `only-throw-error` for `no-throw-literal`, the three that
// replaced `ban-types`, ...) are not listed, so they stay on.
const NOT_IN_STANDARD_WITH_TYPESCRIPT = [
  "@typescript-eslint/class-methods-use-this",
  "@typescript-eslint/init-declarations",
  "@typescript-eslint/max-params",
  "@typescript-eslint/no-array-delete",
  "@typescript-eslint/no-confusing-non-null-assertion",
  "@typescript-eslint/no-deprecated",
  "@typescript-eslint/no-duplicate-enum-values",
  "@typescript-eslint/no-duplicate-type-constituents",
  "@typescript-eslint/no-empty-function",
  "@typescript-eslint/no-explicit-any",
  "@typescript-eslint/no-import-type-side-effects",
  "@typescript-eslint/no-inferrable-types",
  "@typescript-eslint/no-magic-numbers",
  "@typescript-eslint/no-meaningless-void-operator",
  "@typescript-eslint/no-misused-spread",
  "@typescript-eslint/no-mixed-enums",
  "@typescript-eslint/no-non-null-asserted-nullish-coalescing",
  "@typescript-eslint/no-redundant-type-constituents",
  "@typescript-eslint/no-unnecessary-condition",
  "@typescript-eslint/no-unnecessary-parameter-property-assignment",
  "@typescript-eslint/no-unnecessary-qualifier",
  "@typescript-eslint/no-unnecessary-template-expression",
  "@typescript-eslint/no-unnecessary-type-arguments",
  "@typescript-eslint/no-unnecessary-type-conversion",
  "@typescript-eslint/no-unnecessary-type-parameters",
  "@typescript-eslint/no-unsafe-assignment",
  "@typescript-eslint/no-unsafe-call",
  "@typescript-eslint/no-unsafe-declaration-merging",
  "@typescript-eslint/no-unsafe-enum-comparison",
  "@typescript-eslint/no-unsafe-member-access",
  "@typescript-eslint/no-unsafe-return",
  "@typescript-eslint/no-unsafe-type-assertion",
  "@typescript-eslint/no-unsafe-unary-minus",
  "@typescript-eslint/no-unused-private-class-members",
  "@typescript-eslint/no-useless-default-assignment",
  "@typescript-eslint/no-useless-empty-export",
  "@typescript-eslint/prefer-as-const",
  "@typescript-eslint/prefer-destructuring",
  "@typescript-eslint/prefer-find",
  "@typescript-eslint/prefer-for-of",
  "@typescript-eslint/prefer-literal-enum-member",
  "@typescript-eslint/prefer-namespace-keyword",
  "@typescript-eslint/prefer-regexp-exec",
  "@typescript-eslint/prefer-string-starts-ends-with",
  "@typescript-eslint/related-getter-setter-pairs",
  "@typescript-eslint/require-await",
  "@typescript-eslint/strict-void-return",
  "@typescript-eslint/switch-exhaustiveness-check",
  "@typescript-eslint/unified-signatures",
  "@typescript-eslint/use-unknown-in-catch-callback-variable",
  "@eslint-community/eslint-comments/disable-enable-pair",
  "@eslint-community/eslint-comments/no-aggregating-enable",
  "@eslint-community/eslint-comments/no-duplicate-disable",
  "@eslint-community/eslint-comments/no-unlimited-disable",
  "@eslint-community/eslint-comments/no-unused-enable",
  "@eslint-community/eslint-comments/require-description",
  "arrow-body-style",
  "complexity",
  "consistent-this",
  "curly",
  "for-direction",
  "grouped-accessor-pairs",
  "guard-for-in",
  "logical-assignment-operators",
  "max-depth",
  "max-lines",
  "max-nested-callbacks",
  "no-alert",
  "no-await-in-loop",
  "no-console",
  "no-constant-binary-expression",
  "no-constructor-return",
  "no-dupe-else-if",
  "no-empty-static-block",
  "no-implicit-globals",
  "no-lonely-if",
  "no-loop-func",
  "no-multi-assign",
  "no-negated-condition",
  "no-nonoctal-decimal-escape",
  "no-param-reassign",
  "no-plusplus",
  "no-promise-executor-return",
  "no-script-url",
  "no-unexpected-multiline",
  "no-useless-assignment",
  "no-useless-concat",
  "operator-assignment",
  "prefer-arrow-callback",
  "prefer-exponentiation-operator",
  "prefer-named-capture-group",
  "prefer-numeric-literals",
  "prefer-object-has-own",
  "prefer-object-spread",
  "prefer-rest-params",
  "prefer-spread",
  "prefer-template",
  "preserve-caught-error",
  "radix",
  "require-atomic-updates",
  "require-unicode-regexp",
  "require-yield",
  "strict",
  "promise/avoid-new",
  "promise/no-multiple-resolved",
  "promise/no-return-wrap",
  "promise/prefer-catch",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/out/**",
      "**/*.d.ts",
      "**/*.config.js",
      "**/*.config.mjs",
      // The bundle `npm run build` writes and the frame it vendors: build
      // output, not source.
      "main.js",
      "frame/**",
      // ESLint 8 skipped dotfiles and dot-folders (`.husky/`, ...) unless
      // told otherwise; ESLint 9 lints them.
      "**/.*",
      "**/.*/**",
    ],
  },
  {
    // ESLint 8 did not report unused disable directives, and ESLint 9's
    // `--fix` deletes the ones it reports. The Obsidian block below turns this
    // on again (its rules cannot be disabled by a comment), and it wins.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    files: ["**/*.{ts,js,cjs,mjs}"],
    plugins: { ...love.plugins, "import-x": importX },
    languageOptions: {
      ...love.languageOptions,
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
      parserOptions: {
        // Plain JavaScript outside the tsconfig — root configs, the shell
        // tooling in `scripts/` — gets a program of its own, the file and
        // what it imports.
        projectService: {
          allowDefaultProject: ["*.js", "*.mjs", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...love.rules,
      ...Object.fromEntries(
        NOT_IN_STANDARD_WITH_TYPESCRIPT.map((rule) => [rule, "off"]),
      ),
      // Where love and standard-with-typescript disagree on a shared rule,
      // the old setting wins.
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "warn",
      // standard-with-typescript had these and love no longer does.
      "@typescript-eslint/no-redeclare": "error",
      "no-undef-init": "error",
      "spaced-comment": [
        "error",
        "always",
        {
          line: { markers: ["*package", "!", "/", ",", "="] },
          block: {
            balanced: true,
            markers: ["*package", "!", ",", ":", "::", "flow-include"],
            exceptions: ["*"],
          },
        },
      ],
      "import-x/export": "error",
      "import-x/first": "error",
      "import-x/no-absolute-path": [
        "error",
        { esmodule: true, commonjs: true, amd: false },
      ],
      "import-x/no-duplicates": "error",
      "import-x/no-named-default": "error",
      "import-x/no-webpack-loader-syntax": "error",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
        },
      ],
    },
  },
  {
    // Repo tooling: the build and release scripts, plain Node tooling and not
    // typed application source, so the type-aware rules have nothing real to
    // work with.
    files: ["scripts/**/*.{js,mjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
    },
  },
  // What the Obsidian community directory's review applies. After the love
  // block, so where the two disagree this one wins.
  ...obsidianmd.configs.recommended,
  {
    // The stand-in for Obsidian's element helpers is made of the native DOM
    // calls the rule steers plugin code away from.
    files: ["src/testSupport/obsidianDom.ts"],
    rules: { "obsidianmd/prefer-create-el": "off" },
  },
  {
    // Jest's globals, for the tests: `no-undef` is on under the Obsidian block.
    files: ["**/__tests__/**/*.ts"],
    languageOptions: { globals: globals.jest },
  },
  prettier,
);

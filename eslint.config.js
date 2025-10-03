import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const reactHooksRecommended = reactHooks.configs["flat/recommended"][0];

export default [
    {
        ignores: ["dist/**", "node_modules/**", "pkg/lib/**"],
    },
    {
        files: ["**/*.{js,jsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                module: "readonly",
                require: "readonly",
            },
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        plugins: {
            react,
            "react-hooks": reactHooks,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...react.configs.flat.recommended.rules,
            ...reactHooksRecommended.rules,
            indent: ["error", 4, {
                ObjectExpression: "first",
                CallExpression: { arguments: "first" },
                MemberExpression: 2,
                ignoredNodes: ["JSXAttribute"],
            }],
            "newline-per-chained-call": ["error", { ignoreChainWithDepth: 2 }],
            "no-var": "error",
            "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: true }],
            "prefer-promise-reject-errors": ["error", { allowEmptyReject: true }],
            "react/jsx-indent": ["error", 4],
            semi: ["error", "always", { omitLastInOneLineBlock: true }],
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            camelcase: "off",
            "comma-dangle": "off",
            curly: "off",
            "jsx-quotes": "off",
            "key-spacing": "off",
            "no-console": "off",
            quotes: "off",
            "react/jsx-curly-spacing": "off",
            "react/jsx-indent-props": "off",
            "space-before-function-paren": "off",
            "react-hooks/exhaustive-deps": "error",
        },
    },
    {
        files: ["build.js", "build-tools/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.node,
        },
    },
];

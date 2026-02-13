import tseslint from "typescript-eslint"

export default [
    { files: ["**/*.ts"] },
    ...tseslint.configs.recommended,
    {
        rules: {
            "no-console": "warn",
            "no-warning-comments": [
                "warn",
                { terms: ["TODO", "FIXME"], location: "anywhere" },
            ],
            quotes: [
                "warn",
                "double",
                {
                    allowTemplateLiterals: true,
                    avoidEscape: true,
                },
            ],
            semi: ["warn", "never"],
            "no-unused-vars": "warn",
        },
    },
]
import tsparser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
    ...obsidianmd.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: { project: './tsconfig.json' },
        },
    },
    globalIgnores([
        'node_modules/**',
        'test-vault/**',
        'main.js',
        'tests/**',
        'explorations/**',
        'esbuild.config.mjs',
        'generate_mocks.js',
    ]),
]);

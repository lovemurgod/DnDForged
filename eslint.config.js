import js from '@eslint/js';
import globals from 'globals';

const vendorGlobals = {
    THREE: 'readonly',
    CANNON: 'readonly',
    DOMPurify: 'readonly',
    JqueryUtil: 'readonly',
    Parser: 'readonly',
    Renderer: 'readonly',
    io: 'readonly',
    define: 'readonly'
};

const tabletopGlobals = {
    VTT: 'writable',
    vtt: 'writable',
    campaignSettings: 'writable'
};

export default [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/5etools-src/**',
            '**/.dndforged-data/**',
            '**/.release-stage/**',
            'vtt/lib/**',
            'vtt/data/**',
            '**/*.min.js',
            'package-lock.json'
        ]
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                ...vendorGlobals,
                ...tabletopGlobals
            }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-useless-assignment': 'off',
            'no-useless-escape': 'off',
            'no-undef': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-constant-condition': ['warn', { checkLoops: false }],
            'no-inner-declarations': 'off',
            'no-extra-boolean-cast': 'warn',
            'no-redeclare': 'warn'
        }
    }
];

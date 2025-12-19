/** @type {import('postcss-load-config').Config} */
const config = {
    plugins: {
        '@tailwindcss/postcss': {}, // <--- This is the new name for v4
        autoprefixer: {},
    },
};

export default config;
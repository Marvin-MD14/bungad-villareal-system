import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // App.jsx renders recharts charts, which need real layout boxes; jsdom
    // returns 0 for every measurement, so the charts are stubbed in the test
    // file itself and CSS is not processed here.
    css: false,
    exclude: ['node_modules/**', 'dist/**'],
    // Only *.test.* files are suites; helpers.js and setup.js are support code.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // Several components use JSX without importing React (the production build
    // gets the automatic runtime from rolldown). Tests transform with esbuild,
    // which defaults to the classic runtime and then fails with
    // "React is not defined" — so opt in to the same automatic runtime.
    esbuild: { jsx: 'automatic' },
  },
})

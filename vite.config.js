import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Old enough for iPhone 6 / iOS 12 (Safari 12), which can't update further.
    target: ['es2018', 'safari12', 'chrome80'],
    cssTarget: ['safari12', 'chrome80'],
  },
});

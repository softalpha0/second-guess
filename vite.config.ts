import { defineConfig } from 'vite';

// Builds the window (renderer) into dist/renderer. Electron loads it as a local file.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
});

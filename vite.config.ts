import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // Polling keeps reloads reliable when filesystem events are dropped.
    watch: {
      interval: 100,
      usePolling: true,
    },
  },
});

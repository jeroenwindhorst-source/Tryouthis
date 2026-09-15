import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Vaste namen: de losstaande build wordt als artifact gepubliceerd en de schil
    // verwijst er met een vast pad naar.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/werkplek.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/werkplek.[ext]',
      },
    },
  },
  server: {
    port: 5173,
    // De werkplek praat met dezelfde API als externe partijen (docs/08 §1).
    proxy: {
      '/api': 'http://localhost:3000',
      '/fhir': 'http://localhost:3000',
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // De werkplek praat met dezelfde API als externe partijen (docs/08 §1).
    proxy: {
      '/api': 'http://localhost:3000',
      '/fhir': 'http://localhost:3000',
    },
  },
});

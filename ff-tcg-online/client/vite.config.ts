import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standard Vite + React setup. Nothing game-specific here - if you later
// want the server to also serve the built client, point Express at
// client/dist (the output of `npm run build`) as a static folder.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `root` makes Vite treat client/ as the frontend application folder while
// package.json remains at the repository root.
export default defineConfig({
  root: __dirname,
  plugins: [react()]
});

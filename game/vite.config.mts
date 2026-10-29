import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {

  return {
    define: { 'process.env': '{}' },
    resolve: { alias: { 'node:crypto': join(process.cwd(), 'src/offline/crypto.ts'), 'node:fs': join(process.cwd(), 'src/offline/fs.ts'), 'node:path': join(process.cwd(), 'src/offline/path.ts') } },
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true as const,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true as const,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            // Framer Motion is used by the desk and modal routes only. Do not
            // promote it into the entry preload: keep the first Telegram paint
            // free of animation code and load it with the route that needs it.
            sdk: ['@telegram-apps/sdk-react', '@supabase/supabase-js'],
          },
        },
      },
    },
  };
});

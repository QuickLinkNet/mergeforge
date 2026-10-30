import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

function workspaceSource(relativePath: string): string {
  const pathname = decodeURIComponent(new URL(relativePath, import.meta.url).pathname);
  return pathname.replace(/^\/([A-Za-z]:)/, '$1');
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mergeforge/domain': workspaceSource('../../packages/domain/src/index.ts'),
      '@mergeforge/renderer-pixi': workspaceSource('../../packages/renderer-pixi/src/index.ts'),
      '@mergeforge/worldgen': workspaceSource('../../packages/worldgen/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    css: true,
  },
});

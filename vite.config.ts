import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { defineConfig } from 'vite';

const srcPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'src');

export default defineConfig(({ mode }) => ({
  build: {
    rolldownOptions: {
      output: {
        minify: mode === 'production' ? {
          compress: { dropConsole: true },
        } : {},
      },
    },
  },
  plugins: [
    {
      name: 'shaders',
      transform(code, id) {
        if (/\.wgsl$/g.test(id)) {
          return {
            code: `export default ${JSON.stringify(code)};`,
            map: null,
          };
        }
      },
    }
  ],
  resolve: {
    alias: (
      fs.readdirSync(srcPath, { withFileTypes: true })
        .filter((f) => f.isDirectory())
        .map(({ name }) => (
          { find: name, replacement: path.join(srcPath, name) }
        ))
    ),
  },
  server: {
    port: 8080,
  },
}));

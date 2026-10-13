import { defineConfig } from 'astro/config';

// Sitio estático servido en https://lucasramos.uy/profe/
// `docs/` queda como carpeta pública (fuentes, archivos, fotos, miniaturas y JSON de materiales/videos),
// así los archivos subidos desde el panel no se mueven.
export default defineConfig({
  site: 'https://lucasramos.uy',
  base: '/profe',
  trailingSlash: 'always',
  publicDir: './docs',
  outDir: './dist',
  build: { format: 'directory' },
});

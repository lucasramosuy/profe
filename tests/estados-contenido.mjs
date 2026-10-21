import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Build fixtures in a disposable copy; never rewrite CMS content in this checkout.
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'profe-content-'));
try {
  for (const path of ['src', 'docs', 'astro.config.mjs', 'package.json']) {
    cpSync(join(root, path), join(temp, path), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(temp, 'node_modules'), 'dir');
  const blogDir = join(temp, 'src/content/blog');
  rmSync(blogDir, { recursive: true, force: true });
  mkdirSync(blogDir, { recursive: true });
  const fixturePost = (draft) => `---\ntitulo: Entrada de prueba\nfecha: 2026-10-20\ndescripcion: Contenido de prueba\nborrador: ${draft}\n---\nTexto de prueba.\n`;
  const build = () => {
    const result = spawnSync(process.execPath, [join(root, 'node_modules/astro/astro.js'), 'build'], {
      cwd: temp, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return {
      home: readFileSync(join(temp, 'dist/index.html'), 'utf8'),
      blog: readFileSync(join(temp, 'dist/blog/index.html'), 'utf8'),
    };
  };
  // No materials and only a draft: do not advertise downloads or an empty search.
  writeFileSync(join(temp, 'docs/materiales.json'), '{"materiales":[]}');
  writeFileSync(join(blogDir, 'prueba.md'), fixturePost(true));
  let { home, blog } = build();
  assert.match(home, /Materiales en preparación/);
  assert.doesNotMatch(home, /id="buscar"/);
  assert.doesNotMatch(home, /Todo listo para descargar|Llevatelos/);
  assert.match(home, /href="\/#proyectos"/);
  assert.match(blog, /Blog en preparación/);
  assert.match(blog, /href="\/links\/"/);
  assert.doesNotMatch(blog, /class="post"/);
  assert.ok(!existsSync(join(temp, 'dist/blog/prueba/index.html')), 'Draft stays unpublished');
  // CMS content restores the existing listing, search and download flow on build.
  writeFileSync(join(temp, 'docs/materiales.json'), JSON.stringify({ materiales: [
    { titulo: 'Guía de prueba', curso: 'Curso de prueba', archivo: '/profe/archivos/prueba.pdf', fecha: '2026-10-20' },
  ] }));
  writeFileSync(join(blogDir, 'prueba.md'), fixturePost(false));
  ({ home, blog } = build());
  assert.match(home, /id="buscar"/);
  assert.match(home, /Todo listo para descargar/);
  assert.match(home, /href="\/profe\/archivos\/prueba.pdf"/);
  assert.match(home, /1 documento/);
  assert.doesNotMatch(home, /Materiales en preparación|id="vacio"/);
  assert.match(blog, /Entrada de prueba/);
  assert.doesNotMatch(blog, /Blog en preparación/);
  assert.ok(existsSync(join(temp, 'dist/blog/prueba/index.html')));
  console.log('OK: empty materials, draft-only blog, published materials and published blog. CMS files untouched.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

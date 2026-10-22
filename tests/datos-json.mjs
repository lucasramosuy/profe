import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Regresión: src/lib/datos.ts leía docs/*.json con new URL(ruta, import.meta.url).
// En Astro 7 el frontmatter se ejecuta bundleado (dist/.prerender/chunks), la lectura
// fallaba en silencio y el sitio quedaba sin materiales ni videos aunque el JSON
// tuviera contenido. Este test buildea una copia desechable con contenido de prueba
// y exige que aparezca en el HTML; nunca toca los JSON de este checkout.
const root = fileURLToPath(new URL('../', import.meta.url));
const astroPkg = JSON.parse(readFileSync(join(root, 'node_modules/astro/package.json'), 'utf8'));
const astroBin = join(root, 'node_modules/astro', astroPkg.bin.astro);
const temp = mkdtempSync(join(tmpdir(), 'profe-datos-'));
try {
  for (const path of ['src', 'docs', 'astro.config.mjs', 'package.json']) {
    cpSync(join(root, path), join(temp, path), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(temp, 'node_modules'), 'dir');
  const build = () => {
    const result = spawnSync(process.execPath, [astroBin, 'build'], {
      cwd: temp, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return readFileSync(join(temp, 'dist/index.html'), 'utf8');
  };
  // Con contenido en los JSON, el home lo muestra.
  writeFileSync(join(temp, 'docs/materiales.json'), JSON.stringify({ materiales: [
    { titulo: 'Guía de prueba', curso: 'Curso de prueba', archivo: '/profe/archivos/prueba.pdf', fecha: '2026-10-20' },
  ] }));
  writeFileSync(join(temp, 'docs/videos.json'), JSON.stringify({
    canal: 'https://www.youtube.com/channel/UCE47eMLfPfZK5Dqa8SGking',
    destacados: [{ id: 'abcdefghijk', titulo: 'Video de prueba', fecha: '2026-10-20' }],
    videos: [],
  }));
  let home = build();
  assert.match(home, /Guía de prueba/);
  assert.match(home, /Curso de prueba/);
  assert.match(home, /1 documento/);
  assert.match(home, /href="\/profe\/archivos\/prueba\.pdf"/);
  assert.match(home, /data-video="abcdefghijk"/);
  assert.match(home, /Video de prueba/);
  assert.match(home, /Fijado/);
  // Con los JSON vacíos no queda rastro del contenido (el estado vacío en sí
  // lo cubre tests/estados-contenido.mjs).
  writeFileSync(join(temp, 'docs/materiales.json'), '');
  writeFileSync(join(temp, 'docs/videos.json'), '{"destacados":[],"videos":[]}');
  home = build();
  assert.doesNotMatch(home, /Guía de prueba|data-video=/);
  assert.ok(existsSync(join(temp, 'dist/index.html')));
  console.log('OK: materiales y videos se leen desde docs/ en el build.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

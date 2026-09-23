# profe · lucasramos.uy/profe

Sitio de materiales de clase de Lucas Ramos. Se publica como sitio estático; sin build ni dependencias.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `docs/index.html` | La página pública. HTML/CSS/JS en un solo archivo. Carga `materiales.json` y muestra los materiales agrupados por curso, con buscador. Tipografías: Fraunces y Space Grotesk (Google Fonts). |
| `docs/materiales.json` | La lista de materiales. Se edita solo desde el CMS; no editar a mano. |
| `docs/admin/` | Panel de administración (Sveltia CMS). Está en `/profe/admin`. |
| `docs/archivos/` | PDFs y otros archivos subidos desde el CMS. |

El resto del repo (src/, public/, astro.config.mjs, etc.) es la plantilla vieja de AstroPaper, en desuso. No se publica.

## Publicación

- **Producción:** https://lucasramos.uy/profe/ (vía Cloudflare Worker, que redirige `/profe/*` al upstream de este sitio).
- La rama que se publica es `prod`, carpeta `docs/`.
- Cada commit a `prod` republica el sitio en ~1 minuto.

## Cómo subir un material

1. Entrá a `https://lucasramos.uy/profe/admin/` e iniciá sesión con "Sign In with Token" (un personal access token de GitHub con acceso a este repo).
2. En **Materiales**, agregá un item: título, curso, descripción, archivo y fecha.
3. Guardá. El CMS hace commit a `prod` y el sitio se republica solo en ~1 minuto.

## Notas

- No cargar materiales reales todavía (pedido de Lucas, 23-sep-2026).
- Los subdominios profe.lucasramos.uy (Netlify, plantilla vieja) y docs.lucasramos.uy (Mintlify) quedan como están hasta que Lucas confirme el nuevo sitio; después redirigen acá.

# profe · lucasramos.uy/profe

Sitio de materiales de clase de Lucas Ramos. Se publica como sitio estático; sin build ni dependencias.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `docs/index.html` | La página pública. HTML/CSS/JS en un solo archivo. Carga `materiales.json` y muestra los materiales agrupados por curso, con buscador. Tipografías: Fraunces y Space Grotesk, servidas desde `docs/fonts/` (archivos de Fontsource; sin Google Fonts). |
| `docs/materiales.json` | La lista de materiales. Se edita desde el panel (Pages CMS); no editar a mano. |
| `docs/archivos/` | PDFs y otros archivos subidos desde el panel. |
| `.pages.yml` | Configuración de Pages CMS (qué campos tiene cada material). |

## Publicación

- **Producción:** https://lucasramos.uy/profe/ (vía Cloudflare Worker, que redirige `/profe/*` al upstream de este sitio).
- La rama que se publica es `prod`, carpeta `docs/`.
- Cada commit a `prod` republica el sitio en ~1 minuto.

## Cómo subir un material

1. Entrá a https://app.pagescms.org/ con tu cuenta de GitHub y abrí el proyecto `lucasramosuy/profe`.
2. En **Materiales**, agregá un item: título, curso, descripción, archivo y fecha.
3. Guardá. Pages CMS hace commit a `prod` y el sitio se republica solo en ~1 minuto.

## Notas

- No cargar materiales reales todavía (pedido de Lucas, 23-sep-2026).
- Los subdominios profe.lucasramos.uy (Netlify, plantilla vieja) y docs.lucasramos.uy (Mintlify) quedan como están hasta que Lucas confirme el nuevo sitio; después redirigen acá.

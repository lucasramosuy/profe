# profe · lucasramos.uy/profe

Sitio de materiales de clase de Lucas. Se publica como sitio estático; sin build ni dependencias.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `docs/index.html` | La página pública. HTML/CSS/JS en un solo archivo. Carga `materiales.json` y muestra los materiales agrupados por curso, con buscador. Tipografías: Fraunces y Space Grotesk, servidas desde `docs/fonts/` (archivos de Fontsource; sin Google Fonts). |
| `docs/materiales.json` | La lista de materiales. Se edita desde el panel (Pages CMS); no editar a mano. |
| `docs/blog/` | El blog: listado (`index.html`) y detalle (`post.html`). Lee `blog.json` con JS y lo renderiza (parser de markdown chico, propio; sin dependencias). |
| `docs/blog.json` | Las entradas del blog. Se editan desde el panel (Pages CMS); no editar a mano. |
| `docs/archivos/` | PDFs y otros archivos subidos desde el panel. |
| `.pages.yml` | Campos y botones de Pages CMS. |
| `.github/workflows/acciones-cms.yml` | Acciones manuales y aviso automático al guardar materiales. |
| `scripts/acciones_cms.py` | Validación, optimización, Telegram y conversión a PDF. |

## Publicación

- **Producción:** https://lucasramos.uy/profe/ (vía Cloudflare Worker, que redirige `/profe/*` al upstream de este sitio).
- La rama que se publica es `prod`, carpeta `docs/`.
- Cada commit a `prod` republica el sitio en ~1 minuto.
- La rama `dev` tiene la plantilla vieja (AstroPaper); la que se publica es `prod`.

## Cómo escribir una entrada del blog

1. Entrá a https://app.pagescms.org/ y abrí el proyecto `lucasramosuy/profe`.
2. En **Blog**, agregá una entrada: título, fecha, descripción, etiquetas (separadas por comas) y cuerpo. El cuerpo es texto con formato: negrita, títulos, listas, citas, links e **imágenes** (el botón de imagen las sube a `docs/archivos/`).
3. Guardá. La entrada aparece en https://lucasramos.uy/profe/blog/ en ~1 minuto.

## Cómo subir un material

1. Entrá a https://app.pagescms.org/ con tu cuenta de GitHub y abrí el proyecto `lucasramosuy/profe`.
2. En **Materiales**, agregá un item: título, curso, descripción, archivo y fecha.
3. Guardá. Pages CMS hace commit a `prod` y el sitio se republica solo en ~1 minuto.

## Notas

- Contacto: los links van al formulario único de https://lucasramos.uy/contacto/?tema=profe (repo `www`).
- No cargar materiales reales todavía (pedido de Lucas, 23-sep-2026).
- Los subdominios profe.lucasramos.uy (Netlify, plantilla vieja) y docs.lucasramos.uy (Mintlify) quedan como están hasta que Lucas confirme el nuevo sitio; después redirigen acá.

## Acciones del panel

En Pages CMS, con la rama `prod` abierta, los cuatro botones aparecen en la barra del proyecto:

- **Validar enlaces de materiales:** revisa URLs de `archivo` y enlaces de la descripción; deja los fallos en el resumen del run de GitHub Actions. Un servidor que bloquee comprobaciones automáticas puede dar un falso positivo.
- **Optimizar imágenes:** reescribe solo PNG/JPEG/WebP de `docs/archivos/` cuando el archivo nuevo pesa menos, sin pérdida visible. Abre un PR para revisar y fusionar; nunca escribe directamente en `prod`. Si no hay ahorros, no abre PR.
- **Enviar resumen a Telegram:** envía la lista actual al chat del bot. Además, al agregar materiales a `docs/materiales.json` en `prod`, el aviso sale solo una vez por commit; editar materiales existentes no envía nada. Antes de habilitarlo, configurar los *secrets* del repositorio `TELEGRAM_TOKEN` (mismo token del bot de resoluciones) y `TELEGRAM_CHAT_ID` (ID del chat privado de Lucas). No pegar esos valores en el YAML.
- **Generar imprimible PDF:** pide el título exacto de un material ya guardado. Para DOCX, ODT, TXT y Markdown de texto simple aplica una plantilla A4 consistente, sin logo ni marca de agua; títulos, párrafos y listas fluyen entre páginas. Si el archivo contiene tablas, gráficos o campos, pide conservar su PDF original en vez de perderlos. PDF e imágenes mantienen su contenido y presentación; DOC/PPT antiguos se convierten sin remaquetar. El PDF queda como artefacto descargable del run por 7 días; otros formatos muestran un error claro; no se añade nada al sitio ni se envía a terceros.

GitHub Actions tiene que estar habilitado. Pages CMS necesita permiso de Actions para lanzar botones; para el PR de imágenes, el repositorio tiene que permitir a GitHub Actions crear pull requests. Los botones son manuales y el aviso automático corre solo con cambios en materiales. Todo usa las cuotas gratuitas de un repo público.

# Buscador de fotos de Profe

La página estática vive en `docs/fotos/`; GitHub Pages la sirve bajo `/profe/fotos/`. La ruta más específica `lucasramos.uy/profe/fotos/api/*` pertenece al Worker `profe-fotos`, no al proxy general. Cloudflare elige la ruta más específica. No colocar la clave en HTML, JavaScript ni en GitHub.

1. Registrar una aplicación Unsplash aparte para Profe y guardar su **Access Key** en el secreto `UNSPLASH_ACCESS_KEY` del Worker `profe-fotos` (Cloudflare > Workers & Pages > profe-fotos > Settings > Variables and Secrets). No hace falta Secret Key para este uso.
2. Publicar `worker/fotos.js` con `wrangler deploy --config worker/wrangler.fotos.toml` desde la raíz (o pegar el archivo en un nuevo Worker con ese nombre y registrar manualmente la ruta indicada). Con la ruta funcionando, validar `GET /profe/fotos/api/search?q=botanica&page=1` y el flujo de copia. **No desplegar la ruta antes de configurar el secreto**, o el buscador responderá 503.
3. Si no se configura la ruta, el proxy general enviará `/profe/fotos/api/*` a GitHub Pages y dará 404. El resto de `/profe/*` continúa en el proxy actual.

La búsqueda no persiste ni transforma imágenes. La UI usa directamente `photo.urls.small`/`regular` (con `ixid` intacto), enlaza al fotógrafo y a Unsplash con UTM, y al copiar el enlace de imagen llama a `photo.links.download_location` a través del Worker, conservando su query string. Copiar solo el crédito no dispara el contador. La app muestra 12 resultados por página y tope de 20 páginas. El Worker responde sin caché; los límites gratuitos se muestran como error legible.

Guías vigentes: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines ; https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download ; https://help.unsplash.com/en/articles/2511257-guideline-replicating-unsplash . Unsplash desaconseja buscadores de fotos standalone; esta herramienta está dentro de Profe y se orienta al flujo de materiales. Consultar `api@unsplash.com` si se duda de la elegibilidad para Production.

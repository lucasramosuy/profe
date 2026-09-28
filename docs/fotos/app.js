/* Fotos para materiales. La clave vive únicamente en el Worker, nunca en este JS. */
(() => {
  'use strict';
  const API = '/profe/fotos/api/';
  const SOURCE = 'profe_lucas';
  const $ = (id) => document.getElementById(id);
  const form = $('search-form'), input = $('query'), gallery = $('gallery');
  const status = $('status'), pagination = $('pagination'), more = $('more');
  let items = [], selected = null, page = 0, lastQuery = '', next = false, controller = null, searchSerial = 0;

  function credited(url) {
    const u = new URL(url);
    u.searchParams.set('utm_source', SOURCE);
    u.searchParams.set('utm_medium', 'referral');
    return u.toString();
  }
  function safeLink(raw, hostname) {
    try { const u = new URL(raw); return u.protocol === 'https:' && u.hostname === hostname ? credited(u.href) : ''; }
    catch { return ''; }
  }
  function photoUrl(raw) {
    try { const u = new URL(raw); return u.protocol === 'https:' && u.hostname === 'images.unsplash.com' ? u.href : ''; }
    catch { return ''; }
  }
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function external(el, url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  function setStatus(text) { status.textContent = text; status.hidden = !text; }
  function showSelected(index) {
    selected = items[index];
    if (!selected) return;
    document.querySelectorAll('.photocard').forEach((card, n) => {
      card.classList.toggle('selected', n === index);
      const badge = card.querySelector('.photochosen');
      badge.hidden = n !== index;
    });
    $('chosen').hidden = false;
    $('chosen-number').textContent = `FOTO ELEGIDA · ${String(index + 1).padStart(2,'0')}`;
    $('chosen-credit').textContent = `${selected.user.name} / Unsplash`;
    external($('chosen-original'), safeLink(selected.links.html, 'unsplash.com'));
    $('copy-photo').textContent = 'Copiar enlace';
    $('copy-credit').textContent = 'Copiar crédito';
  }
  function renderOne(photo, index) {
    const image = photoUrl(photo.urls.small);
    const pageLink = safeLink(photo.links.html, 'unsplash.com');
    const profile = safeLink(photo.user.links.html, 'unsplash.com');
    if (!image || !pageLink || !profile) return;
    const card = node('article','photocard');
    const pick = node('button','photopick'); pick.type = 'button'; pick.setAttribute('aria-label', `Elegir foto de ${photo.user.name}`);
    const img = node('img'); img.src = image; img.alt = photo.alt_description || photo.description || 'Fotografía de Unsplash'; img.loading = 'lazy';
    pick.append(img, node('span','photoindex',String(index + 1).padStart(2,'0')));
    const chosen = node('span','photochosen','Seleccionada ✓'); chosen.hidden = true; pick.append(chosen);
    pick.addEventListener('click', () => showSelected(index));
    const caption = node('div','photocaption'), text = node('div');
    const author = node('a','',photo.user.name); external(author, profile);
    const source = node('a','', 'Unsplash ↗'); external(source, 'https://unsplash.com/?utm_source=profe_lucas&utm_medium=referral');
    const credit = node('div','credit-links'); credit.append(author, document.createTextNode(' / '), source); text.append(credit);
    const arrow = node('button','selectarrow','↗'); arrow.type = 'button'; arrow.setAttribute('aria-label',`Seleccionar foto ${index + 1} de ${photo.user.name}`); arrow.addEventListener('click', () => showSelected(index));
    caption.append(text,arrow); card.append(pick,caption); gallery.append(card);
  }
  function render() {
    gallery.replaceChildren();
    items.forEach(renderOne);
    $('gallery-label').textContent = 'FOTOS PARA MATERIALES';
    $('gallery-title').replaceChildren(document.createTextNode(lastQuery),node('span','accent','.'));
    $('gallery-count').textContent = items.length ? `${String(items.length).padStart(2,'0')} fotos / Unsplash` : 'Unsplash';
    $('chosen').hidden = true; selected = null;
    setStatus(items.length ? '' : 'No encontramos fotos con ese tema. Probá otra búsqueda.');
    pagination.hidden = !next;
  }
  async function search(loadMore = false) {
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    if (controller) controller.abort();
    controller = new AbortController();
    if (!loadMore || q !== lastQuery) { page = 0; items = []; gallery.replaceChildren(); $('chosen').hidden = true; pagination.hidden = true; lastQuery = q; }
    const pending = page + 1;
    const serial = ++searchSerial;
    setStatus('Buscando fotos…'); more.disabled = true;
    try {
      const response = await fetch(`${API}search?q=${encodeURIComponent(q)}&page=${pending}`, { signal:controller.signal });
      const data = await response.json();
      if (serial !== searchSerial) return;
      if (!response.ok) throw new Error(data.error || 'No se pudo buscar en este momento.');
      const photos = (Array.isArray(data.results) ? data.results : []).filter(p => photoUrl(p.urls?.small) && safeLink(p.links?.html,'unsplash.com') && safeLink(p.user?.links?.html,'unsplash.com'));
      items.push(...photos); page = pending; next = Boolean(data.next_page); render();
    } catch (err) {
      if (serial === searchSerial && err.name !== 'AbortError') setStatus(err.message || 'No se pudo buscar. Probá de nuevo.');
    } finally { if (serial === searchSerial) more.disabled = false; }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const temp = node('textarea'); temp.value = text; temp.style.position = 'fixed'; temp.style.opacity = '0'; document.body.append(temp); temp.select();
      const ok = document.execCommand('copy'); temp.remove(); return ok;
    }
  }
  async function track(photo) {
    try { await fetch(API+'track', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:photo.id,download_location:photo.links.download_location})}); }
    catch { /* La copia debe seguir funcionando si falla el contador; no se registra información sensible. */ }
  }
  form.addEventListener('submit', e => { e.preventDefault(); search(); });
  more.addEventListener('click', () => search(true));
  $('copy-photo').addEventListener('click', async () => {
    if (!selected) return;
    const image = photoUrl(selected.urls.regular);
    if (!image) return;
    if (await copy(image)) { $('copy-photo').textContent = 'Enlace copiado ✓'; track(selected); }
    else setStatus('No pude copiar el enlace. Abrí la foto en Unsplash.');
  });
  $('copy-credit').addEventListener('click', async () => {
    if (!selected) return;
    const credit = `Foto de ${selected.user.name} (${safeLink(selected.user.links.html,'unsplash.com')}) en Unsplash (https://unsplash.com/?utm_source=${SOURCE}&utm_medium=referral).`;
    if (await copy(credit)) $('copy-credit').textContent = 'Crédito copiado ✓';
    else setStatus('No pude copiar el crédito.');
  });
})();

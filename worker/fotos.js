/**
 * Ruta exclusiva lucasramos.uy/profe/fotos/api/* (más específica que el proxy global).
 * Secreto obligatorio: UNSPLASH_ACCESS_KEY de la app "Profe Fotos".
 * Nunca publicar el valor ni las respuestas crudas con campos innecesarios.
 */
const API = 'https://api.unsplash.com';
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function allowedDownload(id,raw){
  try { const u=new URL(raw); return u.protocol==='https:' && u.hostname==='api.unsplash.com' && u.pathname===`/photos/${encodeURIComponent(id)}/download` ? u : null; }
  catch { return null; }
}
function imageUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='images.unsplash.com'?u.href:''}catch{return ''}}
function unsplashUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='unsplash.com'?u.href:''}catch{return ''}}
function pick(p){return {id:p.id,description:p.description,alt_description:p.alt_description,urls:{small:imageUrl(p.urls?.small),regular:imageUrl(p.urls?.regular)},user:{name:p.user?.name||'Fotógrafo',links:{html:unsplashUrl(p.user?.links?.html)}},links:{html:unsplashUrl(p.links?.html),download_location:allowedDownload(p.id,p.links?.download_location)?.href||''}}}
export default {
 async fetch(request,env){
  const u=new URL(request.url);
  const path=u.pathname.replace(/^\/profe\/fotos\/api\/?/,'');
  if (!u.pathname.startsWith('/profe/fotos/api/') || !['search','track'].includes(path)) return json({error:'No encontrado.'},404);
  if (!env.UNSPLASH_ACCESS_KEY) return json({error:'La búsqueda todavía no está configurada.'},503);
  const headers={'Authorization':`Client-ID ${env.UNSPLASH_ACCESS_KEY}`,'Accept-Version':'v1'};
  if (path==='search'){
   if(request.method!=='GET') return json({error:'Método no permitido.'},405);
   const q=(u.searchParams.get('q')||'').trim(); const page=Number(u.searchParams.get('page')||'1');
   if(q.length<2||q.length>80||!Number.isInteger(page)||page<1||page>20) return json({error:'Escribí un tema de 2 a 80 caracteres.'},400);
   const target=new URL('/search/photos',API); target.searchParams.set('query',q); target.searchParams.set('page',String(page));target.searchParams.set('per_page','12');
   try{
    const response=await fetch(target,{headers});
    if(response.status===429) return json({error:'Se alcanzó el límite de búsquedas. Probá más tarde.'},429);
    if(!response.ok) return json({error:'No se pudo consultar Unsplash. Probá más tarde.'},502);
    const data=await response.json();
    return json({results:(data.results||[]).map(pick),next_page:page<Math.min(Number(data.total_pages)||0,20)});
   }catch{return json({error:'No se pudo consultar Unsplash. Probá más tarde.'},502)}
  }
  if(request.method!=='POST') return json({error:'Método no permitido.'},405);
  if(Number(request.headers.get('content-length')||0)>2048) return json({error:'Solicitud demasiado grande.'},413);
  let payload;try{payload=await request.json()}catch{return json({error:'Solicitud inválida.'},400)}
  const id=payload?.id;
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{5,30}$/.test(id)) return json({error:'Foto inválida.'},400);
  const target=allowedDownload(id,payload?.download_location);
  if(!target) return json({error:'Enlace inválido.'},400);
  try { const res=await fetch(target,{headers});return res.ok?json({tracked:true}):json({error:'No se pudo registrar el uso.'},502); }
  catch{return json({error:'No se pudo registrar el uso.'},502)}
 }
};

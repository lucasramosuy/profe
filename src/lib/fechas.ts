const MESES3 = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];

// Las fechas del CMS son yyyy-MM-dd; se leen en UTC para que no corran un día.
export function fechaCorta(d: Date): string {
  return `${d.getUTCDate()} ${MESES3[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fechaLarga(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d) : d;
  if (isNaN(x.getTime())) return '';
  return `${x.getUTCDate()} de ${MESES[x.getUTCMonth()]} de ${x.getUTCFullYear()}`;
}
export function ordenarPosts<T extends { data: { fecha: Date } }>(posts: T[]): T[] {
  return posts.slice().sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime());
}

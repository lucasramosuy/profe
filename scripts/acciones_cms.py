"""Acciones Pages CMS de Profe: sin dependencia de servicios pagos."""
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
MATS = DOCS / 'materiales.json'
SUMMARY = Path(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/stdout'))
OUTPUT = Path(os.environ.get('GITHUB_OUTPUT', '/dev/null'))


def summary(line):
    with SUMMARY.open('a', encoding='utf-8') as fh:
        fh.write(line + '\n')


def output(key, value):
    with OUTPUT.open('a', encoding='utf-8') as fh:
        fh.write(f'{key}={value}\n')


def materials(text=None):
    raw = json.loads((MATS.read_text(encoding='utf-8').strip() or '{"materiales":[]}') if text is None else (text.strip() or '{"materiales":[]}'))
    rows = raw if isinstance(raw, list) else raw.get('materiales', [])
    if not isinstance(rows, list):
        raise ValueError('materiales debe ser una lista')
    return [m for m in rows if isinstance(m, dict)]


def file_path(value):
    """Only local URLs within docs/archivos are eligible for PDF conversion."""
    url = urllib.parse.urlsplit(value)
    if url.scheme or url.netloc:
        raise ValueError('El archivo debe estar en docs/archivos, no en una URL externa')
    relative = urllib.parse.unquote(url.path).lstrip('/')
    if relative.startswith('profe/'):
        relative = relative[len('profe/'):]
    if not relative.startswith('archivos/'):
        raise ValueError('El archivo debe estar en /profe/archivos/')
    full = (DOCS / relative).resolve()
    if not full.is_relative_to((DOCS / 'archivos').resolve()):
        raise ValueError('Ruta fuera de docs/archivos')
    return full


def urls():
    seen = set()
    for m in materials():
        for value in [str(m.get('archivo') or '')] + re.findall(r'https?://[^\s<>"\']+', str(m.get('descripcion') or '')):
            value = value.strip().rstrip('.,;')
            if value and value not in seen:
                seen.add(value)
                yield value


def valid_external(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname:
        raise ValueError('URL inválida')
    if parsed.hostname.lower() in ('localhost', 'metadata.google.internal') or parsed.hostname.lower().endswith('.local'):
        raise ValueError('Host interno no permitido')
    # Prevent link checker from reaching private networks, including DNS names
    # resolving to a private address. Redirects are disabled below.
    for address in socket.getaddrinfo(parsed.hostname, None):
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise ValueError('Red interna no permitida')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirección: revisá el enlace de destino manualmente')


URL_OPENER = urllib.request.build_opener(NoRedirect)


def check_links():
    broken = []
    checked = 0
    for value in urls():
        checked += 1
        try:
            if value.startswith(('/profe/', 'archivos/')):
                path = file_path(value)
                if not path.is_file():
                    raise ValueError('No existe en docs/archivos')
            elif value.startswith(('https://', 'http://')):
                valid_external(value)
                # No redirects to internal networks; keep checks bounded to public links.
                req = urllib.request.Request(value, method='HEAD', headers={'User-Agent': 'Profe-LinkCheck/1.0'})
                try:
                    with URL_OPENER.open(req, timeout=10) as response:
                        status = response.status
                except urllib.error.HTTPError as exc:
                    if exc.code not in (405, 501, 403):
                        raise
                    req = urllib.request.Request(value, method='GET', headers={'User-Agent': 'Profe-LinkCheck/1.0'})
                    with URL_OPENER.open(req, timeout=10) as response:
                        status = response.status
                if status >= 400:
                    raise ValueError(f'HTTP {status}')
            else:
                raise ValueError('URL relativa no compatible')
        except (ValueError, OSError, urllib.error.URLError, socket.gaierror) as exc:
            broken.append((value, str(exc)))
    summary(f'## Enlaces de materiales\n\n{checked} revisados, {len(broken)} con problemas.\n')
    for url, reason in broken:
        summary(f'- `{url}`: {reason}')
    if broken:
        raise RuntimeError('Hay enlaces para revisar. Consultá el resumen del run.')


def optimize():
    saved = 0
    count = 0
    for path in (DOCS / 'archivos').rglob('*'):
        if not path.is_file() or path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        before = path.stat().st_size
        with tempfile.NamedTemporaryFile(suffix=path.suffix, delete=False) as tmp:
            candidate = Path(tmp.name)
        try:
            with Image.open(path) as img:
                if img.format == 'JPEG':
                    img.save(candidate, format='JPEG', quality='keep', subsampling='keep', qtables='keep', optimize=True,
                             exif=img.info.get('exif', b''), icc_profile=img.info.get('icc_profile'))
                elif img.format == 'PNG':
                    img.save(candidate, format='PNG', optimize=True, icc_profile=img.info.get('icc_profile'))
                elif img.format == 'WEBP':
                    img.save(candidate, format='WEBP', lossless=True, exact=True, method=6,
                             icc_profile=img.info.get('icc_profile'), exif=img.info.get('exif'))
                if candidate.stat().st_size < before:
                    with Image.open(candidate) as check:
                        check.verify()
                    shutil.copyfile(candidate, path)
                    saved += before - path.stat().st_size
                    count += 1
        finally:
            candidate.unlink(missing_ok=True)
    summary(f'## Imágenes\n\n{count} optimizadas; {saved} bytes ahorrados. No se cambió ninguna dimensión ni se reemplazó una imagen por una más pesada.')
    output('optimized', str(count > 0).lower())


def send_telegram(rows):
    token = os.environ.get('TELEGRAM_TOKEN')
    chat = os.environ.get('TELEGRAM_CHAT_ID')
    if not rows:
        summary('## Telegram\n\nNo hay materiales nuevos: no se envió aviso.')
        return
    if not token or not chat:
        raise RuntimeError('Faltan los secrets TELEGRAM_TOKEN y TELEGRAM_CHAT_ID del repositorio')
    parts = ['Profe · materiales nuevos']
    for m in rows[:10]:
        title = str(m.get('titulo') or 'Sin título').strip()[:140]
        course = str(m.get('curso') or '').strip()[:80]
        file = str(m.get('archivo') or '').strip()
        parts.append(f'• {title}' + (f' ({course})' if course else '') + (f'\n{urllib.parse.urljoin("https://lucasramos.uy/profe/", file)}' if file.startswith(('/profe/', 'archivos/')) else ''))
    if len(rows) > 10:
        parts.append(f'... y {len(rows) - 10} más')
    body = '\n\n'.join(parts)[:3900]
    req = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage',
        data=json.dumps({'chat_id': chat, 'text': body, 'disable_web_page_preview': True}).encode(),
        headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.load(resp)
            if not result.get('ok'):
                raise RuntimeError('Telegram rechazó el aviso')
    except urllib.error.HTTPError as exc:
        # The request URL contains the bot token: never print the exception.
        raise RuntimeError(f'Telegram respondió HTTP {exc.code}') from None
    except urllib.error.URLError:
        raise RuntimeError('No se pudo contactar a Telegram') from None
    summary(f'## Telegram\n\nAviso enviado: {len(rows)} material(es).')


def printable(title):
    matches = [m for m in materials() if str(m.get('titulo', '')).strip().casefold() == title.strip().casefold()]
    if len(matches) != 1:
        raise ValueError('El título debe coincidir con exactamente un material de materiales.json')
    src = file_path(str(matches[0].get('archivo') or ''))
    if not src.is_file():
        raise FileNotFoundError(src)
    target = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'profe-imprimible.pdf'
    ext = src.suffix.lower()
    if ext == '.pdf':
        shutil.copyfile(src, target)
    elif ext in ('.jpg', '.jpeg', '.png', '.webp'):
        with Image.open(src) as img:
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            img.save(target, 'PDF', resolution=150)
    elif ext in ('.doc', '.docx', '.odt', '.ppt', '.pptx', '.odp'):
        subprocess.run(['sudo', 'apt-get', 'update', '-qq'], check=True)
        subprocess.run(['sudo', 'apt-get', 'install', '-y', '-qq', 'libreoffice-writer', 'libreoffice-impress'], check=True)
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(['libreoffice', '-env:UserInstallation=file:///tmp/profe-lo-' + str(os.getpid()), '--headless',
                            '--convert-to', 'pdf', '--outdir', directory, str(src)], check=True, timeout=120)
            shutil.copyfile(Path(directory) / (src.stem + '.pdf'), target)
    else:
        raise ValueError(f'No se puede convertir {ext} a PDF; subí un PDF o imagen, o un DOC/PPT compatible')
    if not target.is_file() or target.stat().st_size == 0:
        raise RuntimeError('No se generó el PDF')
    output('pdf_path', target)
    summary(f'## Imprimible\n\nPDF de **{title}** adjunto como artefacto del run (7 días).')


def main():
    event = os.environ.get('EVENT_NAME')
    if event == 'push':
        try:
            old = subprocess.check_output(['git', 'show', 'HEAD^:docs/materiales.json'], text=True)
            prev = materials(old)
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            prev = []
        signatures = {(str(x.get('titulo')), str(x.get('archivo'))) for x in prev}
        new = [m for m in materials() if (str(m.get('titulo')), str(m.get('archivo'))) not in signatures]
        send_telegram(new)
        return
    payload = json.loads(os.environ.get('CMS_PAYLOAD') or '{}')
    if payload.get('source') != 'pages-cms' or payload.get('repository', {}).get('repo') != 'profe':
        raise ValueError('Este workflow se ejecuta con un botón de Pages CMS del repo profe')
    action = payload.get('action', {}).get('name')
    if action == 'validar-enlaces':
        check_links()
    elif action == 'optimizar-imagenes':
        optimize()
    elif action == 'aviso-telegram':
        send_telegram(materials())
    elif action == 'imprimible':
        printable(str(payload.get('inputs', {}).get('titulo') or ''))
    else:
        raise ValueError('Acción desconocida')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        summary(f'\n**Error:** {exc}')
        print(f'Error: {exc}', file=sys.stderr)
        sys.exit(1)

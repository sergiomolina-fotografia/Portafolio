const SUPABASE_URL = 'https://zbixojacwvanucxlrdcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiaXhvamFjd3ZhbnVjeGxyZGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzgxMzQsImV4cCI6MjEwNDExNDEzNH0.Wz35IGTGzdHuHOm2EbTsGSLBZfhw67Wt7UXBbMXek68';
const DEFAULT_IMAGE = 'https://lh3.googleusercontent.com/d/1A6PFi2lpp_VNhnmtTYGkYXyjMZ1p8LhA';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeDriveImage(url) {
  if (!url) return '';
  const s = String(url).trim();
  const match = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1] && !s.includes('lh3.googleusercontent.com')) {
    return `https://lh3.googleusercontent.com/d/${match[1]}=w1200`;
  }
  return s;
}

export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const reqUrl = new URL(request.url);
  const paramId = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('folder') || '';
  const paramTitulo = reqUrl.searchParams.get('titulo') || '';

  let ogTitle = paramTitulo ? `${paramTitulo} | Sergio Ricardo Molina` : 'Galería Oficial | Sergio Ricardo Molina';
  let ogDesc = 'Cobertura fotográfica oficial. Ingresá para ver y encargar tus fotos en alta calidad.';
  let ogImage = DEFAULT_IMAGE;

  if (paramId) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${SUPABASE_URL}/rest/v1/galeria?select=id,titulo,portada_url,portada,drive_url,es_privada&limit=100`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          const match = rows.find(r =>
            String(r.id) === String(paramId) ||
            (r.drive_url && String(r.drive_url).includes(paramId))
          );

          if (match) {
            if (match.titulo && !paramTitulo) {
              ogTitle = `${match.titulo} | Sergio Ricardo Molina`;
            } else if (match.titulo) {
              ogTitle = `${match.titulo} | Sergio Ricardo Molina`;
            }
            const rawCover = match.portada_url || match.portada || '';
            const normalizedCover = normalizeDriveImage(rawCover);
            if (normalizedCover) {
              ogImage = normalizedCover;
            }
          }
        }
      }
    } catch (_) {
      // Fallback silencioso a la imagen/título por defecto
    }
  }

  let html = await response.text();
  const metaTags = `
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Sergio Ricardo Molina · Fotografía Profesional"/>
<meta property="og:title" content="${escapeHtml(ogTitle)}"/>
<meta property="og:description" content="${escapeHtml(ogDesc)}"/>
<meta property="og:image" content="${escapeHtml(ogImage)}"/>
<meta property="og:url" content="${escapeHtml(reqUrl.toString())}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(ogTitle)}"/>
<meta name="twitter:description" content="${escapeHtml(ogDesc)}"/>
<meta name="twitter:image" content="${escapeHtml(ogImage)}"/>
</head>`;

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(ogTitle)}</title>`);
  html = html.replace(/<\/head>/i, metaTags);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    headers
  });
};

import fs from 'fs';
import path from 'path';
import { getData } from './_storage.js';

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  const quizId = String((req.query && req.query.id) || '').trim();
  const htmlPath = path.join(process.cwd(), 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  let title = 'Уютные интерактивы';
  let description = 'Осенне-зимние квизы, маршруты и таблица лидеров';

  if (quizId) {
    try {
      const quizzes = await getData('quizzes', []);
      const found = quizzes.find(q => q.id === quizId && !q.hidden);
      if (found) {
        title = `${found.title} — Уютные интерактивы`;
        description = `${found.badge} • ${found.description} (Автор: ${found.author || 'Iakov'})`;
      }
    } catch {
      // fallback to default meta tags
    }
  }

  const safeTitle = escapeAttr(title);
  const safeDesc = escapeAttr(description);
  const ogTags = `
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />`;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, ogTags);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}
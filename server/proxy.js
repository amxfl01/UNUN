import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8787;

// Allow local dev origin; tighten this in production.
app.use(cors({ origin: true }));
app.use(express.json());

const NOTION_API_BASE = 'https://api.notion.com/v1/';
const NOTION_TOKEN = process.env.NOTION_SECRET || '';

if (!NOTION_TOKEN) {
  console.warn('Warning: NOTION_SECRET env var not set. Set it before running the proxy.');
}

app.all('/api/:path(*)', async (req, res) => {
  const path = req.params.path || '';
  // 헬스체크는 프록시에서 바로 응답합니다.
  if (path === 'health') {
    return res.json({ ok: true, message: 'proxy ok' });
  }

  const url = NOTION_API_BASE + path;

  try {
    const headers = {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (['POST','PUT','PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body || {});
    }

    const r = await fetch(url, fetchOptions);
    const text = await r.text();
    res.status(r.status);
    // try to parse JSON, otherwise send raw
    try { res.json(JSON.parse(text)); } catch (e) { res.send(text); }
  } catch (err) {
    console.error('Proxy Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 간단한 헬스체크 엔드포인트 (클라이언트에서 프록시 연결 확인용)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'proxy ok' });
});

// 기본 루트 핸들러: 브라우저에서 /로 접속했을 때 친절한 메시지를 보여줍니다.
app.get('/', (req, res) => {
  res.type('text').send(`Notion proxy running. Use /api/<notion-path> to forward requests to Notion API. Example: POST /api/databases/<DB_ID>/query`);
});

app.listen(PORT, () => {
  console.log(`Notion proxy running on http://localhost:${PORT} (forwarding to ${NOTION_API_BASE})`);
});

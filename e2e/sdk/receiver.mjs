/**
 * Tiny webhook receiver — listens on :6001 and records every POST body.
 * Run as a child process from fake-customer.mjs.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.WH_PORT ?? 6001);
const received = [];

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const event = {
      ts: Date.now(),
      url: req.url,
      headers,
      body,
      json: tryJson(body),
    };
    received.push(event);
    console.log(`[receiver] ${headers['webhook-event'] ?? '?'} → ${req.url} (${body.length}b)`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(PORT, () => console.log(`[receiver] listening on :${PORT}`));

function tryJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// Expose received events to the parent via stdin command.
process.stdin.on('data', (chunk) => {
  const cmd = chunk.toString().trim();
  if (cmd === 'DUMP') {
    process.stdout.write(`__EVENTS__${JSON.stringify(received)}__EOE__\n`);
  } else if (cmd === 'CLEAR') {
    received.length = 0;
    process.stdout.write('__CLEARED__\n');
  } else if (cmd === 'STOP') {
    server.close(() => process.exit(0));
  }
});

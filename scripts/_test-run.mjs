import { readFileSync, existsSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = t.slice(i + 1).trim();
  }
}

const base = 'http://localhost:3011';
const key = process.env.BABYCHAIN_API_KEY;

const input = {
  image_model: 'bfl/flux-1.1-pro',
  image_model_input: { prompt: 'A baby seal on Arctic ice, cinematic' },
  video_model: 'bytedance/seedance-1-pro',
  video_model_input: { prompt: 'Slow cinematic dolly-in', duration: 5 },
};

console.log('POST /api/v1/chains/runs ...');
const res = await fetch(`${base}/api/v1/chains/runs`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ input }),
});
console.log('status:', res.status);
const body = await res.text();
console.log('body:', body.slice(0, 1500));

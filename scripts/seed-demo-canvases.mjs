// Seed demo canvases into Aurora for the hackathon judges.
// Idempotent: fixed UUIDs, upsert via saveCanvas-equivalent SQL.
import pg from 'pg';

const OWNER = process.env.OWNER_EMAIL?.trim().toLowerCase();
if (!OWNER || !process.env.DATABASE_URL) {
  console.error('OWNER_EMAIL and DATABASE_URL are required (.env.local).');
  process.exit(1);
}

// Canvas node values use the Semantic Lady generation_* contract.
const CANVASES = [
  {
    id: 'a1b2c3d4-0001-4a00-9a00-000000000001',
    title: 'Product ad: soda bottle → cinematic dolly',
    nodes: [
      {
        id: 'image-seed-1',
        role: 'image',
        modelId: 'bfl/flux-1.1-pro',
        values: {
          generation_prompt:
            'Glass bottle of sparkling aurora-blue soda on wet black slate, studio product photography, soft rim light',
        },
        position: { x: 40, y: 120 },
      },
      {
        id: 'video-seed-1',
        role: 'video',
        modelId: 'wan/2.7-i2v-2026-04-25',
        values: {
          generation_duration: 5,
          generation_prompt:
            'Slow cinematic dolly-in on the bottle, tiny bubbles rising, soft mist drifting',
        },
        position: { x: 620, y: 120 },
      },
    ],
  },
  {
    id: 'a1b2c3d4-0002-4a00-9a00-000000000002',
    title: 'Ramen shop: generate → refine → animate',
    nodes: [
      {
        id: 'image-seed-2',
        role: 'image',
        modelId: 'z/image-turbo',
        values: {
          generation_prompt:
            'Cozy ramen shop exterior at night in the rain, warm lantern light, puddle reflections',
        },
        position: { x: 40, y: 120 },
      },
      {
        id: 'refine-seed-2',
        role: 'refine',
        modelId: 'qwen/image-edit',
        values: {
          generation_prompt:
            'Add a glowing neon sign above the door and enhance the puddle reflections',
        },
        position: { x: 620, y: 120 },
      },
      {
        id: 'video-seed-2',
        role: 'video',
        modelId: 'runway/gen-4-turbo',
        values: {
          generation_aspect_ratio: '1280:720',
          generation_duration: 5,
          generation_prompt:
            'Gentle camera pan to the right while rain keeps falling, lanterns flicker softly',
        },
        position: { x: 1200, y: 120 },
      },
    ],
  },
  {
    id: 'a1b2c3d4-0003-4a00-9a00-000000000003',
    title: 'Robot barista: full 4-step chain with video modify',
    nodes: [
      {
        id: 'image-seed-3',
        role: 'image',
        modelId: 'runway/gen-4-image',
        values: {
          generation_aspect_ratio: '1920:1080',
          generation_prompt:
            'A tiny friendly robot barista pouring latte art in a warm sunlit cafe',
        },
        position: { x: 40, y: 120 },
      },
      {
        id: 'refine-seed-3',
        role: 'refine',
        modelId: 'bfl/flux-2-flex',
        values: {
          generation_prompt:
            'Keep the composition but add warm window light and soft steam in the air',
        },
        position: { x: 620, y: 120 },
      },
      {
        id: 'video-seed-3',
        role: 'video',
        modelId: 'runway/gen-4-turbo',
        values: {
          generation_aspect_ratio: '1280:720',
          generation_duration: 5,
          generation_prompt:
            'The robot pours steamed milk forming a heart shape, gentle steam rising',
        },
        position: { x: 1200, y: 120 },
      },
      {
        id: 'modify-seed-3',
        role: 'modify',
        modelId: 'runway/gen-4-aleph',
        values: {
          generation_prompt:
            'Regrade the video with cinematic teal and orange tones, add soft window light',
        },
        position: { x: 1780, y: 120 },
      },
    ],
  },
];

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

for (const canvas of CANVASES) {
  await client.query(
    `insert into babychain_private.canvas (id, owner_email, title, nodes)
     values ($1, $2, $3, $4::jsonb)
     on conflict (id) do update
        set title = excluded.title,
            nodes = excluded.nodes
      where babychain_private.canvas.owner_email = excluded.owner_email`,
    [canvas.id, OWNER, canvas.title, JSON.stringify(canvas.nodes)],
  );
  console.log(`seeded: ${canvas.title} (${canvas.id})`);
}

const { rows } = await client.query(
  `select id, title, jsonb_array_length(nodes) as node_count, updated_at
     from babychain_private.canvas where owner_email = $1 order by updated_at desc`,
  [OWNER],
);
console.table(
  rows.map((r) => ({ id: r.id, title: r.title, nodes: r.node_count })),
);
await client.end();

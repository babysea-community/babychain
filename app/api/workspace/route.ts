import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth/owner';
import { saveCanvas, saveWorkspaceCanvas } from '@/lib/canvas/canvas-store';
import type { StoredCanvasNode } from '@/lib/canvas/canvas-library';
import { jsonError, jsonOk } from '@/lib/security/http';
import { BabyChainError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/workspace
 *
 * Final-flush endpoint for the canvas. The canvas autosaves through a server
 * action while the page is open; this route exists for `navigator.sendBeacon`
 * on pagehide, which cannot call server actions. With a `canvas` target it
 * flushes a saved (Library) canvas; without one it flushes the owner's
 * workspace scratchpad. Owner session cookie required — no API key surface.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      throw new BabyChainError('unauthorized', 'Sign in required.', 401);
    }

    const body = (await request.json().catch(() => null)) as {
      nodes?: StoredCanvasNode[];
      canvas?: { id?: string; title?: string };
    } | null;

    if (!body || !Array.isArray(body.nodes)) {
      throw new BabyChainError(
        'invalid_canvas',
        'Body must include a nodes array.',
        400,
      );
    }

    if (body.canvas && typeof body.canvas.id === 'string') {
      await saveCanvas(session.email, {
        id: body.canvas.id,
        title:
          typeof body.canvas.title === 'string' && body.canvas.title.trim()
            ? body.canvas.title
            : 'Canvas',
        nodes: body.nodes,
      });
    } else {
      await saveWorkspaceCanvas(session.email, body.nodes);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return await jsonError(error);
  }
}

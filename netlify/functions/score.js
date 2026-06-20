import { getStore } from '@netlify/blobs';

export const config = { path: '/api/score' };

export default async (req) => {
  const store = getStore('scores');

  // ===== GUARDAR (fin de partida) =====
  if (req.method === 'POST') {
    const d = await req.json();
    const token = (d.token || 'x').toString();
    const id = token + '-' + Date.now().toString(36);
    const rec = {
      id,
      email: (d.email || '').toLowerCase().trim(),
      score: +d.score || 0,
      coins: +d.coins || 0,
      team: d.team || '',
      events: d.events || {},
      token,                         // ← ahora lo guardamos explícito
      redeemed: false,
      redeemedAt: null,
      date: new Date().toISOString()
    };
    await store.setJSON(id, rec);
    return Response.json({ ok: true, id, rec });
  }

  // ===== LEER (verificación en caja) o RANKING GLOBAL =====
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id');
    if (id) {
      const r = await store.get(id, { type: 'json' });
      return r ? Response.json(r) : new Response('not found', { status: 404 });
    }
    // Sin id → top 50 global (ranking)
    const { blobs } = await store.list();
    const all = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' }))))
      .filter(Boolean);                         // descarta nulos por si se borró un blob
    all.sort((a, b) => (b.score || 0) - (a.score || 0));
    return Response.json(all.slice(0, 50));
  }

  // ===== MARCAR CANJEADO (con PIN de cajero) =====
  if (req.method === 'PUT') {
    // PIN: configurá CASHIER_PIN en Netlify > Site settings > Environment variables.
    // Si NO definís CASHIER_PIN, el PUT funciona sin pedir PIN (como antes).
    const requiredPin = process.env.CASHIER_PIN;
    if (requiredPin) {
      const sentPin = req.headers.get('x-cashier-pin') || '';
      if (sentPin !== requiredPin) {
        return Response.json({ ok: false, error: 'invalid pin' }, { status: 403 });
      }
    }

    const id = new URL(req.url).searchParams.get('id');
    const r = await store.get(id, { type: 'json' });
    if (!r) return new Response('404', { status: 404 });

    // Anti-fraude: no sobrescribir la marca si ya estaba canjeado
    if (!r.redeemed) {
      r.redeemed = true;
      r.redeemedAt = new Date().toISOString();
      await store.setJSON(id, r);
    }
    return Response.json({ ok: true, rec: r });
  }

  return new Response('405', { status: 405 });
};

import { getStore } from '@netlify/blobs';
export const config = { path: '/api/score' };
export default async (req) => {
const store = getStore('scores');
if (req.method === 'POST') {
  const d = await req.json();
  const id = (d.token||'x')+'-'+Date.now().toString(36);
  const rec = { id, email:(d.email||'').toLowerCase(), score:+d.score||0,
    coins:+d.coins||0, team:d.team||'', events:d.events||{}, redeemed:false, date:new Date().toISOString() };
  await store.setJSON(id, rec);
  return Response.json({ ok:true, id, rec });
}
if (req.method === 'GET') {
  const id = new URL(req.url).searchParams.get('id');
  if (id) { const r = await store.get(id,{type:'json'});
    return r ? Response.json(r) : new Response('not found',{status:404}); }
  const { blobs } = await store.list();
  const all = await Promise.all(blobs.map(b=>store.get(b.key,{type:'json'})));
  all.sort((a,b)=>b.score-a.score);
  return Response.json(all.slice(0,50));
}
if (req.method === 'PUT') {
  const id = new URL(req.url).searchParams.get('id');
  const r = await store.get(id,{type:'json'});
  if(!r) return new Response('404',{status:404});
  r.redeemed=true; r.redeemedAt=new Date().toISOString();
  await store.setJSON(id,r); return Response.json({ok:true,rec:r});
}
return new Response('405',{status:405});
};

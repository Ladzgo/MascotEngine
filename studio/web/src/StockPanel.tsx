import React, {useEffect, useState} from 'react';
import {api} from './api';

/** Licensed b-roll: paste a Pixabay key (saved to .env, never shown again) and test it. Without a key Openverse and Wikimedia Commons are used. */
export function StockPanel() {
  const [has, setHas] = useState<boolean | null>(null), [key, setKey] = useState(''), [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { api.stockStatus().then(s => setHas(s.pixabay)).catch(() => setHas(false)); }, []);
  const save = async () => { setBusy(true); try { await api.stockKey(key.trim()); setKey(''); setHas(true); setMsg({ok: true, text: 'Saved to .env on this machine.'}); } catch (e) { setMsg({ok: false, text: (e as Error).message}); } finally { setBusy(false); } };
  const test = async () => { setBusy(true); try { const r = await api.stockTest(); setMsg({ok: r.ok, text: r.message}); } catch (e) { setMsg({ok: false, text: (e as Error).message}); } finally { setBusy(false); } };
  return (
    <div className="ready" aria-label="Stock footage">
      <h2 className="label">Licensed stock photos and videos</h2>
      <p className="small muted">Pixabay (free key, photos and videos): {has ? 'key saved' : 'no key yet'}. Without a key the video falls back to Openverse and Wikimedia Commons (CC0, public domain, CC BY with credit lines in the description).</p>
      <label className="field"><span>Pixabay API key (optional)</span>
        <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={has ? 'Saved. Type to replace.' : 'Paste your key from pixabay.com/api/docs'} />
      </label>
      <div className="row">
        <button type="button" className="btn sm" disabled={busy || !key.trim()} onClick={() => void save()}>Save key</button>
        <button type="button" className="btn sm" disabled={busy || !has} onClick={() => void test()}>Test key</button>
      </div>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role="status">{msg.text}</p>}
    </div>
  );
}

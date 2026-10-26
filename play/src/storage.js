// localStorage wrapper. Every access is guarded: blocked or corrupt storage falls back to defaults.
export const SAVE_KEY = 'puffling-flight.v1';
export const DEFAULTS = Object.freeze({ best: 0, lang: null, muted: false, sfx: true, music: true, reduceMotion: null });

export function loadSave(storage) {
  const out = { ...DEFAULTS };
  try {
    const s = storage || globalThis.localStorage;
    const o = JSON.parse(s.getItem(SAVE_KEY) || '{}') || {};
    if (Number.isInteger(o.best) && o.best >= 0 && o.best < 1e6) out.best = o.best;
    if (o.lang === 'en' || o.lang === 'zh') out.lang = o.lang;
    for (const k of ['muted', 'sfx', 'music']) if (typeof o[k] === 'boolean') out[k] = o[k];
    if (typeof o.reduceMotion === 'boolean') out.reduceMotion = o.reduceMotion;
  } catch (e) { /* keep defaults */ }
  return out;
}

export function writeSave(data, storage) {
  try {
    const s = storage || globalThis.localStorage;
    s.setItem(SAVE_KEY, JSON.stringify({
      best: data.best, lang: data.lang, muted: data.muted, sfx: data.sfx, music: data.music, reduceMotion: data.reduceMotion,
    }));
    return true;
  } catch (e) {
    return false;
  }
}

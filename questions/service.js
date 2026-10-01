'use strict';
const rules = require('./rules');
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const stop = new Set('quem qual que o a os as de do da dos das em um uma e se ao para por com mais menos seria teria voce voces parceiro pessoa primeiro melhor muito mesmo quando como'.split(' '));
function tokens(text) {
  // Reviewed paraphrases from the catalog; this is intentionally not a general thesaurus.
  const value = normalize(text).replace(/sente (?:mais )?falta de carinho|sente (?:mais )?saudade/g, 'saudade');
  return new Set(value.split(' ').filter(t => !stop.has(t)));
}
function similar(a, b) {
  if (normalize(a) === normalize(b)) return true;
  const x = tokens(a), y = tokens(b);
  const common = [...x].filter(t => y.has(t)).length;
  return common > 0 && (common / Math.max(1, x.size + y.size - common) >= .58 || common / Math.max(1, Math.min(x.size, y.size)) >= .85);
}
function valid(q, mode) {
  if (!q || typeof q.text !== 'string' || q.text.length < 12 || q.text.length > 260 || /undefined|null|[<>{}]/.test(q.text)) return false;
  if (mode === 'duelo') return Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.trim()) && new Set(q.options.map(normalize)).size === 4;
  return /\bquem\b|qual pessoa|com quem/i.test(q.text) && q.text.endsWith('?');
}
function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
/** Provider contract: candidates(context) -> synchronous array of validated candidates.
 * A future optional adapter belongs behind this boundary; no network, key or AI today.
 * Provider failures, invalid combinations and exhaustion all fall back to the catalog.
 */
function buildQuestions({ context, catalog, count, decorate = q => q, provider = rules, random = Math.random }) {
  const result = [], families = new Set();
  function add(q) {
    if (!valid(q, context.mode) || (q.family && families.has(q.family)) || result.some(p => similar(p.text, q.text))) return false;
    const item = decorate(q);
    if (!item) return false;
    result.push(item); if (q.family) families.add(q.family); return true;
  }
  let generated = [];
  try { generated = provider.candidates(context); if (!Array.isArray(generated)) generated = []; } catch { /* catalog fallback */ }
  const fresh = shuffled(generated, random);
  const target = Math.ceil(count * .4);
  for (const q of fresh) { if (result.length >= target) break; add(q); }
  for (const q of shuffled(catalog, random)) { if (result.length >= count) break; add(q); }
  // Fill short themed/tension sets with other approved families, never repeated paraphrases.
  for (const q of fresh) { if (result.length >= count) break; add(q); }
  return shuffled(result, random);
}
module.exports = { buildQuestions, valid, similar, normalize };

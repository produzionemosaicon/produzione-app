/* ═══ VERIFICA PIANO: le paia pianificate nelle prossime settimane si possono fare? ═══
   Funzioni pure (nessun accesso al database). Per ogni riga del Piano con paia ancora da produrre nella finestra
   controlla: materiali, sblocchi (stesse regole di alerts.js), articolo senza riga Sblocchi, consegna scaduta.
   In più confronta le paia pianificate per settimana con il ritmo medio di taglio e giunteria degli ultimi giorni.
   Gravità: «rosso» = il problema c'è già oggi rispetto all'inizio piano; «giallo» = da chiarire o in arrivo. */
import { calcolaAlert, lunedi } from "./alerts.js";

const DAY = 864e5;
const up = (x) => String(x ?? "").trim().toUpperCase();
const squash = (x) => up(x).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "");
export const MAT = [["pe", "pellame"], ["fo", "fodera"], ["so", "sottopiede"], ["su", "suola"], ["ta", "tacco"]];

export function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-${String(w).padStart(2, "0")}`;
}
const addWeeks = (key, n) => isoWeekKey(new Date(lunedi(key).getTime() + n * 7 * DAY + 12 * 36e5));

// «WK42/43 …» → settimana ISO più vicina nel futuro/passato recente (es. WK02 a novembre = 2027-02)
function settimanaMateriale(txt, curKey) {
  const m = /WK\s*(\d{1,2})/i.exec(String(txt || ""));
  if (!m) return null;
  const n = +m[1], cy = +curKey.slice(0, 4), cw = +curKey.slice(5);
  const y = n < cw - 26 ? cy + 1 : cy;
  return `${y}-${String(n).padStart(2, "0")}`;
}
function statoMateriale(txt, curKey, inizioKey) {
  const t = up(txt);
  if (!t || ["OK", "EOK", "/", "NS", "-", "—"].includes(t)) return null;
  const wk = settimanaMateriale(t, curKey);
  if (!wk) return { livello: "giallo", testo: "da chiarire: " + String(txt).trim().slice(0, 60) };
  if (wk > inizioKey) return { livello: "rosso", testo: `arriva W${wk.slice(5)}, dopo l'inizio piano (W${inizioKey.slice(5)})` };
  if (wk <= curKey) return { livello: "rosso", testo: `atteso W${wk.slice(5)}, non confermato OK` };
  return { livello: "giallo", testo: `atteso W${wk.slice(5)}` };
}

export function mediaSettimanale(tg, oggi, giorni = 30) {
  const da = new Date(oggi); da.setDate(da.getDate() - giorni);
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const rows = Object.entries(tg || {}).filter(([d, v]) => d >= f(da) && d <= f(oggi) && v).map(([, v]) => v);
  const avg = (k) => { const xs = rows.map((v) => +v[k] || 0).filter((x) => x > 0); return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) * 5 : 0; };
  return { taglio: Math.round(avg("taglio")), giunteria: Math.round(avg("giunteria")), giorni: rows.length };
}

export function verificaPiano({ righe = {}, sblocchi = {}, tg = {}, oggi = new Date(), settimane = 4 } = {}) {
  const cur = isoWeekKey(oggi);
  const finestra = Array.from({ length: settimane }, (_, i) => addWeeks(cur, i));
  const al = calcolaAlert({ righe, sblocchi, oggi });
  const sblPer = new Map(al.sblocchi.map((x) => [squash(x.marchio) + "|" + squash(x.art), x]));
  const senza = new Set(al.senzaSblocco.map((x) => squash(x.marchio) + "|" + squash(x.art)));
  const scad = new Map(al.scaduti.map((x) => [x.id, x]));

  const perSett = Object.fromEntries(finestra.map((k) => [k, { paia: 0 }]));
  const out = [];
  Object.entries(righe).forEach(([id, r]) => {
    const daProd = (+r.q || 0) - (+r.sp || 0) - (+r.g || 0);
    const pian = finestra.map((k) => [k, +(r.w || {})[k] || 0]).filter(([, v]) => v > 0);
    if (daProd <= 0 || !pian.length) return;
    pian.forEach(([k, v]) => { perSett[k].paia += v; });
    const inizio = pian[0][0], paia = pian.reduce((s, [, v]) => s + v, 0);
    const prob = [];
    const m = r.m || {};
    MAT.forEach(([k, nome]) => { const s = statoMateriale(m[k], cur, inizio); if (s) prob.push({ tipo: "materiale", livello: s.livello, testo: `${nome}: ${s.testo}` }); });
    const key = squash(r.b) + "|" + squash(r.a);
    const sb = sblPer.get(key);
    if (sb) prob.push({ tipo: "sblocco", livello: sb.livello, testo: "sblocchi mancanti: " + sb.voci.map((v) => v.tipo.toLowerCase()).join(", ") });
    else if (senza.has(key)) prob.push({ tipo: "senza-sblocco", livello: "giallo", testo: "articolo senza riga nel foglio Sblocchi" });
    const sc = scad.get(id);
    if (sc) prob.push({ tipo: "scaduto", livello: "rosso", testo: `consegna ${sc.consegna.slice(8)}/${sc.consegna.slice(5, 7)} già passata (+${sc.giorni} gg)` });
    out.push({ id, calz: r.c, marchio: r.b, art: r.a, col: r.k, stag: r.s, bl: r.bl, riga: r.r, consegna: r.d, inizio, paia, prob,
      livello: prob.some((p) => p.livello === "rosso") ? "rosso" : prob.length ? "giallo" : "ok" });
  });

  const cap = mediaSettimanale(tg, oggi);
  const sett = finestra.map((k) => {
    const p = perSett[k].paia;
    return { key: k, paia: p, capTaglio: cap.taglio, capGiunteria: cap.giunteria,
      sopra: cap.taglio > 0 && p > Math.min(cap.taglio, cap.giunteria || cap.taglio) * 1.1 };
  });
  const rank = { rosso: 0, giallo: 1, ok: 2 };
  out.sort((a, b) => rank[a.livello] - rank[b.livello] || b.paia - a.paia);
  const paiaTot = out.reduce((s, x) => s + x.paia, 0);
  const paiaA = (liv) => out.filter((x) => x.livello === liv).reduce((s, x) => s + x.paia, 0);
  return { settimanaCorrente: cur, finestra, righe: out, sett, cap, paiaTot, paiaRosso: paiaA("rosso"), paiaGiallo: paiaA("giallo"), paiaOk: paiaA("ok") };
}

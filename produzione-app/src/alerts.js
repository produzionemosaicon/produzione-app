/* ═══ ALERT del piano: ordini scaduti e sblocchi in ritardo ═══
   Funzioni pure (nessun accesso al database): prendono le righe del Piano e le righe del foglio Sblocchi.

   Regole (concordate con Stefano, 11/11/2026):
   - ORDINI SCADUTI: la riga d'ordine del Piano ha una data di consegna (campo d) già passata e ci sono
     ancora paia non spedite (q − sp > 0).
   - SBLOCCHI: rispetto all'inizio del piano di una riga (prima settimana con paia pianificate):
       · TAGLIO: va sbloccato 6–8 settimane prima. Da 8 a 6 settimane = «da sbloccare» (giallo),
         meno di 6 settimane = «in ritardo» (rosso).
       · COMPONENTI (forma, sperone, sottopiede, scasso, fussbett, tacco, suola): almeno 8 settimane prima.
         Da 10 a 8 settimane = «in scadenza» (giallo), meno di 8 = «in ritardo» (rosso).
   - L'articolo del Piano si abbina alla riga Sblocchi con lo stesso marchio e lo stesso codice
     (confronto senza spazi né punteggiatura). Gli articoli senza abbinamento sono elencati a parte. */

export const SBL_COMP = ["FORMA", "SPERONE", "SOTTOPIEDE", "SCASSO", "FUSSBETT", "TACCO", "SUOLA"];
export const SOGLIA = { tagliMax: 8, tagliMin: 6, compMin: 8, compAvviso: 10 };

const DAY = 864e5;
const up = (x) => String(x ?? "").trim().toUpperCase();
const squash = (x) => up(x).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "");

// stesso criterio di SbloccoTab: OK/ESISTE = sbloccato, «—» = non serve, resto = da fare / in attesa
function stato(v) {
  v = up(v);
  if (!v) return "";
  if (["—", "-", "/", "NON SERVE", "NONSERVE", "⮾"].includes(v)) return "NS";
  if (v.startsWith("OK") || v === "GO" || /^\d/.test(v)) return "OK";
  if (v.startsWith("ESISTE") || v.includes("CARRY")) return "OK";
  if (v.includes("DA FARE") || v.includes("DA RIVEDERE") || v === "NO" || v.startsWith("KO")) return "DA";
  return "ATT";
}

// settimana ISO "AAAA-WW" → lunedì (UTC)
export function lunedi(key) {
  const [y, w] = key.split("-").map(Number);
  const j4 = new Date(Date.UTC(y, 0, 4)), dow = j4.getUTCDay() || 7;
  const m = new Date(j4);
  m.setUTCDate(j4.getUTCDate() - dow + 1 + (w - 1) * 7);
  return m;
}
const isoOk = (d) => /^\d{4}-\d\d-\d\d$/.test(d || "");
const fmtIt = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

// marchio del Piano ↔ cliente degli Sblocchi (DVN, DVN DROP 1, Hermès, Plan C, …)
function stessoMarchio(b, cliente) {
  const x = squash(b), y = squash(cliente);
  if (!x || !y) return false;
  const n = Math.min(4, x.length, y.length);
  return x.slice(0, n) === y.slice(0, n);
}
function stessoCodice(a, modello) {
  const x = squash(a), y = squash(modello);
  if (x.length < 3 || y.length < 3) return false;
  return x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
}

export function calcolaAlert({ righe = {}, sblocchi = {}, oggi = new Date() } = {}) {
  const t0 = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  const oggiIso = new Date(t0).toISOString().slice(0, 10);

  /* — 1. ordini scaduti — */
  const scaduti = [];
  Object.entries(righe).forEach(([id, r]) => {
    const spedire = (+r.q || 0) - (+r.sp || 0);
    if (!isoOk(r.d) || r.d >= oggiIso || spedire <= 0) return;
    scaduti.push({
      id, marchio: r.b, calz: r.c, stag: r.s, art: r.a, col: r.k, blocco: r.bl, riga: r.r,
      consegna: r.d, giorni: Math.round((t0 - Date.parse(r.d + "T00:00:00Z")) / DAY),
      daSpedire: spedire, daProdurre: Math.max(0, spedire - (+r.g || 0)), giacenza: +r.g || 0,
    });
  });
  scaduti.sort((a, b) => b.giorni - a.giorni);

  /* — 2. sblocchi in ritardo — */
  // inizio piano per articolo: prima settimana con paia pianificate tra le righe ancora da produrre
  const art = new Map();
  Object.values(righe).forEach((r) => {
    const daProd = (+r.q || 0) - (+r.sp || 0) - (+r.g || 0);
    const wk = Object.entries(r.w || {}).filter(([, v]) => +v > 0).map(([k]) => k).sort();
    if (daProd <= 0 || !wk.length || !up(r.a)) return;
    const k = squash(r.b) + "|" + squash(r.a);
    const cur = art.get(k) || { marchio: r.b, art: r.a, stag: r.s, inizio: wk[0], paia: 0 };
    if (wk[0] < cur.inizio) cur.inizio = wk[0];
    cur.paia += daProd;
    art.set(k, cur);
  });

  const attivi = Object.entries(sblocchi).filter(([, s]) => s && !s.sb);
  const sbl = [], senza = [];
  art.forEach((a) => {
    const sett = (lunedi(a.inizio).getTime() - t0) / (7 * DAY);   // settimane da oggi all'inizio del piano
    const cand = attivi.filter(([, s]) => stessoMarchio(a.marchio, s.cliente) && stessoCodice(a.art, s.modello));
    if (!cand.length) {
      // se esiste una riga già «totalmente sbloccata» (storico) l'articolo è a posto
      const storico = Object.values(sblocchi).some((s) => s && s.sb && stessoMarchio(a.marchio, s.cliente) && stessoCodice(a.art, s.modello));
      if (!storico && sett > 0 && sett <= SOGLIA.compAvviso) senza.push({ marchio: a.marchio, art: a.art, stag: a.stag, inizio: a.inizio, settimane: Math.round(sett * 10) / 10, paia: a.paia });
      return;
    }
    cand.forEach(([sid, s]) => {
      const voci = [];
      // taglio
      if (stato(s.taglio) !== "OK" && stato(s.taglio) !== "NS" && sett <= SOGLIA.tagliMax)
        voci.push({ tipo: "TAGLIO", stato: up(s.taglio) || "vuoto", livello: sett < SOGLIA.tagliMin ? "rosso" : "giallo" });
      // componenti
      SBL_COMP.forEach((c) => {
        const cc = (s.c || {})[c] || {};
        const st = stato(cc.s);
        if (st === "OK" || st === "NS") return;
        if (st === "" && !up(cc.k)) return;             // componente non compilato e senza codice: non so se serve
        if (up(cc.k) === "—" || up(cc.k) === "-") return;
        if (sett < SOGLIA.compMin) voci.push({ tipo: c, stato: up(cc.s) || "vuoto", livello: "rosso" });
        else if (sett < SOGLIA.compAvviso) voci.push({ tipo: c, stato: up(cc.s) || "vuoto", livello: "giallo" });
      });
      if (voci.length) sbl.push({
        sid, marchio: a.marchio, art: a.art, modello: s.modello, cliente: s.cliente, stag: s.stag || a.stag,
        inizio: a.inizio, settimane: Math.round(sett * 10) / 10, paia: a.paia, voci,
        livello: voci.some((v) => v.livello === "rosso") ? "rosso" : "giallo",
      });
    });
  });
  sbl.sort((x, y) => (x.livello === y.livello ? x.settimane - y.settimane : x.livello === "rosso" ? -1 : 1));
  senza.sort((x, y) => x.settimane - y.settimane);

  return { oggi: oggiIso, scaduti, sblocchi: sbl, senzaSblocco: senza, fmtIt };
}

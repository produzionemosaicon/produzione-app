/* ═══ LETTORE PDF «Situazione Ordini MOSAICON» (Gea): regole fisse, nessuna AI ═══
   Il PDF è una griglia ruotata di 90°: ExportTab salva per ogni parola [testo, x, y, larghezza] in coordinate grezze della pagina;
   qui le raddrizziamo (X = h - y, Y = x) e leggiamo una riga per bolla, 12 colonne di fase larghe 31 pt da x=376. */
const FASI = ["TAGLIO", "CERATURA", "SCARNITURA", "RIFILO", "STRASS", "GIUNTERIA", "CHECK", "LASER", "SOTTOPIEDE", "TACCO+SUOLA", "ATTESA", "MONTAGGIO"];
export const FASE_NOME = { TAGLIO: "taglio", CERATURA: "ceratura", SCARNITURA: "scarnitura", RIFILO: "rifilo", STRASS: "strass", GIUNTERIA: "giunteria", CHECK: "check tomaia", LASER: "laser", SOTTOPIEDE: "sottopiede", "TACCO+SUOLA": "tacco+suola", ATTESA: "attesa", MONTAGGIO: "montaggio" };
const X0 = 376, STEP = 31;
const colDi = (x) => { const i = Math.floor((x - X0) / STEP); return i >= 0 && i < FASI.length ? FASI[i] : null; };
const MESI = { gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5, luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11 };
const DAY = 864e5;

function dataStampa(items) {
  const t = items.map((i) => i.s).find((s) => /\d{1,2}\s+[a-zà]+\s+\d{4}/i.test(s));
  const m = t && /(\d{1,2})\s+([a-zà]+)\s+(\d{4})/i.exec(t);
  return m && MESI[m[2].toLowerCase()] != null ? new Date(+m[3], MESI[m[2].toLowerCase()], +m[1]) : new Date();
}

export function leggiGea(posizioni) {
  const pag = Array.isArray(posizioni) ? posizioni[0] : null;
  if (!pag?.it?.length) return null;
  const W = pag.it.map(([s, x, y, w]) => ({ s: String(s).trim(), X: pag.h - y, Y: x, w })).filter((i) => i.s);
  const oggi = dataStampa(W);
  const num = (s) => +String(s).replace(/\./g, "");
  const ordTxt = W.find((i) => /^ORDINE:/i.test(i.s))?.s || "";
  const mo = /ORDINE:\s*(\d+)\s*\/\s*(\d+)/i.exec(ordTxt);
  const ordine = mo ? `${mo[1]}/${mo[2]}` : "";
  const cliente = W.find((i) => i.Y < 60 && i.Y > 48 && i.X > 395)?.s || "";
  const anno = oggi.getFullYear();

  // totali ordine
  const totY = W.find((i) => /^Totale Ordine/i.test(i.s))?.Y;
  const nTot = totY == null ? [] : W.filter((i) => Math.abs(i.Y - totY) < 4 && i.X > 740 && /^\d+$/.test(i.s)).sort((a, b) => a.X - b.X).map((i) => num(i.s));
  const tot = { ord: nTot[0] ?? null, sped: nTot[1] ?? null, saldo: nTot[2] ?? null };

  const bolleW = W.filter((i) => i.X >= 90 && i.X <= 120 && /^\d{5,6}$/.test(i.s) && i.Y > 70).sort((a, b) => a.Y - b.Y);
  let riga = 0;
  const bolle = bolleW.map((b) => {
    const near = (i, lo = -14, hi = 8) => i.Y - b.Y >= lo && i.Y - b.Y <= hi;
    const rm = W.find((i) => i.X < 45 && /^\d{1,3}$/.test(i.s) && Math.abs(i.Y - b.Y) < 6);
    if (rm) riga = +rm.s;
    const q = W.find((i) => i.X >= 120 && i.X < 140 && /^\d+$/.test(i.s) && Math.abs(i.Y - b.Y) < 4);
    const modello = W.find((i) => i.X >= 140 && i.X < 205 && Math.abs(i.Y - b.Y) < 4)?.s || "";
    const fasi = {};
    FASI.forEach((f) => { fasi[f] = null; });
    const cel = {};
    W.filter((i) => i.X >= X0 && i.X < X0 + STEP * FASI.length && near(i)).forEach((i) => { const c = colDi(i.X); if (c) (cel[c] = cel[c] || []).push(i); });
    Object.entries(cel).forEach(([c, its]) => {
      its.sort((a, b) => a.Y - b.Y || a.X - b.X);
      const txt = its.map((i) => i.s).join(" ");
      const ms = /^([A-Z])\s*-\s*(\d+)\s*-/.exec(txt);
      const md = /(\d{2})\/(\d{2})\s*$/.exec(txt);
      if (!ms) { fasi[c] = { st: "?", cod: "", forn: txt, data: null }; return; }
      const forn = txt.replace(/^[A-Z]\s*-\s*\d+\s*-\s*/, "").replace(/\s*\d{2}\/\d{2}\s*$/, "").trim();
      let data = null;
      if (md) { let d = new Date(anno, +md[2] - 1, +md[1]); if (d - oggi > 45 * DAY) d = new Date(anno - 1, +md[2] - 1, +md[1]); data = d; }
      fasi[c] = { st: ms[1], cod: ms[2], forn, data };
    });
    return { bolla: b.s, qta: q ? +q.s : 0, riga, modello, fasi };
  });
  // il modello compare solo sulla prima bolla della riga: propagalo
  let mod = "";
  bolle.forEach((b) => { if (b.modello) mod = b.modello; else b.modello = mod; });

  // paia iniziate / finite per fase (righe «Paia iniziate», «Paia Finite»)
  const tr = (testo) => { const y = W.find((i) => i.s === testo)?.Y; return y == null ? {} : Object.fromEntries(W.filter((i) => Math.abs(i.Y - y) < 4 && i.X >= X0).map((i) => [colDi(i.X), num(i.s)]).filter(([c]) => c)); };
  return { ordine, cliente, oggi, tot, bolle, iniziate: tr("Paia iniziate"), finite: tr("Paia Finite") };
}

const fin = (f) => f?.st === "F";
const gg = (d, oggi) => (d ? Math.max(0, Math.round((oggi - d) / DAY)) : 0);
const ultima = (b) => Object.values(b.fasi).filter((f) => f?.data && fin(f)).map((f) => f.data).sort((a, c) => c - a)[0] || null;

/* Classifica una bolla NON montata. Priorità: P1 sbloccare subito · P2 giunteria/verifiche · P3 taglio da recuperare */
export function classifica(b, oggi) {
  const f = b.fasi, T = fin(f.TAGLIO), C = !f.CERATURA || fin(f.CERATURA), S = !f.SCARNITURA || fin(f.SCARNITURA);
  const G = fin(f.GIUNTERIA), K = fin(f.CHECK), A = fin(f.ATTESA), P = fin(f.SOTTOPIEDE);
  const ult = ultima(b), fermo = gg(ult, oggi);
  const anom = [];
  if (f.CERATURA?.st === "I" && (fin(f.SCARNITURA) || G)) anom.push("ceratura aperta ma fasi successive chiuse");
  if (f.GIUNTERIA && !T) anom.push("giunteria registrata con taglio non chiuso");
  if (f.SCARNITURA?.st === "I" && G) anom.push("scarnitura aperta ma giunteria chiusa");
  const aperte = Object.entries(f).filter(([c, x]) => x && x.st === "I" && c !== "MONTAGGIO").map(([c, x]) => `${FASE_NOME[c]} aperto (${x.forn || x.cod})`);
  let prio, fornitore, azione;
  if (A && P) { prio = 1; fornitore = f.MONTAGGIO?.forn || "Manovia"; azione = "Pronta: manca solo il montaggio → mandare in Manovia / registrare il montaggio"; }
  else if (A && !P) { prio = 1; fornitore = f.SOTTOPIEDE?.forn || "Due Effe"; azione = f.SOTTOPIEDE?.st === "I" ? "Sottopiede aperto → sollecitare la chiusura" : "Sottopiede non avviato → chiedere al fornitore"; }
  else if (K && P) { prio = 1; fornitore = "ufficio"; azione = "Registrare l'attesa (tomaia e sottopiede finiti)"; }
  else if (K && !P) { prio = 1; fornitore = f.SOTTOPIEDE?.forn || "Due Effe"; azione = "Registrare l'attesa e sollecitare il sottopiede"; }
  else if (T && C && S && G && !K) { prio = 1; fornitore = "ufficio"; azione = "Registrare il check tomaia (giunteria finita)"; }
  else if (T && C && S && f.GIUNTERIA?.st === "I") { prio = 2; fornitore = f.GIUNTERIA.forn; azione = "Giunteria aperta → chiedere data di consegna al lavorante"; }
  else if (T && !f.GIUNTERIA) { prio = 2; fornitore = "da assegnare"; azione = !C || !S ? "Taglio finito: scarnitura/ceratura non registrate e giunteria da assegnare" : "Taglio finito → assegnare la giunteria"; }
  else if (T) { prio = 2; fornitore = "da chiarire"; azione = "Avanzamento incompleto → verificare con il fornitore"; }
  else if (f.TAGLIO?.st === "I") { prio = 3; fornitore = f.TAGLIO.forn; azione = "Taglio iniziato ma non chiuso → chiedere quante paia e data di chiusura"; }
  else { prio = 3; fornitore = "da assegnare"; azione = "Taglio non avviato → assegnare o sollecitare"; }
  if (anom.length && prio > 2) prio = 2;
  const urg = fermo >= 30 ? "Critica" : prio === 1 ? "Alta" : prio === 2 ? "Media" : "Media";
  return { ...b, prio, fornitore, azione, anom, aperte, fermo, ultima: ult, urg };
}

/* Analisi completa: quadrature + bolle non montate + confronto con il piano (righe con lo stesso ordine «serie/numero») */
export function analizzaGea(pdf, righePiano = {}) {
  const g = leggiGea(pdf);
  if (!g) return null;
  const oggi = g.oggi;
  const mont = g.bolle.filter((b) => fin(b.fasi.MONTAGGIO));
  const non = g.bolle.filter((b) => !fin(b.fasi.MONTAGGIO)).map((b) => classifica(b, oggi));
  const pMont = mont.reduce((s, b) => s + b.qta, 0), pNon = non.reduce((s, b) => s + b.qta, 0), pBolla = pMont + pNon;
  const avvisi = [];
  if (g.tot.ord != null && pBolla !== g.tot.ord) avvisi.push({ liv: "rosso", t: `Paia in bolla ${pBolla} ≠ ordinate ${g.tot.ord}: ${Math.abs(g.tot.ord - pBolla)} paia ${g.tot.ord > pBolla ? "non ancora messe in bolla" : "in bolla in più"}` });
  if (g.tot.sped != null && g.tot.sped > pMont) avvisi.push({ liv: "rosso", t: `Spedito ${g.tot.sped} ma montate solo ${pMont}` });
  if (g.tot.sped != null && pMont > g.tot.sped) avvisi.push({ liv: "giallo", t: `${pMont - g.tot.sped} paia montate non ancora spedite (spedite ${g.tot.sped} su ${pMont} montate)` });
  non.filter((b) => b.anom.length).forEach((b) => avvisi.push({ liv: "giallo", t: `Bolla ${b.bolla}: ${b.anom.join("; ")}` }));
  non.filter((b) => b.aperte.length && b.prio <= 1).forEach((b) => avvisi.push({ liv: "giallo", t: `Bolla ${b.bolla}: ${b.aperte.join(", ")}` }));
  non.filter((b) => b.fermo >= 30).forEach((b) => avvisi.push({ liv: "rosso", t: `Bolla ${b.bolla} (${b.qta} paia) ferma da ${b.fermo} giorni` }));

  // confronto col piano: righe dello stesso ordine (campo bl = «4/1048»)
  const piano = Object.entries(righePiano).filter(([, r]) => r.bl === g.ordine).map(([id, r]) => ({ id, ...r }));
  const pianoModello = piano.find((r) => String(r.a).replace(/\s/g, "").toUpperCase() === String(g.bolle[0]?.modello || "").replace(/\s/g, "").toUpperCase()) || null;
  if (pianoModello) {
    const q = +pianoModello.q || 0, sp = +pianoModello.sp || 0, gi = +pianoModello.g || 0;
    if (g.tot.ord != null && q !== g.tot.ord) avvisi.push({ liv: "giallo", t: `Piano: ${pianoModello.a} ordinate ${q} paia, PDF ${g.tot.ord}` });
    if (g.tot.sped != null && sp !== g.tot.sped) avvisi.push({ liv: "giallo", t: `Piano: spedite ${sp}, PDF ${g.tot.sped} (aggiornare il piano)` });
    const pdfG = g.finite.GIUNTERIA ?? null;
    if (pdfG != null && gi && Math.abs(pdfG - gi) > 0) avvisi.push({ liv: "giallo", t: `Piano: giunteria ${gi} paia, PDF ${pdfG} finite` });
  }
  if (pianoModello) {
    const pianif = Object.values(pianoModello.w || {}).reduce((x, y) => x + (+y || 0), 0);
    if (pianif && pianif !== pNon) avvisi.push({ liv: "giallo", t: `Il piano mette in programma ${pianif} paia di ${pianoModello.a}, ma nel PDF ne restano da montare ${pNon} (${pronte0(non)} già pronte, serve solo montaggio o registrazione)` });
  }
  const dalPiano = pianoModello ? Object.entries(pianoModello.w || {}).filter(([, v]) => v > 0).sort() : [];
  const pronte = non.filter((b) => b.prio === 1).reduce((s, b) => s + b.qta, 0);
  return { ...g, mont, non, pMont, pNon, pBolla, avvisi, pianoModello, dalPiano, pronte };
}

const pronte0 = (non) => non.filter((b) => b.prio === 1).reduce((s, b) => s + b.qta, 0);

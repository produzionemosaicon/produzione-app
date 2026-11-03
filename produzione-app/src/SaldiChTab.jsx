import { useState, useMemo, Fragment, useRef, useEffect } from "react";
import { db, ref, set, update, get } from "./firebase.js";

/* ═══ SALDI CHROME HEARTS (uso INTERNO: contiene STIL3, non mostrare al cliente) ═══
   Database saldiCH/
     po/{rif}   = { o, mod, col, po, bl, q (ordine), sped (spedite al cliente), ready (pronte nel nostro magazzino),
                    readyS (paia da STIL3: in riparazione o finite), note }
   Lato interno: saldo = da noi (ready) + da STIL3 (readyS) + mancanti. Pending/rejected = lato cliente, solo informativi.
     pend/{id}  = paia PENDING dal QC: { po, rep, d, isp, tg, n, dif, det, reso, ddtReso, rientr, rientrD, ric, appr, rej, note }
     rej/{id}   = paia REJECTED da rifare: { po, rep, d, tg, n, mot, det, mat, bolla, dl (deadline cliente), cons, fatte }
     res/{id}   = paia non spedite da STIL3: { po, bl, n, mot, det, az, soll, prev, arr, stato }
     prop/{id}  = movimenti letti dalle mail, DA CONFERMARE: { d, from, subj, testo, po, stato ('' | 'fatto' | 'scartato'), scelta,
                    scelte: [{ lab, ops: [{ p: 'saldiCH/...', v }|{ p, inc }] }] }
   Calcoli: pending aperti = n − approvate − passate a rejected; rejected aperti = n − rifatte; residuo = n − arrivate (se non chiuso);
            ancora in produzione = saldo − pronte − pronte STIL3 − pending − rejected − residuo                                     */

const M = "#2F5BFF", ML = "#EEF3FF", S0 = "#fff", S1 = "#F8FAFC", BRD = "#E2E8F0", BRD2 = "#CBD5E1";
const TXT = "#0B1220", T2 = "#475569", T3 = "#64748B", GRN = "#00B87A", RED = "#E53E3E", ACC = "#FF5200";
const FONT = "'Inter', sans-serif", MONO = "'JetBrains Mono', monospace";
const ROOT = "saldiCH";
const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
const fd = (s) => (s && /^\d{4}-\d\d-\d\d/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : s || "");
const wr = (path, v) => set(ref(db, `${ROOT}/${path}`), v === "" || v === undefined ? null : v);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const days = (a, b = today()) => (a && /^\d{4}-\d\d-\d\d/.test(a) ? Math.round((Date.parse(b) - Date.parse(a.slice(0, 10))) / 86400000) : null);
const SOGLIA_SALDO = 0.15; // avviso "ordine non saldato" quando mancano tra 1 paio e il 15% dell'ordine
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const MOT_RES = ["Materiale mancante", "Materiale difettoso (suole/pelle)", "Scarti di produzione", "Taglie mancanti", "Ritardo STIL3", "Altro"];
const MOT_REJ = ["Difetto non riparabile", "Pelle/tessuto difettoso", "Colore non conforme", "Misure errate", "Altro"];
const DIF = ["Sottopiede/soletta scollata", "Pulizia", "Colla", "Cuciture", "Suola/fondo", "Pelle/tessuto", "Logo/stampa", "Accessori/ricamo", "Forma/pieghe", "Difetti multipli", "Altro"];
const ST_RES = ["Aperto", "Sollecitato", "Chiuso"];

const pendOpen = (x) => Math.max(0, num(x.n) - num(x.appr) - num(x.rej));
const pendState = (x) => (pendOpen(x) <= 0 ? "Chiuso" : num(x.rientr) > 0 ? "Rientrate, da ricontrollare" : x.reso ? "Da STIL3 in riparazione" : "Da rendere a STIL3");
const rejOpen = (x) => Math.max(0, num(x.n) - num(x.fatte));
const rejState = (x) => (rejOpen(x) <= 0 ? "Chiuso" : x.dl && x.cons && x.cons > x.dl ? "IN RITARDO su deadline" : x.bolla ? "In produzione" : "Da lanciare");
const resOpen = (x) => (x.stato === "Chiuso" ? 0 : Math.max(0, num(x.n) - num(x.arr)));

/* casella modificabile: salva quando esci */
function In({ v, onSave, w = 70, type = "text", list, ro, center, bold }) {
  const [t, setT] = useState(null);
  const val = t ?? (v ?? "");
  const st = { width: w, boxSizing: "border-box", border: `1px solid ${BRD}`, borderRadius: 6, padding: "4px 6px", fontFamily: type === "number" ? MONO : FONT, fontSize: 12, fontWeight: bold ? 800 : 500, background: ro ? S1 : "#FFFCEB", textAlign: center ? "center" : "left", color: TXT };
  if (ro) return <div style={{ ...st, background: "transparent", border: "none" }}>{v ?? ""}</div>;
  if (list) return (
    <select value={v || ""} onChange={(e) => onSave(e.target.value)} style={{ ...st, background: "#FFFCEB" }}>
      <option value=""></option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <input type={type} value={val} onChange={(e) => setT(e.target.value)} style={st}
      onBlur={() => { if (t !== null) { const out = type === "number" ? (t === "" ? "" : num(t)) : t.trim(); if (String(out) !== String(v ?? "")) onSave(out); setT(null); } }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setT(null); e.currentTarget.blur(); } }} />
  );
}

const th = { background: "#EEF2F8", color: TXT, fontSize: 11, fontWeight: 800, padding: "6px 6px", borderBottom: `2px solid ${BRD2}`, borderRight: `1px solid ${BRD}`, textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2 };
const thc = { ...th, whiteSpace: "normal", fontSize: 10, lineHeight: 1.15, padding: "4px 3px", verticalAlign: "bottom" };
const td = { padding: "2px 3px", borderBottom: `1px solid ${BRD}`, borderRight: `1px solid ${BRD}`, fontSize: 12, verticalAlign: "middle" };
const nc = { ...td, textAlign: "center", fontFamily: MONO, fontWeight: 700 };
const pill = (txt, bg, fg) => <span style={{ background: bg, color: fg, fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>{txt}</span>;
const stPill = (s) => s === "Chiuso" ? pill(s, "#DCFCE7", "#166534") : /RITARDO/.test(s) ? pill(s, "#FFE4D6", "#9A3412") : pill(s, "#FFF6D6", "#854D0E");

/* esportazione Excel: riepilogo (righe filtrate, nell'ordine visto) + pending, rejected e motivi dei mancanti */
async function exportSaldiXlsx({ rows, pend, rej, res, label }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const thin = { style: "thin", color: { argb: "FFBBBBBB" } };
  const dt = (v) => (v && /^\d{4}-\d\d-\d\d/.test(v) ? new Date(v.slice(0, 10) + "T12:00:00") : v || null);
  const sheet = (name, head, data, widths) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
    ws.getCell(1, 1).value = "Saldi Chrome Hearts – " + name; ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF1F3A5F" } };
    ws.getCell(2, 1).value = `USO INTERNO MOSAICON – contiene STIL3, non inviare al cliente · estratto il ${new Date().toLocaleString("it-IT")}`; ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FFC00000" } };
    head.forEach((h, i) => { const c = ws.getCell(3, i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = { top: thin, bottom: thin, left: thin, right: thin }; });
    ws.getRow(3).height = 32;
    data.forEach((r, k) => r.forEach((v, i) => { const c = ws.getCell(4 + k, i + 1); c.value = dt(v); if (c.value instanceof Date) c.numFmt = "dd/mm/yy"; c.border = { top: thin, bottom: thin, left: thin, right: thin }; }));
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + data.length, column: head.length } };
    return ws;
  };
  const ws = sheet("Riepilogo", ["RIF", "Modello", "Colore", "PO", "Blocco Gea", "Q.tà ordine", "Spedite al cliente", "Saldo da spedire", "Da noi", "Da STIL3", "Mancanti", "di cui con motivo", "Pending cliente", "Rejected cliente", "Note"],
    rows.map((r) => [r.rif, r.p.mod, r.p.col, r.p.po, r.p.bl, num(r.p.q), num(r.p.sped), r.saldo, num(r.p.ready), num(r.p.readyS), r.prod, r.rs, r.pe, r.rj, r.p.note || ""]),
    [7, 22, 20, 12, 10, 9, 10, 10, 9, 9, 10, 10, 10, 10, 60]);
  const tr = 4 + rows.length; ws.getCell(tr, 2).value = "TOTALE"; ws.getRow(tr).font = { bold: true };
  for (let c = 6; c <= 14; c++) { const L = String.fromCharCode(64 + c); ws.getCell(tr, c).value = { formula: `SUM(${L}4:${L}${tr - 1})`, result: rows.reduce((t, r) => t + (num(ws.getCell(4 + rows.indexOf(r), c).value) || 0), 0) }; }
  const keep = new Set(rows.map((r) => r.rif));
  const sel = (arr) => arr.filter(([, x]) => keep.has(x.po)).sort((a, b) => String(a[1].po).localeCompare(String(b[1].po)) || String(a[1].d || "").localeCompare(String(b[1].d || "")));
  sheet("Pending cliente", ["PO", "Report QC", "Data QC", "Ispettore", "Taglie", "Paia", "Difetto", "Dettaglio", "Ripresentare entro", "Reso a STIL3", "DDT reso", "Rientrate", "Rientrate il", "Ricontrollo", "Approvate", "→ Rejected", "Aperte", "Stato"],
    sel(pend).map(([, x]) => [label(x.po), x.rep, x.d, x.isp, x.tg, num(x.n), x.dif, x.det, x.entro, x.reso, x.ddtReso, num(x.rientr) || null, x.rientrD, x.ric, num(x.appr) || null, num(x.rej) || null, pendOpen(x), pendState(x)]),
    [30, 22, 10, 16, 30, 7, 18, 60, 11, 11, 10, 9, 11, 11, 9, 9, 8, 22]);
  sheet("Rejected cliente", ["PO", "Report QC", "Data", "Taglie", "Paia", "Motivo", "Dettaglio", "Materiale da riordinare", "Nuova bolla Gea", "Deadline cliente", "Consegna prevista", "Rifatte e spedite", "Aperte", "Stato"],
    sel(rej).map(([, x]) => [label(x.po), x.rep, x.d, x.tg, num(x.n), x.mot, x.det, x.mat, x.bolla, x.dl, x.cons, num(x.fatte) || null, rejOpen(x), rejState(x)]),
    [30, 22, 10, 24, 7, 20, 50, 22, 12, 11, 11, 10, 8, 20]);
  sheet("Mancanti - motivi", ["PO", "Blocco Gea", "Paia", "Motivo", "Dettaglio", "Azione", "Sollecitato il", "Arrivo previsto", "Arrivate", "Aperte", "Stato"],
    sel(res).map(([, x]) => [label(x.po), x.bl, num(x.n), x.mot, x.det, x.az, x.soll, x.prev, num(x.arr) || null, resOpen(x), x.stato || "Aperto"]),
    [30, 10, 7, 26, 60, 30, 11, 11, 9, 8, 12]);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = `Saldi_Chrome_Hearts_INTERNO_${today()}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* filtro stile Excel sull'intestazione (stesso del PIANO) */
function FilterTh({ label, style, values, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [qq, setQq] = useState("");
  const btn = useRef(null);
  const on = selected.length > 0;
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!e.target.closest || !e.target.closest("[data-fpop]")) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", close); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const list = values.filter((v) => v.label.toUpperCase().includes(qq.trim().toUpperCase()));
  return (
    <th style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: style.textAlign === "left" ? "flex-start" : "center" }}>
        <span>{label}</span>
        <button ref={btn} data-fpop="1" aria-label={`Filtra ${label}`}
          onClick={() => { const r = btn.current.getBoundingClientRect(); setPos({ x: Math.min(r.left, window.innerWidth - 250), y: r.bottom + 4 }); setQq(""); setOpen(!open); }}
          style={{ border: "none", background: on ? M : "transparent", color: on ? "#fff" : T2, borderRadius: 4, fontSize: 9, lineHeight: 1, padding: "2px 3px", cursor: "pointer" }}>▾</button>
      </div>
      {open && pos && (
        <div data-fpop="1" style={{ position: "fixed", left: pos.x, top: pos.y, width: 240, zIndex: 80, background: S0, border: `1px solid ${BRD2}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(11,18,32,0.18)", padding: 8, textAlign: "left", fontFamily: FONT, fontWeight: 600, textTransform: "none", letterSpacing: 0, color: TXT }}>
          <input autoFocus value={qq} onChange={(e) => setQq(e.target.value)} placeholder="Cerca…" style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BRD2}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, fontFamily: FONT, outline: "none" }} />
          <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
            <button onClick={() => onChange(list.map((v) => v.key))} style={{ flex: 1, fontSize: 11, border: `1px solid ${BRD2}`, background: S1, borderRadius: 6, padding: "4px 0", cursor: "pointer", fontFamily: FONT }}>Seleziona tutti</button>
            <button onClick={() => onChange([])} style={{ flex: 1, fontSize: 11, border: `1px solid ${BRD2}`, background: S1, borderRadius: 6, padding: "4px 0", cursor: "pointer", fontFamily: FONT }}>Cancella filtro</button>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {list.map((v) => (
              <label key={v.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px", fontSize: 12, cursor: "pointer", borderRadius: 6 }}>
                <input type="checkbox" checked={selected.includes(v.key)} onChange={() => toggle(v.key)} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</span>
                <span style={{ color: T3, fontSize: 10 }}>{v.n}</span>
              </label>
            ))}
            {list.length === 0 && <div style={{ fontSize: 11, color: T3, padding: 6 }}>Nessun valore</div>}
          </div>
        </div>
      )}
    </th>
  );
}

export default function SaldiChTab({ data }) {
  const [view, setView] = useState("riep");
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const D = data || {};
  // ordine del riepilogo: per blocco d'ordine Gea (serie / numero / riga), poi ordine di inserimento
  const blKey = (bl) => { const m = String(bl || "").match(/(\d+)\s*\/\s*(\d+)(?:\D+(\d+))?/); return m ? [num(m[1]), num(m[2]), m[3] ? num(m[3]) : 0] : [999, 0, 0]; };
  const POs = useMemo(() => Object.entries(D.po || {}).sort((a, b) => { const x = blKey(a[1].bl), y = blKey(b[1].bl); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || num(a[1].o) - num(b[1].o); }), [D.po]);
  const list = (k) => Object.entries(D[k] || {}).filter(([, x]) => x && x.po);
  const pend = list("pend"), rej = list("rej"), res = list("res");
  const props = Object.entries(D.prop || {}).filter(([, x]) => x && !x.stato).sort((a, b) => String(a[1].d).localeCompare(String(b[1].d)));
  const label = (rif) => { const p = (D.po || {})[rif]; return p ? `${rif} · ${p.mod} ${p.col}` : rif; };
  const rifOpts = POs.map(([r]) => r);

  const sum = (arr, f, rif) => arr.filter(([, x]) => x.po === rif).reduce((t, [, x]) => t + f(x), 0);
  const rows = POs.map(([rif, p]) => {
    const saldo = num(p.q) - num(p.sped), pe = sum(pend, pendOpen, rif), rj = sum(rej, rejOpen, rif), rs = sum(res, resOpen, rif);
    // lato interno: dove sono fisicamente le paia ancora da spedire. Pending/rejected sono solo il punto di vista del cliente.
    const prod = saldo - num(p.ready) - num(p.readyS);
    return { rif, p, saldo, pe, rj, rs, prod };
  });
  /* ═══ AVVISI ═══ */
  const alerts = [];
  const A = (liv, rif, txt, extra) => alerts.push({ liv, rif, txt, ...extra });
  pend.forEach(([id, x]) => {
    const o = pendOpen(x); if (!o) return;
    const dq = days(x.d), dr = days(x.reso), dri = days(x.rientrD), de = x.entro ? -days(x.entro) : null;
    if (de !== null && de <= 3) A(de < 0 ? 1 : 2, x.po, `${o} paia pending da ripresentare ${de < 0 ? `scaduto da ${-de} gg` : de === 0 ? "entro OGGI" : `entro ${fd(x.entro)} (tra ${de} gg)`}`);
    if (num(x.rientr) > 0 && !x.ric) { if (dri !== null && dri > 3) A(2, x.po, `${num(x.rientr)} paia riparate rientrate da ${dri} gg, non ancora ripresentate al QC`); }
    else if (x.reso && !num(x.rientr)) { if (dr !== null && dr > 7) A(dr > 14 ? 1 : 2, x.po, `${o} paia in riparazione da STIL3 da ${dr} gg (reso del ${fd(x.reso)})`); }
    else if (!x.reso && dq !== null && dq > 3) A(dq > 14 ? 1 : 2, x.po, `${o} paia pending dal QC del ${fd(x.d)} (${dq} gg) non ancora rese a STIL3`);
  });
  res.forEach(([id, x]) => {
    const o = resOpen(x); if (!o) return;
    const dp = x.prev ? days(x.prev) : null, age = days(x.d || "2026-11-03");
    if (dp !== null && dp > 0) A(1, x.po, `Residuo STIL3: ${o} paia, arrivo previsto il ${fd(x.prev)} già passato da ${dp} gg${x.mot ? ` (${x.mot})` : ""}`);
    else if (!x.soll && !x.prev && age !== null && age > 14) A(2, x.po, `Residuo STIL3: ${o} paia ferme da ${age} gg senza sollecito né data prevista${x.mot ? ` (${x.mot})` : ""}`);
  });
  rej.forEach(([id, x]) => {
    const o = rejOpen(x); if (!o) return;
    if (x.dl && x.cons && x.cons > x.dl) A(1, x.po, `${o} paia rejected: consegna prevista ${fd(x.cons)} DOPO la deadline del cliente ${fd(x.dl)}`);
    else if (x.dl) { const t = -days(x.dl); if (t <= 7) A(t < 0 ? 1 : 2, x.po, `${o} paia rejected da rifare: deadline del cliente ${fd(x.dl)} ${t < 0 ? `scaduta da ${-t} gg` : `tra ${t} gg`}${x.bolla ? "" : ", bolla non ancora lanciata"}`); }
  });
  rows.forEach((r) => {
    const q0 = num(r.p.q), got = num(r.p.sped) + num(r.p.ready) + num(r.p.readyS);
    const hasRes = res.some(([, x]) => x.po === r.rif && resOpen(x) > 0);
    if (q0 && got > 0 && r.prod >= 1 && r.prod <= q0 * SOGLIA_SALDO && !hasRes) A(2, r.rif, `STIL3 non ha saldato l'ordine: mancano ${r.prod} paia su ${q0} (${Math.round((r.prod / q0) * 100)}%), nessun motivo registrato. Chiedere motivo e data.`, { saldo: r.prod });
  });
  alerts.sort((a, b) => a.liv - b.liv || String(a.rif).localeCompare(String(b.rif)));
  const [showAll, setShowAll] = useState(false);
  const goTo = (rif) => { setView("riep"); setQ(""); setOpen((o) => ({ ...o, [rif]: true })); setTimeout(() => { const el = document.getElementById("sch-" + rif); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50); };

  const qq = q.trim().toUpperCase();
  // PO consegnato al 100% (spedite = ordinate) e senza pending, rejected o residui aperti: chiuso, si nasconde dal riepilogo
  const isClosed = (r) => num(r.p.q) > 0 && num(r.p.sped) >= num(r.p.q) && !r.pe && !r.rj && !r.rs;
  const [showClosed, setShowClosed] = useState(false);
  const nClosed = rows.filter(isClosed).length;
  // filtri stile Excel per colonna: chiave → valori selezionati (vuoto = tutti)
  const FCOLS = [["rif", "RIF", (r) => r.rif], ["mod", "Modello", (r) => r.p.mod], ["col", "Colore", (r) => r.p.col], ["po", "PO", (r) => r.p.po], ["bl", "Blocco Gea", (r) => r.p.bl],
    ["q", "Q.tà ordine", (r) => r.p.q], ["sped", "Spedite al cliente", (r) => r.p.sped], ["saldo", "Saldo da spedire", (r) => r.saldo], ["ready", "Da noi", (r) => r.p.ready], ["readyS", "Da STIL3", (r) => r.p.readyS],
    ["prod", "Mancanti", (r) => r.prod], ["rs", "di cui con motivo", (r) => r.rs], ["pe", "Pending cliente", (r) => r.pe], ["rj", "Rejected cliente", (r) => r.rj], ["note", "Note", (r) => r.p.note]];
  const [cf, setCf] = useState({});
  const fval = (get, r) => { const v = get(r); return v === undefined || v === null || v === "" || v === 0 ? "" : String(v); };
  const base = rows.filter((r) => showClosed || !isClosed(r));
  const passCf = (r, skip) => FCOLS.every(([k, , get]) => k === skip || !(cf[k] || []).length || cf[k].includes(fval(get, r)));
  const fOpts = (k, get) => { const m = new Map(); base.filter((r) => passCf(r, k)).forEach((r) => { const v = fval(get, r); m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => (isNaN(a[0]) || isNaN(b[0]) || a[0] === "" || b[0] === "" ? a[0].localeCompare(b[0], "it", { numeric: true }) : num(a[0]) - num(b[0]))).map(([key, n]) => ({ key, label: key === "" ? "(vuoto / 0)" : key, n })); };
  const cfOn = Object.values(cf).some((a) => a && a.length);
  const shown = base.filter((r) => passCf(r) && (!qq || `${r.rif} ${r.p.mod} ${r.p.col} ${r.p.po} ${r.p.bl}`.toUpperCase().includes(qq)));
  const T = shown.reduce((t, r) => ({ saldo: t.saldo + r.saldo, ready: t.ready + num(r.p.ready), readyS: t.readyS + num(r.p.readyS), pe: t.pe + r.pe, rj: t.rj + r.rj, rs: t.rs + r.rs }), { saldo: 0, ready: 0, readyS: 0, pe: 0, rj: 0, rs: 0 });  // totali e riquadri seguono i filtri

  const applyProp = async (id, pr, sc) => {
    if (!window.confirm(`Confermi: «${sc.lab}»?`)) return;
    setBusy(true);
    try {
      for (const op of sc.ops || []) {
        if (op.inc !== undefined) { const s = await get(ref(db, op.p)); await set(ref(db, op.p), num(s.val()) + num(op.inc)); }
        else await set(ref(db, op.p), op.v);
      }
      await update(ref(db, `${ROOT}/prop/${id}`), { stato: "fatto", scelta: sc.lab, at: Date.now() });
    } catch (e) { window.alert("Non riuscito: " + e.message); } finally { setBusy(false); }
  };
  const skipProp = (id) => { if (window.confirm("Scarto questo movimento? Non verrà registrato.")) update(ref(db, `${ROOT}/prop/${id}`), { stato: "scartato", at: Date.now() }); };
  const add = (k, rif, base) => { const id = newId(k[0]); wr(`${k}/${id}`, { po: rif || "", d: new Date().toISOString().slice(0, 10), ...base }); };
  const del = (k, id) => { if (window.confirm("Elimino questa riga?")) wr(`${k}/${id}`, null); };

  const tabBtn = (id, l, n) => (<button onClick={() => setView(id)} style={{ background: view === id ? M : S0, color: view === id ? "#fff" : M, border: `1.5px solid ${M}`, borderRadius: 12, padding: "8px 14px", fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{l}{n ? ` · ${n}` : ""}</button>);
  const kpi = (l, v, c) => (<div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 14, padding: "8px 14px", minWidth: 110 }}><div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l}</div><div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: c || TXT }}>{v}</div></div>);
  const addBtn = (l, fn) => <button onClick={fn} style={{ background: ML, color: M, border: `1px dashed ${M}`, borderRadius: 8, padding: "4px 10px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ {l}</button>;
  const xBtn = (fn) => <button onClick={fn} title="Elimina riga" style={{ border: "none", background: "transparent", color: T3, cursor: "pointer", fontSize: 14 }}>×</button>;

  const pendTable = (arr, showPo) => (
    <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "max-content" }}>
      <thead><tr>{[showPo && "PO", "Report QC", "Data", "Ispettore", "Taglie", "Paia", "Difetto", "Dettaglio", "Ripresentare entro", "Reso a STIL3", "DDT reso", "Rientrate", "Rientrate il", "Ricontrollo", "Approvate", "→ Rejected", "Aperte", "Stato", ""].filter((x) => x !== false).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{arr.map(([id, x]) => { const s = (f) => (v) => wr(`pend/${id}/${f}`, v); return (
        <tr key={id}>
          {showPo && <td style={td}><In v={x.po} list={rifOpts} onSave={s("po")} w={90} /><div style={{ fontSize: 10, color: T2 }}>{label(x.po).slice(5, 40)}</div></td>}
          <td style={td}><In v={x.rep} onSave={s("rep")} w={130} /></td>
          <td style={td}><In v={x.d} type="date" onSave={s("d")} w={124} /></td>
          <td style={td}><In v={x.isp} onSave={s("isp")} w={110} /></td>
          <td style={td}><In v={x.tg} onSave={s("tg")} w={190} /></td>
          <td style={nc}><In v={x.n} type="number" onSave={s("n")} w={54} center bold /></td>
          <td style={td}><In v={x.dif} list={DIF} onSave={s("dif")} w={150} /></td>
          <td style={td}><In v={x.det} onSave={s("det")} w={280} /></td>
          <td style={td}><In v={x.entro} type="date" onSave={s("entro")} w={124} /></td>
          <td style={td}><In v={x.reso} type="date" onSave={s("reso")} w={124} /></td>
          <td style={td}><In v={x.ddtReso} onSave={s("ddtReso")} w={80} /></td>
          <td style={nc}><In v={x.rientr} type="number" onSave={s("rientr")} w={54} center /></td>
          <td style={td}><In v={x.rientrD} type="date" onSave={s("rientrD")} w={124} /></td>
          <td style={td}><In v={x.ric} type="date" onSave={s("ric")} w={124} /></td>
          <td style={nc}><In v={x.appr} type="number" onSave={s("appr")} w={54} center /></td>
          <td style={nc}><In v={x.rej} type="number" onSave={s("rej")} w={54} center /></td>
          <td style={{ ...nc, background: "#DCE5F3" }}>{pendOpen(x)}</td>
          <td style={td}>{stPill(pendState(x))}</td>
          <td style={td}>{xBtn(() => del("pend", id))}</td>
        </tr>); })}</tbody>
    </table>
  );
  const rejTable = (arr, showPo) => (
    <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "max-content" }}>
      <thead><tr>{[showPo && "PO", "Report QC", "Data", "Taglie", "Paia", "Motivo", "Dettaglio", "Materiale da riordinare", "Nuova bolla Gea", "Deadline cliente", "Consegna prevista", "Rifatte e spedite", "Aperte", "Stato", ""].filter((x) => x !== false).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{arr.map(([id, x]) => { const s = (f) => (v) => wr(`rej/${id}/${f}`, v); return (
        <tr key={id}>
          {showPo && <td style={td}><In v={x.po} list={rifOpts} onSave={s("po")} w={90} /><div style={{ fontSize: 10, color: T2 }}>{label(x.po).slice(5, 40)}</div></td>}
          <td style={td}><In v={x.rep} onSave={s("rep")} w={130} /></td>
          <td style={td}><In v={x.d} type="date" onSave={s("d")} w={124} /></td>
          <td style={td}><In v={x.tg} onSave={s("tg")} w={160} /></td>
          <td style={nc}><In v={x.n} type="number" onSave={s("n")} w={54} center bold /></td>
          <td style={td}><In v={x.mot} list={MOT_REJ} onSave={s("mot")} w={160} /></td>
          <td style={td}><In v={x.det} onSave={s("det")} w={260} /></td>
          <td style={td}><In v={x.mat} onSave={s("mat")} w={160} /></td>
          <td style={td}><In v={x.bolla} onSave={s("bolla")} w={90} /></td>
          <td style={td}><In v={x.dl} type="date" onSave={s("dl")} w={124} /></td>
          <td style={td}><In v={x.cons} type="date" onSave={s("cons")} w={124} /></td>
          <td style={nc}><In v={x.fatte} type="number" onSave={s("fatte")} w={54} center /></td>
          <td style={{ ...nc, background: "#DCE5F3" }}>{rejOpen(x)}</td>
          <td style={td}>{stPill(rejState(x))}</td>
          <td style={td}>{xBtn(() => del("rej", id))}</td>
        </tr>); })}</tbody>
    </table>
  );
  const resTable = (arr, showPo) => (
    <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "max-content" }}>
      <thead><tr>{[showPo && "PO", "Blocco Gea", "Paia non spedite", "Motivo", "Dettaglio", "Azione", "Sollecitato il", "Arrivo previsto", "Arrivate", "Aperte", "Stato", ""].filter((x) => x !== false).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{arr.map(([id, x]) => { const s = (f) => (v) => wr(`res/${id}/${f}`, v); return (
        <tr key={id}>
          {showPo && <td style={td}><In v={x.po} list={rifOpts} onSave={s("po")} w={90} /><div style={{ fontSize: 10, color: T2 }}>{label(x.po).slice(5, 40)}</div></td>}
          <td style={td}><In v={x.bl} onSave={s("bl")} w={80} /></td>
          <td style={nc}><In v={x.n} type="number" onSave={s("n")} w={60} center bold /></td>
          <td style={td}><In v={x.mot} list={MOT_RES} onSave={s("mot")} w={190} /></td>
          <td style={td}><In v={x.det} onSave={s("det")} w={280} /></td>
          <td style={td}><In v={x.az} onSave={s("az")} w={200} /></td>
          <td style={td}><In v={x.soll} type="date" onSave={s("soll")} w={124} /></td>
          <td style={td}><In v={x.prev} type="date" onSave={s("prev")} w={124} /></td>
          <td style={nc}><In v={x.arr} type="number" onSave={s("arr")} w={54} center /></td>
          <td style={{ ...nc, background: "#DCE5F3" }}>{resOpen(x)}</td>
          <td style={td}><In v={x.stato || "Aperto"} list={ST_RES} onSave={s("stato")} w={110} /></td>
          <td style={td}>{xBtn(() => del("res", id))}</td>
        </tr>); })}</tbody>
    </table>
  );
  const by = (arr, rif) => arr.filter(([, x]) => x.po === rif).sort((a, b) => String(a[1].d || "").localeCompare(String(b[1].d || "")));
  const filt = (arr) => arr.filter(([, x]) => !qq || label(x.po).toUpperCase().includes(qq)).sort((a, b) => String(a[1].po).localeCompare(String(b[1].po)) || String(a[1].d || "").localeCompare(String(b[1].d || "")));

  return (
    <div style={{ fontFamily: FONT, padding: 14, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Saldi Chrome Hearts</div>
          <div style={{ fontSize: 12, color: RED, fontWeight: 700 }}>USO INTERNO – contiene STIL3: non mostrare né copiare nei file per il cliente.</div>
          <div style={{ fontSize: 12, color: T2 }}>Pending e rejected dal controllo qualità, paia non spedite da STIL3. Caselle gialle modificabili: salvano quando esci.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabBtn("riep", "Riepilogo PO")}{tabBtn("pend", "Pending", pend.filter(([, x]) => pendOpen(x)).length)}{tabBtn("rej", "Rejected", rej.filter(([, x]) => rejOpen(x)).length)}{tabBtn("res", "Residui STIL3", res.filter(([, x]) => resOpen(x)).length)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {kpi("Saldo da spedire", T.saldo)}{kpi("Da noi", T.ready, GRN)}{kpi("Da STIL3", T.readyS, "#854D0E")}{kpi("Mancanti", T.saldo - T.ready - T.readyS, RED)}{kpi("Pending cliente", T.pe, T3)}{kpi("Rejected cliente", T.rj, T3)}
        <button disabled={busy} onClick={async () => { setBusy(true); try { await exportSaldiXlsx({ rows: shown, pend, rej, res, label }); } catch (e) { window.alert("Export non riuscito: " + e.message); } finally { setBusy(false); } }} title="Scarica in Excel le righe visibili (con i filtri attivi) e i loro pending, rejected e motivi" style={{ marginLeft: "auto", alignSelf: "center", background: GRN, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>⬇ Scarica Excel</button>
        <input placeholder="Cerca PO, modello, colore, blocco…" value={q} onChange={(e) => setQ(e.target.value)} style={{ alignSelf: "center", minWidth: 240, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "9px 12px", fontFamily: FONT, fontSize: 13 }} />
      </div>

      {alerts.length > 0 && (
        <div style={{ border: `2px solid ${RED}`, background: "#FFF5F5", borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, color: "#9B1C1C", marginBottom: 6 }}>Avvisi · {alerts.length} {alerts.filter((a) => a.liv === 1).length ? `(${alerts.filter((a) => a.liv === 1).length} urgenti)` : ""}</div>
          {(showAll ? alerts : alerts.slice(0, 8)).map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i ? `1px solid ${BRD}` : "none", flexWrap: "wrap" }}>
              {a.liv === 1 ? pill("URGENTE", "#FFE4D6", "#9A3412") : pill("DA SEGUIRE", "#FFF6D6", "#854D0E")}
              <b style={{ fontSize: 12, fontFamily: MONO }}>{label(a.rif)}</b>
              <span style={{ fontSize: 13, color: TXT, flex: 1, minWidth: 220 }}>{a.txt}</span>
              {a.saldo ? <button onClick={() => { add("res", a.rif, { bl: ((D.po || {})[a.rif] || {}).bl || "", n: a.saldo, stato: "Aperto", det: "Saldo non completato da STIL3" }); goTo(a.rif); }} style={{ background: S0, color: M, border: `1.5px solid ${M}`, borderRadius: 8, padding: "4px 10px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Registra residuo</button> : null}
              <button onClick={() => goTo(a.rif)} style={{ background: M, color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Apri</button>
            </div>
          ))}
          {alerts.length > 8 && <button onClick={() => setShowAll((v) => !v)} style={{ marginTop: 6, background: "transparent", border: "none", color: M, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>{showAll ? "Mostra meno" : `Mostra tutti (${alerts.length})`}</button>}
        </div>
      )}

      {props.length > 0 && (
        <div style={{ border: `2px solid ${ACC}`, background: "#FFF7F2", borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, color: "#9A3412", marginBottom: 8 }}>Da confermare · {props.length} {props.length === 1 ? "movimento letto" : "movimenti letti"} dalle mail</div>
          {props.map(([id, pr]) => (
            <div key={id} style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: T2 }}>{fd(pr.d)} · {pr.from} · <b>{pr.subj}</b>{pr.po ? ` · ${label(pr.po)}` : ""}</div>
              <div style={{ fontSize: 13, color: TXT, margin: "4px 0 8px", whiteSpace: "pre-wrap" }}>{pr.testo}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(pr.scelte || []).map((sc, i) => <button key={i} disabled={busy} onClick={() => applyProp(id, pr, sc)} style={{ background: M, color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{sc.lab}</button>)}
                <button disabled={busy} onClick={() => skipProp(id)} style={{ background: S0, color: T2, border: `1px solid ${BRD2}`, borderRadius: 10, padding: "7px 12px", fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Scarta</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)", background: S0, border: `1px solid ${BRD2}`, borderRadius: 14 }}>
        {view === "riep" && (
          <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "max-content", width: "100%" }}>
            <thead><tr><th style={thc}>{cfOn && <button onClick={() => setCf({})} title="Togli tutti i filtri" style={{ border: "none", background: RED, color: "#fff", borderRadius: 6, fontSize: 10, fontWeight: 800, padding: "2px 5px", cursor: "pointer" }}>✕</button>}</th>{FCOLS.map(([k, l, get]) => <FilterTh key={k} label={l} style={{ ...thc, textAlign: ["mod", "col", "note"].includes(k) ? "left" : "center" }} values={fOpts(k, get)} selected={cf[k] || []} onChange={(v) => setCf((c) => ({ ...c, [k]: v }))} />)}</tr></thead>
            <tbody>
              {shown.map((r) => { const s = (f) => (v) => wr(`po/${r.rif}/${f}`, v); const op = !!open[r.rif]; const nDet = by(pend, r.rif).length + by(rej, r.rif).length + by(res, r.rif).length; return (
                <Fragment key={r.rif}>
                  <tr id={"sch-" + r.rif} style={{ background: op ? ML : undefined }}>
                    <td style={{ ...td, textAlign: "center" }}><button onClick={() => setOpen((o) => ({ ...o, [r.rif]: !o[r.rif] }))} aria-label={`Dettaglio ${r.rif}`} style={{ border: `1px solid ${BRD2}`, background: S0, borderRadius: 6, width: 26, height: 24, cursor: "pointer", color: M, fontWeight: 900 }}>{op ? "−" : "+"}</button></td>
                    <td style={{ ...td, fontWeight: 800, fontFamily: MONO }}>{r.rif}{nDet ? <span style={{ color: ACC }}> •</span> : ""}</td>
                    <td style={td}><In v={r.p.mod} onSave={s("mod")} w={112} /></td>
                    <td style={td}><In v={r.p.col} onSave={s("col")} w={104} /></td>
                    <td style={td}><In v={r.p.po} onSave={s("po")} w={76} /></td>
                    <td style={td}><In v={r.p.bl} onSave={s("bl")} w={62} /></td>
                    <td style={nc}><In v={r.p.q} type="number" onSave={s("q")} w={46} center /></td>
                    <td style={nc}><In v={r.p.sped} type="number" onSave={s("sped")} w={46} center /></td>
                    <td style={{ ...nc, background: "#DCE5F3" }}>{r.saldo}</td>
                    <td style={nc}><In v={r.p.ready} type="number" onSave={s("ready")} w={46} center /></td>
                    <td style={nc}><In v={r.p.readyS} type="number" onSave={s("readyS")} w={46} center /></td>
                    <td style={{ ...nc, background: r.prod < 0 ? "#FFE4D6" : "#DCE5F3", color: r.prod < 0 ? "#9A3412" : TXT }} title={r.prod < 0 ? "Negativo: da noi + da STIL3 superano il saldo" : ""}>{r.prod}</td>
                    <td style={{ ...nc, color: r.rs ? "#854D0E" : T3 }}>{r.rs || "—"}</td>
                    <td style={{ ...nc, background: S1, color: r.pe ? T2 : BRD2 }}>{r.pe || "—"}</td>
                    <td style={{ ...nc, background: S1, color: r.rj ? T2 : BRD2 }}>{r.rj || "—"}</td>
                    <td style={td}><In v={r.p.note} onSave={s("note")} w={170} /></td>
                  </tr>
                  {op && (
                    <tr><td colSpan={16} style={{ ...td, background: S1, padding: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, margin: "2px 0 6px" }}>Pending dal QC (lato cliente)</div>
                      {by(pend, r.rif).length > 0 && pendTable(by(pend, r.rif), false)}
                      <div style={{ margin: "6px 0 12px" }}>{addBtn("pending", () => add("pend", r.rif, {}))}</div>
                      <div style={{ fontWeight: 800, fontSize: 12, margin: "2px 0 6px" }}>Rejected da rifare (lato cliente)</div>
                      {by(rej, r.rif).length > 0 && rejTable(by(rej, r.rif), false)}
                      <div style={{ margin: "6px 0 12px" }}>{addBtn("rejected", () => add("rej", r.rif, {}))}</div>
                      <div style={{ fontWeight: 800, fontSize: 12, margin: "2px 0 6px" }}>Mancanti: motivi e date (residui STIL3)</div>
                      {by(res, r.rif).length > 0 && resTable(by(res, r.rif), false)}
                      <div style={{ margin: "6px 0 4px" }}>{addBtn("residuo STIL3", () => add("res", r.rif, { bl: r.p.bl || "", stato: "Aperto" }))}</div>
                    </td></tr>
                  )}
                </Fragment>); })}
              <tr style={{ background: "#DCE5F3", fontWeight: 800 }}>
                <td style={td} colSpan={8}>TOTALE</td>
                <td style={nc}>{T.saldo}</td><td style={nc}>{T.ready}</td><td style={nc}>{T.readyS}</td><td style={nc}>{T.saldo - T.ready - T.readyS}</td><td style={nc}>{T.rs}</td><td style={nc}>{T.pe}</td><td style={nc}>{T.rj}</td><td style={td} />
              </tr>
            </tbody>
          </table>
        )}
        {view === "pend" && <div style={{ padding: 8 }}>{pendTable(filt(pend), true)}<div style={{ marginTop: 8 }}>{addBtn("pending", () => add("pend", "", {}))}</div></div>}
        {view === "rej" && <div style={{ padding: 8 }}>{rejTable(filt(rej), true)}<div style={{ marginTop: 8 }}>{addBtn("rejected", () => add("rej", "", {}))}</div></div>}
        {view === "res" && <div style={{ padding: 8 }}>{resTable(filt(res), true)}<div style={{ marginTop: 8 }}>{addBtn("residuo STIL3", () => add("res", "", { stato: "Aperto" }))}</div></div>}
      </div>
      {view === "riep" && nClosed > 0 && <button onClick={() => setShowClosed((v) => !v)} style={{ marginTop: 8, background: "transparent", border: "none", color: M, fontWeight: 800, cursor: "pointer", fontFamily: FONT, fontSize: 12 }}>{showClosed ? "Nascondi i PO chiusi" : `Mostra i PO chiusi (consegnati al 100%): ${nClosed}`}</button>}
      <div style={{ fontSize: 11, color: T3, marginTop: 8 }}>Lato interno: saldo da spedire = da noi + da STIL3 + mancanti (in rosso se negativo). "Di cui con motivo" = mancanti spiegati nelle righe Residui STIL3. Pending e rejected cliente: come risultano al controllo qualità di Chrome Hearts, solo informativi (le paia sono già comprese nel saldo).</div>
    </div>
  );
}

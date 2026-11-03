import { useState, useMemo, Fragment } from "react";
import { db, ref, set, update, get } from "./firebase.js";

/* ═══ SALDI CHROME HEARTS (uso INTERNO: contiene STIL3, non mostrare al cliente) ═══
   Database saldiCH/
     po/{rif}   = { o, mod, col, po, bl, q (ordine), sped (spedite al cliente), ready (pronte nel nostro magazzino),
                    readyS (pronte da STIL3), note }
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
const td = { padding: "3px 5px", borderBottom: `1px solid ${BRD}`, borderRight: `1px solid ${BRD}`, fontSize: 12, verticalAlign: "middle" };
const nc = { ...td, textAlign: "center", fontFamily: MONO, fontWeight: 700 };
const pill = (txt, bg, fg) => <span style={{ background: bg, color: fg, fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>{txt}</span>;
const stPill = (s) => s === "Chiuso" ? pill(s, "#DCFCE7", "#166534") : /RITARDO/.test(s) ? pill(s, "#FFE4D6", "#9A3412") : pill(s, "#FFF6D6", "#854D0E");

export default function SaldiChTab({ data }) {
  const [view, setView] = useState("riep");
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const D = data || {};
  const POs = useMemo(() => Object.entries(D.po || {}).sort((a, b) => num(a[1].o) - num(b[1].o)), [D.po]);
  const list = (k) => Object.entries(D[k] || {}).filter(([, x]) => x && x.po);
  const pend = list("pend"), rej = list("rej"), res = list("res");
  const props = Object.entries(D.prop || {}).filter(([, x]) => x && !x.stato).sort((a, b) => String(a[1].d).localeCompare(String(b[1].d)));
  const label = (rif) => { const p = (D.po || {})[rif]; return p ? `${rif} · ${p.mod} ${p.col}` : rif; };
  const rifOpts = POs.map(([r]) => r);

  const sum = (arr, f, rif) => arr.filter(([, x]) => x.po === rif).reduce((t, [, x]) => t + f(x), 0);
  const rows = POs.map(([rif, p]) => {
    const saldo = num(p.q) - num(p.sped), pe = sum(pend, pendOpen, rif), rj = sum(rej, rejOpen, rif), rs = sum(res, resOpen, rif);
    const prod = saldo - num(p.ready) - num(p.readyS) - pe - rj - rs;
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
  const shown = rows.filter((r) => !qq || `${r.rif} ${r.p.mod} ${r.p.col} ${r.p.po} ${r.p.bl}`.toUpperCase().includes(qq));
  const T = rows.reduce((t, r) => ({ saldo: t.saldo + r.saldo, ready: t.ready + num(r.p.ready), readyS: t.readyS + num(r.p.readyS), pe: t.pe + r.pe, rj: t.rj + r.rj, rs: t.rs + r.rs }), { saldo: 0, ready: 0, readyS: 0, pe: 0, rj: 0, rs: 0 });

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
        {kpi("Saldo ordini", T.saldo)}{kpi("Pronte da noi", T.ready, GRN)}{kpi("Pronte da STIL3", T.readyS, GRN)}{kpi("Pending aperti", T.pe, ACC)}{kpi("Rejected da rifare", T.rj, RED)}{kpi("Residuo STIL3", T.rs, "#854D0E")}
        <input placeholder="Cerca PO, modello, colore, blocco…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: "auto", alignSelf: "center", minWidth: 240, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "9px 12px", fontFamily: FONT, fontSize: 13 }} />
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
            <thead><tr>{["", "RIF", "Modello", "Colore", "PO", "Blocco Gea", "Q.tà ordine", "Spedite al cliente", "Saldo", "Pronte da noi", "Pronte da STIL3", "Pending aperti", "Rejected da rifare", "Residuo STIL3", "Ancora in produzione", "Note"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((r) => { const s = (f) => (v) => wr(`po/${r.rif}/${f}`, v); const op = !!open[r.rif]; const nDet = by(pend, r.rif).length + by(rej, r.rif).length + by(res, r.rif).length; return (
                <Fragment key={r.rif}>
                  <tr id={"sch-" + r.rif} style={{ background: op ? ML : undefined }}>
                    <td style={{ ...td, textAlign: "center" }}><button onClick={() => setOpen((o) => ({ ...o, [r.rif]: !o[r.rif] }))} aria-label={`Dettaglio ${r.rif}`} style={{ border: `1px solid ${BRD2}`, background: S0, borderRadius: 6, width: 26, height: 24, cursor: "pointer", color: M, fontWeight: 900 }}>{op ? "−" : "+"}</button></td>
                    <td style={{ ...td, fontWeight: 800, fontFamily: MONO }}>{r.rif}{nDet ? <span style={{ color: ACC }}> •</span> : ""}</td>
                    <td style={td}><In v={r.p.mod} onSave={s("mod")} w={150} /></td>
                    <td style={td}><In v={r.p.col} onSave={s("col")} w={140} /></td>
                    <td style={td}><In v={r.p.po} onSave={s("po")} w={92} /></td>
                    <td style={td}><In v={r.p.bl} onSave={s("bl")} w={80} /></td>
                    <td style={nc}><In v={r.p.q} type="number" onSave={s("q")} w={62} center /></td>
                    <td style={nc}><In v={r.p.sped} type="number" onSave={s("sped")} w={62} center /></td>
                    <td style={{ ...nc, background: "#DCE5F3" }}>{r.saldo}</td>
                    <td style={nc}><In v={r.p.ready} type="number" onSave={s("ready")} w={62} center /></td>
                    <td style={nc}><In v={r.p.readyS} type="number" onSave={s("readyS")} w={62} center /></td>
                    <td style={{ ...nc, color: r.pe ? ACC : T3 }}>{r.pe || "—"}</td>
                    <td style={{ ...nc, color: r.rj ? RED : T3 }}>{r.rj || "—"}</td>
                    <td style={{ ...nc, color: r.rs ? "#854D0E" : T3 }}>{r.rs || "—"}</td>
                    <td style={{ ...nc, background: r.prod < 0 ? "#FFE4D6" : "#DCE5F3", color: r.prod < 0 ? "#9A3412" : TXT }} title={r.prod < 0 ? "Negativo: qualche paio è contato due volte" : ""}>{r.prod}</td>
                    <td style={td}><In v={r.p.note} onSave={s("note")} w={320} /></td>
                  </tr>
                  {op && (
                    <tr><td colSpan={16} style={{ ...td, background: S1, padding: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, margin: "2px 0 6px" }}>Pending dal QC</div>
                      {by(pend, r.rif).length > 0 && pendTable(by(pend, r.rif), false)}
                      <div style={{ margin: "6px 0 12px" }}>{addBtn("pending", () => add("pend", r.rif, {}))}</div>
                      <div style={{ fontWeight: 800, fontSize: 12, margin: "2px 0 6px" }}>Rejected da rifare</div>
                      {by(rej, r.rif).length > 0 && rejTable(by(rej, r.rif), false)}
                      <div style={{ margin: "6px 0 12px" }}>{addBtn("rejected", () => add("rej", r.rif, {}))}</div>
                      <div style={{ fontWeight: 800, fontSize: 12, margin: "2px 0 6px" }}>Paia non spedite da STIL3</div>
                      {by(res, r.rif).length > 0 && resTable(by(res, r.rif), false)}
                      <div style={{ margin: "6px 0 4px" }}>{addBtn("residuo STIL3", () => add("res", r.rif, { bl: r.p.bl || "", stato: "Aperto" }))}</div>
                    </td></tr>
                  )}
                </Fragment>); })}
              <tr style={{ background: "#DCE5F3", fontWeight: 800 }}>
                <td style={td} colSpan={8}>TOTALE</td>
                <td style={nc}>{T.saldo}</td><td style={nc}>{T.ready}</td><td style={nc}>{T.readyS}</td><td style={nc}>{T.pe}</td><td style={nc}>{T.rj}</td><td style={nc}>{T.rs}</td>
                <td style={nc}>{T.saldo - T.ready - T.readyS - T.pe - T.rj - T.rs}</td><td style={td} />
              </tr>
            </tbody>
          </table>
        )}
        {view === "pend" && <div style={{ padding: 8 }}>{pendTable(filt(pend), true)}<div style={{ marginTop: 8 }}>{addBtn("pending", () => add("pend", "", {}))}</div></div>}
        {view === "rej" && <div style={{ padding: 8 }}>{rejTable(filt(rej), true)}<div style={{ marginTop: 8 }}>{addBtn("rejected", () => add("rej", "", {}))}</div></div>}
        {view === "res" && <div style={{ padding: 8 }}>{resTable(filt(res), true)}<div style={{ marginTop: 8 }}>{addBtn("residuo STIL3", () => add("res", "", { stato: "Aperto" }))}</div></div>}
      </div>
      <div style={{ fontSize: 11, color: T3, marginTop: 8 }}>Ancora in produzione = saldo − pronte da noi − pronte da STIL3 − pending − rejected − residuo STIL3. In rosso se negativo (qualcosa contato due volte).</div>
    </div>
  );
}

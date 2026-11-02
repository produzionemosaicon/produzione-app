import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { db, ref, set, update } from "./firebase.js";

/* ═══ Foglio SBLOCCHI: componenti, conformità, taglio e giunteria ═══
   Database:
     sblocchi/{id}      = una riga (modello) — vedi campi sotto
     sblocchiFoto/{id}  = foto in miniatura (data URL), separata per non appesantire la tabella
   Campi riga: o (ordine), cliente, stag, calz, modello, forma, paia, stato, pc, pm, ps (prove),
     sblocco, conf, taglio, note, orig, h (altezza riga), sb (true = totalmente sbloccato → Storico), sbAt (data),
     c/{COMPONENTE} = { k: codice, f: fornitore, s: sblocco }                                                  */

const COMP = ["FORMA", "SPERONE", "SOTTOPIEDE", "SCASSO", "FUSSBETT", "TACCO", "SUOLA"];
const PAGE = 80;

const norm = (v) => {
  v = String(v || "").trim().toUpperCase();
  if (!v) return "";
  if (["—", "-", "/", "NON SERVE", "NONSERVE", "⮾"].includes(v)) return "NS";
  if (v.startsWith("OK") || v === "GO" || /^\d/.test(v)) return "OK";
  if (v.startsWith("ESISTE") || v.includes("CARRY")) return "EX";
  if (v.includes("STAND") || v.includes("ATTEND") || v.includes("TBC") || v === "TBD") return "ATT";
  if (v.includes("DA FARE") || v.includes("DA RIVEDERE") || v === "NO" || v.startsWith("KO")) return "DA";
  return "ATT";
};

const getV = (r, k) => {
  if (k.startsWith("c.")) { const [, c, f] = k.split("."); return ((r.c || {})[c] || {})[f] ?? ""; }
  return r[k] ?? "";
};

function calc(r) {
  let tot = 0, ok = 0;
  COMP.forEach((k) => {
    const n = norm(getV(r, `c.${k}.s`));
    if (n && n !== "NS") { tot++; if (n === "OK" || n === "EX") ok++; }
  });
  const p = tot ? ok / tot : null;
  return { p, av: p === null ? "" : p === 1 ? "COMPLETO" : p === 0 ? "DA INIZIARE" : "IN CORSO" };
}
const avCls = (av) => (av === "COMPLETO" ? "OK" : av === "IN CORSO" ? "ATT" : av ? "DA" : "");

/* colonne: key, titolo, tipo (t testo, s stato, k calcolata, r origine, p foto, x selezione), larghezza, gruppo, ruotata, classi */
const COLS = (() => {
  const c = [
    ["sel", "", "x", 38, 0, 0, "f0"], ["cliente", "CLIENTE", "t", 100, 0, 0, "f1"], ["modello", "MODELLO", "t", 170, 0, 0, "f2"],
    ["stag", "STAG.", "t", 34, 0, 1, "n"], ["calz", "CALZ.", "t", 34, 0, 1, "n"], ["foto", "FOTO", "p", 84, 0, 0, ""],
    ["forma", "FORMA", "t", 110, 0, 0, ""], ["paia", "PAIA", "t", 56, 0, 0, ""], ["stato", "STATO GENERALE", "t", 230, 0, 0, ""],
    ["pc", "PROVA CALZATA", "s", 130, 1, 0, ""], ["pm", "PROVA MODELLO", "s", 130, 1, 0, ""], ["ps", "PROVA STRUTTURA", "s", 170, 1, 0, ""],
    ["sblocco", "SBLOCCO", "s", 34, 1, 1, "n"],
  ];
  COMP.forEach((k, i) => {
    const g = 2 + (i % 2);
    c.push([`c.${k}.k`, k === "FORMA" ? "FORMA (COD.)" : k, "t", k === "FORMA" ? 110 : 50, g, k === "FORMA" ? 0 : 1, k === "FORMA" ? "" : "n"]);
    c.push([`c.${k}.f`, `FORN. ${k}`, "t", 38, g, 1, "n fv"]);
    c.push([`c.${k}.s`, `SBL. ${k}`, "s", 34, g, 1, "n"]);
  });
  c.push(["conf", "CONFORMITÀ", "s", 34, 4, 1, "n"], ["taglio", "TAGLIO E TG.GIU.", "s", 34, 4, 1, "n"],
    ["pct", "% SBLOCCHI", "k", 58, 5, 1, "n"], ["av", "AVANZAMENTO", "k", 64, 5, 1, "n"],
    ["note", "NOTE", "t", 300, 5, 0, ""], ["orig", "ORIGINE", "r", 90, 5, 0, ""]);
  return c;
})();
const GNAME = ["Modello", "Prove", "Componenti", "Componenti", "Conformità e taglio", "Riepilogo"];
const OPT = [["OK", "OK", "#2fa866"], ["ESISTE", "ESISTE", "#3b7fd4"], ["DA FARE", "DA FARE", "#d9363e"], ["IN ATTESA", "IN ATTESA", "#d99a00"], ["—", "NON SERVE", "#9aa3b5"], ["", "svuota", "#d0d5e0"]];

const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignora */ } };
const fmtDate = (ts) => { if (!ts) return ""; const d = new Date(ts); return `${d.getDate()}/${d.getMonth() + 1}`; };
const dbSet = (path, v) => set(ref(db, path), v === undefined || v === "" ? null : v);

/* cella di testo modificabile: salva quando si esce dalla cella */
function Ce({ value, onCommit, editable, status, onMenu, onMenuClose }) {
  const el = useRef(null);
  useLayoutEffect(() => {
    const e = el.current;
    if (e && document.activeElement !== e && e.textContent !== String(value)) e.textContent = String(value);
  }, [value]);
  return (
    <div
      ref={el}
      className="ce"
      contentEditable={editable ? "plaintext-only" : false}
      suppressContentEditableWarning
      data-s={status ? 1 : undefined}
      onFocus={status && editable ? () => onMenu(el.current) : undefined}
      onBlur={(e) => { if (status && onMenuClose) onMenuClose(); const v = e.currentTarget.textContent; if (v !== String(value)) onCommit(v); }}
    />
  );
}

function resizeImage(file, max = 160) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.72));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

export default function SbloccoTab({ sbl, foto }) {
  const [mode, setMode] = useState(false); // false = Attivi, true = Storico
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("");
  const [fs, setFs] = useState("");
  const [fz, setFz] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState(() => new Set());
  const [rh, setRh] = useState(() => lsGet("sblRh", 72));
  const [zoom, setZoom] = useState(() => lsGet("sblZoom", 100));
  const [manual, setManual] = useState(() => lsGet("sblW", {}));
  const [auto, setAuto] = useState({});
  const [menu, setMenu] = useState(null); // { el, x, y }
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [newId, setNewId] = useState("");
  const [busy, setBusy] = useState("");
  const wrapRef = useRef(null);
  const tableRef = useRef(null);
  const drag = useRef(null);
  const phRow = useRef(null);
  const fileRef = useRef(null);

  const canEdit = true; // modificano tutti quelli che hanno accesso all'app

  const all = useMemo(() => Object.entries(sbl || {}).filter(([, r]) => r && typeof r === "object").map(([id, r]) => ({ ...r, id })).sort((a, b) => (a.o || 0) - (b.o || 0)), [sbl]);
  const base = useMemo(() => all.filter((r) => !!r.sb === mode), [all, mode]);
  const clients = useMemo(() => { const m = {}; base.forEach((r) => { const c = r.cliente || "—"; m[c] = (m[c] || 0) + 1; }); return m; }, [base]);
  const stags = useMemo(() => [...new Set(all.map((r) => r.stag).filter(Boolean))].sort(), [all]);
  const calzs = useMemo(() => [...new Set(all.map((r) => r.calz).filter(Boolean))].sort(), [all]);
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return base.filter((r) => (!fc || (r.cliente || "—") === fc) && (!fs || r.stag === fs) && (!fz || r.calz === fz) && (!ql || `${r.cliente} ${r.modello} ${r.note} ${r.stato}`.toLowerCase().includes(ql)));
  }, [base, q, fc, fs, fz]);
  const shown = list.slice(0, limit);
  const paiaTot = list.reduce((a, r) => a + (+r.paia || 0), 0);

  useEffect(() => { if (fc && !clients[fc]) setFc(""); }, [clients, fc]);
  useEffect(() => { setSel(new Set()); setLimit(PAGE); setFc(""); }, [mode]);
  useEffect(() => { lsSet("sblRh", rh); }, [rh]);
  useEffect(() => { lsSet("sblZoom", zoom); }, [zoom]);
  const zRef = useRef(1); zRef.current = zoom / 100;

  const W = COLS.map((c, i) => manual[c[0]] ?? auto[c[0]] ?? c[3]);
  const o1 = W[0], o2 = W[0] + W[1];
  const totalW = W.reduce((a, b) => a + b, 0);

  /* adatta la larghezza delle colonne verticali al loro testo */
  useLayoutEffect(() => {
    const t = tableRef.current; if (!t) return;
    const next = {};
    COLS.forEach((c, i) => {
      if (!c[5] || c[2] === "k") return;
      let m = 0;
      t.querySelectorAll(`tbody tr td:nth-child(${i + 1}) .ce`).forEach((e) => { m = Math.max(m, e.offsetWidth); });
      const hv = t.querySelector(`thead th[data-ci="${i}"] .v`);
      next[c[0]] = Math.max(30, Math.ceil(Math.max(m + 10, (hv ? hv.offsetWidth : 0) + 10)));
    });
    setAuto((prev) => (COLS.some((c) => next[c[0]] !== undefined && next[c[0]] !== prev[c[0]]) ? { ...prev, ...next } : prev));
  }, [shown, sbl]);

  const flash = (msg, undo) => { setToast({ msg, undo }); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(null), 6000); };

  const commit = (id, key, v) => { if (!canEdit) return; dbSet(`sblocchi/${id}/${key.startsWith("c.") ? key.replace(/\./g, "/") : key}`, key === "paia" ? (v === "" ? "" : (Number.isFinite(+v) ? +v : v)) : v); };

  /* menu a tendina per le celle di stato */
  const openMenu = useCallback((el) => {
    const r = el.getBoundingClientRect();
    const h = 6 * 38 + 16;
    setMenu({ el, x: Math.min(Math.max(8, r.left + r.width / 2 - 80), window.innerWidth - 168), y: r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4 });
  }, []);
  useEffect(() => {
    const off = () => setMenu(null);
    const w = wrapRef.current;
    if (w) w.addEventListener("scroll", off);
    return () => { if (w) w.removeEventListener("scroll", off); };
  }, []);
  const pickMenu = (v) => {
    const el = menu && menu.el; if (!el) return;
    el.textContent = v; el.blur(); setMenu(null); // uscendo dalla cella il valore viene salvato
  };

  /* ridimensiona colonne e righe */
  useEffect(() => {
    const mv = (e) => {
      const d = drag.current; if (!d) return;
      const p = e.touches ? e.touches[0] : e;
      if (d.kind === "col") {
        const w = Math.max(24, Math.round(d.w0 + (p.clientX - d.x) / zRef.current));
        setManual((m) => ({ ...m, [d.key]: w }));
      } else {
        const h = Math.max(36, Math.round(d.h0 + (p.clientY - d.y) / zRef.current - 2));
        d.tr.style.setProperty("--rh", h + "px"); d.h = h;
      }
      if (e.cancelable && e.touches) e.preventDefault();
    };
    const up = () => {
      const d = drag.current; if (!d) return;
      if (d.kind === "col") setManual((m) => { lsSet("sblW", m); return m; });
      else if (d.h && canEdit) dbSet(`sblocchi/${d.id}/h`, d.h);
      d.el.classList.remove("dr"); drag.current = null;
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", mv, { passive: false }); window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up); };
  }, [canEdit]);
  const startCol = (e, i) => { e.preventDefault(); const p = e.touches ? e.touches[0] : e; drag.current = { kind: "col", key: COLS[i][0], x: p.clientX, w0: W[i], el: e.currentTarget }; e.currentTarget.classList.add("dr"); };
  const startRow = (e, id) => { e.preventDefault(); const tr = e.currentTarget.closest("tr"), p = e.touches ? e.touches[0] : e; drag.current = { kind: "row", tr, id, y: p.clientY, h0: tr.getBoundingClientRect().height / zRef.current, el: e.currentTarget }; e.currentTarget.classList.add("dr"); };

  /* selezione, sblocco → storico */
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (on) => setSel(on ? new Set(shown.map((r) => r.id)) : new Set());
  const moveSel = (toStorico) => {
    const ids = [...sel]; if (!ids.length || !canEdit) return;
    const prev = ids.map((id) => [id, (sbl[id] || {}).sb || null, (sbl[id] || {}).sbAt || null]);
    const up = {}; const now = Date.now();
    ids.forEach((id) => { up[`sblocchi/${id}/sb`] = toStorico ? true : null; up[`sblocchi/${id}/sbAt`] = toStorico ? now : null; });
    update(ref(db), up);
    setSel(new Set());
    flash(`${ids.length} ${ids.length === 1 ? "articolo spostato" : "articoli spostati"} ${toStorico ? "nello Storico" : "in Produzione"}`, () => {
      const u = {}; prev.forEach(([id, s, a]) => { u[`sblocchi/${id}/sb`] = s; u[`sblocchi/${id}/sbAt`] = a; }); update(ref(db), u);
    });
  };

  /* foto */
  const pickFoto = (id) => { if (!canEdit) return; phRow.current = id; if (fileRef.current) { fileRef.current.value = ""; fileRef.current.click(); } };
  const onFoto = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f || !phRow.current) return;
    try { await dbSet(`sblocchiFoto/${phRow.current}`, await resizeImage(f)); } catch (err) { window.alert("Foto non caricata: " + err.message); }
  };

  /* aggiungi articolo */
  const addArticle = async (f) => {
    const minO = all.reduce((m, r) => Math.min(m, r.o || 0), 1);
    const id = "n" + Date.now().toString(36);
    const row = { o: minO - 1, cliente: f.cliente, stag: f.stag || null, calz: f.calz || null, modello: f.modello, forma: f.forma || null, paia: f.paia === "" ? null : +f.paia, stato: f.stato || null, orig: "PRODUZIONE", ts: Date.now() };
    Object.keys(row).forEach((k) => (row[k] === null || row[k] === "") && delete row[k]);
    await set(ref(db, `sblocchi/${id}`), row);
    setMode(false); setFc(""); setModal(null); setNewId(id);
    setTimeout(() => setNewId(""), 2500);
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
    flash("Articolo aggiunto in cima alla produzione");
  };

  /* importa lo storico dal file Excel (una volta sola) */
  const importSeed = async () => {
    if (!window.confirm("Caricare nell'app le 555 righe del file Excel «Modelleria Mosaicon» (32 attivi + storico)?")) return;
    setBusy("Carico i dati…");
    try {
      const seed = (await import("./sbloccoSeed.json")).default;
      const up = {};
      seed.rows.forEach((r, i) => { const id = "s" + String(i).padStart(4, "0"); up[`sblocchi/${id}`] = r; if (seed.foto[i]) up[`sblocchiFoto/${id}`] = seed.foto[i]; });
      await update(ref(db), up);
      setBusy("");
      flash("Dati importati");
    } catch (e) { console.error(e); setBusy(""); window.alert("Import non riuscito: " + e.message); }
  };

  const head = () => {
    const groups = []; let last = -1;
    COLS.forEach((c) => { if (c[4] !== last) { groups.push([c[4], 1]); last = c[4]; } else groups[groups.length - 1][1]++; });
    return (
      <thead>
        <tr className="g">{groups.map((g, i) => <th key={i} colSpan={g[1]} className={`g${g[0]}`}>{GNAME[g[0]]}</th>)}</tr>
        <tr className="h">
          {COLS.map((c, i) => (
            <th key={c[0]} data-ci={i} className={`g${c[4]} ${c[6].split(" ").filter((x) => x.length === 2 && x[0] === "f").join(" ")}${c[5] ? " rot" : ""}`}>
              {c[2] === "x" ? (canEdit ? <input type="checkbox" checked={shown.length > 0 && shown.every((r) => sel.has(r.id))} onChange={(e) => toggleAll(e.target.checked)} aria-label="Seleziona tutti" /> : null) : c[5] ? <span className="v">{c[1]}</span> : c[1]}
              <span className="rz" onMouseDown={(e) => startCol(e, i)} onTouchStart={(e) => startCol(e, i)} />
            </th>
          ))}
        </tr>
      </thead>
    );
  };

  const cell = (r, c) => {
    const [key, , type, , , rot, cls] = c;
    if (type === "x") {
      const x = calc(r);
      return (
        <td key={key} className={`sel f0 acc-${avCls(x.av) || "NS"}`}>
          {canEdit && <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} aria-label="Seleziona riga" />}
          {canEdit && <div className="rh" onMouseDown={(e) => startRow(e, r.id)} onTouchStart={(e) => startRow(e, r.id)} title="Trascina per cambiare l'altezza della riga" />}
        </td>
      );
    }
    if (type === "k") {
      const x = calc(r);
      return <td key={key} className={`calc ${key === "av" ? avCls(x.av) : ""} n`}>{key === "pct" ? (x.p === null ? "" : Math.round(x.p * 100) + "%") : x.av}</td>;
    }
    if (type === "r") return <td key={key} className="orig">{r.orig || ""}{r.sbAt ? <><br /><b>sbloccato {fmtDate(r.sbAt)}</b></> : null}</td>;
    if (type === "p") {
      const f = (foto || {})[r.id];
      return <td key={key} className="ph" onClick={() => pickFoto(r.id)}>{f ? <img src={f} alt="" /> : <span>{canEdit ? "+ foto" : ""}</span>}</td>;
    }
    const v = String(getV(r, key));
    const st = type === "s";
    return (
      <td key={key} className={`${st ? "s " + norm(v) : ""} ${rot ? "vt" : ""} ${cls}`.trim()} onClick={rot && canEdit ? (e) => { const ce = e.currentTarget.querySelector(".ce"); if (ce && e.target !== ce) ce.focus(); } : undefined}>
        <Ce value={v} editable={canEdit} status={st} onMenu={openMenu} onMenuClose={() => setMenu(null)} onCommit={(nv) => commit(r.id, key, nv)} />
      </td>
    );
  };

  const empty = all.length === 0;

  return (
    <div className="sbl" style={{ ["--rh"]: rh + "px", ["--o1"]: o1 + "px", ["--o2"]: o2 + "px" }}>
      <style>{CSS}</style>
      <div className="panel">
        <div className="bar">
          <div className="seg">
            <button className={!mode ? "on" : ""} onClick={() => setMode(false)}>Attivi</button>
            <button className={mode ? "on" : ""} onClick={() => setMode(true)}>Storico</button>
          </div>
          <input className="srch" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Cerca modello, note…" />
          <button className="btn pri" onClick={() => setModal("add")}>+ Aggiungi articolo</button>
          <label className="hs">Altezza righe <input type="range" min="44" max="200" value={rh} onChange={(e) => setRh(+e.target.value)} /></label>
          <label className="hs">Zoom <input type="range" min="40" max="160" value={zoom} onChange={(e) => setZoom(+e.target.value)} /><span className="zv">{zoom}%</span></label>
          <select value={fs} onChange={(e) => { setFs(e.target.value); setLimit(PAGE); }}><option value="">Tutte le stagioni</option>{stags.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={fz} onChange={(e) => { setFz(e.target.value); setLimit(PAGE); }}><option value="">Tutti i calzaturifici</option>{calzs.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={fc} onChange={(e) => { setFc(e.target.value); setLimit(PAGE); }}><option value="">Tutti i clienti ({base.length})</option>{Object.keys(clients).sort().map((c) => <option key={c} value={c}>{c} ({clients[c]})</option>)}</select>
        </div>
      </div>

      {empty && canEdit && (
        <div className="ro imp">
          <b>Il foglio è vuoto.</b> Puoi caricare i dati del file Excel «Modelleria Mosaicon» (articoli attivi, storico e foto).{" "}
          <button className="btn pri" onClick={importSeed} disabled={!!busy}>{busy || "Importa dal file Excel"}</button>
        </div>
      )}
      {sel.size > 0 && canEdit && (
        <div className="bulk">
          <b>{sel.size} {sel.size === 1 ? "articolo selezionato" : "articoli selezionati"}</b>
          {mode ? <button className="btn" onClick={() => moveSel(false)}>↩ Riporta in produzione</button> : <button className="btn ok" onClick={() => moveSel(true)}>✔ Segna come totalmente sbloccato → Storico</button>}
          <button className="btn" onClick={() => setSel(new Set())}>Deseleziona</button>
        </div>
      )}
      <div className="meta">
        <div><b>{list.length}</b> modelli · <b>{paiaTot.toLocaleString("it")}</b> paia</div>
        <div className="tip">Trascina il bordo di un'intestazione per allargare la colonna · clic su una cella di stato per il menu, o scrivi liberamente (anche a capo){canEdit ? " · trascina il bordo in basso della casella a sinistra per l'altezza di una riga" : ""}</div>
      </div>

      <div className="wrap" ref={wrapRef}>
        <table ref={tableRef} style={{ width: totalW, zoom: zoom / 100 }}>
          <colgroup>{W.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
          {head()}
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} data-id={r.id} className={r.id === newId ? "newrow" : ""} style={r.h ? { ["--rh"]: r.h + "px" } : undefined}>
                {COLS.map((c) => cell(r, c))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > limit && <div className="more"><button className="btn" onClick={() => setLimit((l) => l + PAGE)}>Mostra altri {Math.min(PAGE, list.length - limit)} ({list.length - limit} rimasti)</button></div>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFoto} />

      {menu && (
        <div className="smenu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()}>
          {OPT.map((o) => <button key={o[1]} onClick={() => pickMenu(o[0])}><i style={{ background: o[2] }} />{o[1]}</button>)}
        </div>
      )}
      {toast && <div className="toast"><span>{toast.msg}</span>{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Annulla</button>}</div>}
      {modal === "add" && <AddModal rows={all} onClose={() => setModal(null)} onSave={addArticle} />}
    </div>
  );
}

function AddModal({ rows, onClose, onSave }) {
  const [f, setF] = useState({ cliente: "", stag: "", calz: "", modello: "", forma: "", paia: "", stato: "" });
  const clients = [...new Set(rows.map((r) => r.cliente).filter(Boolean))].sort();
  const inp = (k, l, props = {}, cls = "") => (<label className={cls}>{l}<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></label>);
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="box">
        <h2>Aggiungi articolo</h2>
        <div className="g2c">
          <label>Cliente<input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} list="sbl-cl" autoComplete="off" autoFocus /><datalist id="sbl-cl">{clients.map((c) => <option key={c} value={c} />)}</datalist></label>
          {inp("stag", "Stagione", { placeholder: "es. FW27" })}
          {inp("modello", "Modello", {}, "full")}
          {inp("calz", "Calzaturificio", { placeholder: "MOS, STIL3, MACB…" })}
          {inp("paia", "Paia", { type: "number", min: 0 })}
          {inp("forma", "Forma", {}, "full")}
          <label className="full">Stato generale / appunti<textarea rows={3} value={f.stato} onChange={(e) => setF({ ...f, stato: e.target.value })} /></label>
        </div>
        <div className="acts">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn pri" disabled={!f.modello.trim() && !f.cliente.trim()} onClick={() => onSave({ ...f, cliente: f.cliente.trim(), modello: f.modello.trim() })}>Aggiungi alla produzione</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.sbl{--ink:#18213a;--mut:#6b7691;--line:#e1e6f0;--rowline:#b9c3da;--bg:#eef1f8;--navy:#1b2748;--acc:#3556a8;
--ok:#c6efd6;--okt:#0b6636;--da:#ffd3d7;--dat:#a30f1b;--att:#ffe6a8;--attt:#7c5200;--ex:#cde1fa;--ext:#174a8c;--ns:#e9edf3;--nst:#97a1b6;
font:13px/1.35 'Inter',-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg);padding-bottom:90px;min-height:100%}
.sbl *{box-sizing:border-box}
.sbl .panel{background:#fff;margin:12px 14px 0;border:1px solid var(--line);border-radius:14px}
.sbl .bar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;align-items:center}
@media(min-width:1100px){.sbl .bar{flex-wrap:nowrap}.sbl .bar>*{flex:none}.sbl .bar .srch{flex:1 1 120px!important;min-width:110px}.sbl .bar select{max-width:150px;padding:9px 8px}.sbl .hs input{width:70px}.sbl .hs{font-size:12px;white-space:nowrap}.sbl .btn{white-space:nowrap}}
.sbl .zv{min-width:34px;font-variant-numeric:tabular-nums;color:var(--ink)}
.sbl .bar input.srch,.sbl .bar select{padding:9px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;min-width:0;background:#fff;color:var(--ink)}
.sbl .bar input.srch{flex:1 1 200px}
.sbl .seg{display:flex;background:#eef1f7;border-radius:10px;padding:3px}.sbl .seg button{border:0;background:transparent;padding:7px 16px;font:inherit;cursor:pointer;border-radius:8px;color:var(--mut);font-weight:600}.sbl .seg button.on{background:#fff;color:var(--navy);box-shadow:0 1px 3px rgba(20,30,60,.12)}
.sbl .chips{display:flex;gap:6px;padding:2px 12px 12px;overflow-x:auto}
.sbl .chips button{flex:none;border:1px solid var(--line);background:#fff;border-radius:99px;padding:6px 13px;font:inherit;cursor:pointer;color:var(--ink);font-weight:500}.sbl .chips button.on{background:var(--navy);color:#fff;border-color:var(--navy)}.sbl .chips small{opacity:.6;margin-left:6px;font-weight:600}
.sbl .meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 16px 6px;color:var(--mut)}.sbl .meta b{color:var(--ink)}.sbl .tip{font-size:12px}
.sbl .btn{border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer;color:var(--ink)}.sbl .btn:hover{border-color:#aab6d0}.sbl .btn.pri{background:var(--acc);border-color:var(--acc);color:#fff}.sbl .btn.ok{background:#1f9d5a;border-color:#1f9d5a;color:#fff}.sbl .btn:disabled{opacity:.5;cursor:default}
.sbl .hs{display:flex;align-items:center;gap:8px;color:var(--mut);font-weight:600}.sbl .hs input{width:100px;accent-color:#3556a8}
.sbl .bulk{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 14px 0;padding:10px 14px;background:#fff8e1;border:1px solid #f2dc8b;border-radius:12px}.sbl .bulk b{color:#6b4e00}
.sbl .ro{margin:10px 14px 0;padding:10px 14px;background:#fff;border:1px solid var(--line);border-radius:12px;color:var(--mut)}.sbl .ro.imp{background:#fff0ea;border-color:#ffd2bf;color:var(--ink)}
.sbl .wrap{overflow:auto;max-height:calc(100vh - 235px);margin:0 14px 14px;border:1px solid var(--line);border-radius:14px;background:#fff}
.sbl table{border-collapse:separate;border-spacing:0;table-layout:fixed}
.sbl th,.sbl td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:0;background:#fff;overflow:hidden}
.sbl tbody tr:nth-child(even) td{background:#f4f6fc}
.sbl tbody td{border-bottom:2px solid var(--rowline)}
.sbl tbody tr:last-child td{border-bottom:0}
.sbl thead th{position:sticky;top:0;z-index:3;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.05em;padding:6px 4px;text-align:center;vertical-align:middle;border-right:1px solid rgba(255,255,255,.18);border-bottom:0}
.sbl thead tr.g th{font-size:10px;text-transform:uppercase;letter-spacing:.14em;padding:7px 4px}
.sbl thead tr.h th{top:30px}
.sbl .g0{background:#1b2748!important}.sbl .g1{background:#3556a8!important}.sbl .g2{background:#1f8a80!important}.sbl .g3{background:#5b4bb0!important}.sbl .g4{background:#c2691d!important}.sbl .g5{background:#475167!important}
.sbl th .rz{position:absolute;right:0;top:0;bottom:0;width:8px;cursor:col-resize;z-index:6}.sbl th .rz:hover,.sbl th .rz.dr{background:rgba(255,255,255,.5)}
.sbl th{position:sticky}
.sbl th.rot{height:132px;padding:8px 0}.sbl th.rot .v{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap}
.sbl td{text-align:center;vertical-align:middle}
.sbl .ce{display:flex;align-items:center;justify-content:center;text-align:center;min-height:var(--rh);padding:6px 8px;white-space:pre-wrap;overflow-wrap:anywhere;outline:0;font:inherit;line-height:1.3;cursor:text}
.sbl .ce:focus{box-shadow:inset 0 0 0 2px #3b6fd4;background:#fff!important;color:var(--ink)!important;position:relative;z-index:1}
.sbl td.n:not(.vt) .ce{padding:4px 2px;font-size:11px}
.sbl .vt{cursor:text}
.sbl .vt .ce{display:inline-block;vertical-align:middle;writing-mode:vertical-rl;transform:rotate(180deg);min-height:44px;min-width:1.5em;max-height:150px;padding:8px 3px;white-space:pre-wrap;overflow-wrap:normal;text-align:center;font-weight:700;letter-spacing:.03em;font-size:11px;line-height:1.35}
.sbl .vt.fv .ce{font-weight:600;letter-spacing:0}
.sbl td.s .ce{font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:.02em}
.sbl td.s.vt .ce{font-size:11px;min-height:44px}
.sbl td.OK{background:var(--ok)!important;color:var(--okt)}.sbl td.DA{background:var(--da)!important;color:var(--dat)}.sbl td.ATT{background:var(--att)!important;color:var(--attt)}.sbl td.EX{background:var(--ex)!important;color:var(--ext)}.sbl td.NS{background:var(--ns)!important;color:var(--nst)}
.sbl .f0,.sbl .f1,.sbl .f2{position:sticky;z-index:2}.sbl .f0{left:0}.sbl .f1{left:var(--o1)}.sbl .f2{left:var(--o2);box-shadow:3px 0 6px -3px rgba(20,30,60,.25)}
.sbl tbody td.f0,.sbl tbody td.f1,.sbl tbody td.f2{background:#fff}.sbl tbody tr:nth-child(even) td.f0,.sbl tbody tr:nth-child(even) td.f1,.sbl tbody tr:nth-child(even) td.f2{background:#f4f6fc}
.sbl thead .f0,.sbl thead .f1,.sbl thead .f2{z-index:5}
.sbl .f1 .ce,.sbl .f2 .ce{font-weight:700}
.sbl td.calc{font-weight:700;font-size:11px;padding:0 2px}
.sbl td.orig{color:#6b7488;font-size:11.5px}.sbl td.orig b{color:#1f9d5a}
.sbl td.ph{cursor:pointer;padding:4px}.sbl td.ph img{display:block;margin:auto;max-width:100%;max-height:calc(var(--rh) - 8px);object-fit:contain;border-radius:6px}.sbl td.ph span{color:var(--mut);font-size:11px}
.sbl td.sel{position:relative}.sbl td.sel input,.sbl th input[type=checkbox]{width:18px;height:18px;margin:0;cursor:pointer;accent-color:#3556a8}
.sbl td.sel .rh{position:absolute;left:0;right:0;bottom:0;height:9px;cursor:row-resize;z-index:4}.sbl td.sel .rh:hover,.sbl td.sel .rh.dr{background:linear-gradient(transparent,rgba(53,86,168,.5))}
.sbl td.acc-OK{box-shadow:inset 5px 0 0 #2fa866}.sbl td.acc-ATT{box-shadow:inset 5px 0 0 #e0a100}.sbl td.acc-DA{box-shadow:inset 5px 0 0 #d9363e}.sbl td.acc-NS{box-shadow:inset 5px 0 0 #c3cad8}
.sbl tr.newrow td{animation:sblfl 2.2s ease-out}@keyframes sblfl{0%{background:#fff3b0}}
.sbl .smask{position:fixed;inset:0;z-index:48}
.sbl .smenu{position:fixed;z-index:50;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(20,30,60,.22);padding:6px;min-width:150px}
.sbl .smenu button{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;padding:8px 10px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer;text-align:left;color:var(--ink)}.sbl .smenu button:hover{background:#eef2fb}
.sbl .smenu i{width:12px;height:12px;border-radius:4px;display:inline-block}
.sbl .more{padding:0 14px 20px}
.sbl .toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);background:#1b2748;color:#fff;padding:11px 16px;border-radius:12px;display:flex;gap:14px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:60}.sbl .toast button{background:transparent;border:0;color:#9ec1ff;font:inherit;font-weight:700;cursor:pointer}
.sbl .modal{position:fixed;inset:0;background:rgba(20,28,50,.5);display:flex;align-items:center;justify-content:center;z-index:70;padding:16px}
.sbl .modal .box{background:#fff;border-radius:16px;padding:20px;width:min(520px,100%);box-shadow:0 20px 60px rgba(0,0,0,.35);max-height:92vh;overflow:auto}
.sbl .modal h2{margin:0 0 14px;font-size:17px}.sbl .modal .g2c{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sbl .modal label{display:grid;gap:4px;font-size:12px;color:var(--mut);font-weight:600}.sbl .modal input,.sbl .modal textarea{padding:10px;border:1px solid var(--line);border-radius:10px;font:inherit;color:var(--ink);width:100%}.sbl .modal .full{grid-column:1/-1}.sbl .modal .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
@media(max-width:520px){.sbl .modal .g2c{grid-template-columns:1fr}.sbl .wrap{max-height:calc(100vh - 300px)}}
`;

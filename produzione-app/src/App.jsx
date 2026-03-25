import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { db, ref, set, onValue } from "./firebase.js";

/* ═══ COLORI ═══ */
const M = "#1A5CFF", ML = "#EBF0FF";
const E = "#00A896", EL = "#E6FAF8";
const ACC = "#FF5200", ACL = "#FFF0EA";
const BG = "#EDF2F7";
const S0 = "#fff", S1 = "#F7F9FC", S2 = "#EEF2F8";
const BRD = "#DDE4EF", BRD2 = "#C8D4E4";
const TXT = "#0D1B2A", T2 = "#5A7494", T3 = "#9BB0C8";
const GRN = "#00B87A", RED = "#E53E3E";
const FONT = "'Outfit', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const TIMES = ["10:00", "12:00", "15:00", "17:00"];

const bc = (b) => (b === "MOSAICON" ? M : E);
const bl = (b) => (b === "MOSAICON" ? ML : EL);

/* ═══ STAZIONI DEFAULT ═══ */
const DEF_STATIONS = {
  MOSAICON: [
    { id: "m1",  name: "QC TOMAIE" },
    { id: "m2",  name: "TIMBRO" },
    { id: "m3",  name: "SPACC+SCARN" },
    { id: "m4",  name: "ALESSANDRA" },
    { id: "m5",  name: "PATRIZIA" },
    { id: "m6",  name: "STEFANIA" },
    { id: "m7",  name: "CARICAMENTO" },
    { id: "m8",  name: "ALESSANDRO R" },
    { id: "m9",  name: "OSMAN" },
    { id: "m10", name: "ZOUHEIR" },
    { id: "m11", name: "SGROSSA+RIBATTA" },
    { id: "m12", name: "SMER. NICHOLAS" },
    { id: "m13", name: "SMER. GIUSEPPE" },
    { id: "m14", name: "SMER. THOMAS" },
    { id: "m15", name: "COLLA" },
    { id: "m16", name: "PRESSA THOMAS" },
    { id: "m17", name: "PRESSA MICHAEL" },
    { id: "m18", name: "PREFISSA MICHAEL" },
    { id: "m19", name: "LAVAGGIO" },
    { id: "m20", name: "INCHIODATURA" },
    { id: "m21", name: "SOTTOPIEDI Alina" },
    { id: "m22", name: "SOTTOPIEDI Franc" },
    { id: "m23", name: "ANTONELLA" },
    { id: "m24", name: "ALESSIA" },
    { id: "m25", name: "ROSY" },
    { id: "m26", name: "ALESSANDRA (fin.)" },
    { id: "m27", name: "NADIA" },
    { id: "m28", name: "ALICE" },
    { id: "m29", name: "ELENA" },
    { id: "m30", name: "MONICA" },
    { id: "m31", name: "SARA" },
    { id: "m_t", name: "TOTALE INGUARNITO", isTotal: true },
    { id: "m32", name: "INSCATOLAMENTO" },
  ],
  EMOS: [
    { id: "e1",  name: "CARICAMENTO" },
    { id: "e2",  name: "MONTAGGIO M" },
    { id: "e3",  name: "MONTAGGIO" },
    { id: "e4",  name: "SMERIGLIA" },
    { id: "e5",  name: "COLLA" },
    { id: "e6",  name: "PRESSA" },
    { id: "e7",  name: "INCHIODATURA" },
    { id: "e8",  name: "LAVAGGIO" },
    { id: "e9",  name: "SOTTOPIEDI" },
    { id: "e10", name: "PULIZIA SOTTOPIEDE" },
    { id: "e11", name: "ILEANA" },
    { id: "e12", name: "ALBA" },
    { id: "e13", name: "SIMONA" },
    { id: "e14", name: "VALENTINA" },
    { id: "e15", name: "MARTINA" },
    { id: "e16", name: "ANTONELLA" },
    { id: "e17", name: "BARBARA" },
    { id: "e_t", name: "TOT. INGUARNITO", isTotal: true },
    { id: "e18", name: "INSCATOLAMENTO" },
    { id: "e19", name: "DA INSCATOLARE/GIÀ CQ" },
  ],
};

/* ═══ HELPERS ═══ */
const todayStr = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtD = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
function lastVal(rDay, brand, sid) {
  for (const t of ["17:00", "15:00", "12:00", "10:00"]) {
    const v = rDay?.[brand]?.[sid]?.[t.replace(":", "_")]?.value;
    if (v !== undefined && v !== "" && !isNaN(+v)) return +v;
  }
  return null;
}

/* ═══ APP ROOT ═══ */
export default function App() {
  const [tab,       setTab]      = useState("home");
  const [date,      setDate]     = useState(todayStr);
  const [stations,  setStations] = useState(DEF_STATIONS);
  const [reports,   setReports]  = useState({});
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [online,    setOnline]   = useState(navigator.onLine);
  const [savedKeys, setSavedKeys]= useState(new Set());

  const [cellModal, setCellModal] = useState(null);
  const [cellVal,   setCellVal]   = useState("");
  const [cellNote,  setCellNote]  = useState("");
  const [stModal,   setStModal]   = useState(null);
  const [stNewName, setStNewName] = useState("");
  const [addModal,  setAddModal]  = useState(null);
  const [addName,   setAddName]   = useState("");

  const [anBrand, setAnBrand] = useState("MOSAICON");
  const [anSid,   setAnSid]   = useState("");
  const [anFrom,  setAnFrom]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [anTo,  setAnTo]  = useState(todayStr);
  const [anRes, setAnRes] = useState(null);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    return onValue(ref(db, "stations"), (snap) => { if (snap.exists()) setStations(snap.val()); });
  }, []);

  useEffect(() => {
    return onValue(ref(db, "reports"), (snap) => {
      if (snap.exists()) setReports(snap.val());
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const saveStations = useCallback(async (s) => {
    setStations(s);
    try { await set(ref(db, "stations"), s); } catch (e) { console.error(e); }
  }, []);

  const saveCell = useCallback(async (val, note) => {
    const { brand, sid, t } = cellModal;
    const tKey = t.replace(":", "_");
    const flashKey = `${brand}_${sid}_${tKey}`;
    setSaving(true);
    try {
      await set(ref(db, `reports/${date}/${brand}/${sid}/${tKey}`), { value: val, note });
      await set(ref(db, `reports/${date}/_meta`), { date, ts: Date.now(), updated: Date.now() });
      setSavedKeys(prev => new Set([...prev, flashKey]));
      setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(flashKey); return n; }), 1500);
    } catch (e) { console.error(e); }
    setSaving(false);
    setCellModal(null);
  }, [cellModal, date]);

  const getV = (brand, sid, t) =>
    reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.value ?? "";
  const getN = (brand, sid, t) =>
    reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.note ?? "";

  function openCell(brand, sid, t, name) {
    setCellVal(reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.value ?? "");
    setCellNote(reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.note ?? "");
    setCellModal({ brand, sid, t, name });
  }

  async function renameStation(brand, sid, name) {
    await saveStations({ ...stations, [brand]: stations[brand].map(s => s.id === sid ? { ...s, name } : s) });
    setStModal(null);
  }
  async function deleteStation(brand, sid) {
    await saveStations({ ...stations, [brand]: stations[brand].filter(s => s.id !== sid) });
    setStModal(null);
  }
  async function addStation(brand, afterId, name) {
    const arr = stations[brand];
    const idx = afterId ? arr.findIndex(s => s.id === afterId) : arr.length - 1;
    const ns = { ...stations, [brand]: [...arr.slice(0, idx + 1), { id: `${brand[0].toLowerCase()}_${uid()}`, name: name.trim() }, ...arr.slice(idx + 1)] };
    await saveStations(ns);
    setAddModal(null); setAddName("");
  }
  async function moveStation(brand, sid, dir) {
    const arr = [...stations[brand]];
    const i = arr.findIndex(s => s.id === sid);
    if (dir === "up"   && i > 0)              [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
    if (dir === "down" && i < arr.length - 1) [arr[i+1], arr[i]] = [arr[i], arr[i+1]];
    await saveStations({ ...stations, [brand]: arr });
  }

  async function shareWA() {
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const el = document.getElementById("print-doc");
      if (el) {
        el.style.display = "block";
        el.style.width = "800px";
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        el.style.display = "none";
        el.style.width = "";

        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgW  = pageW;
        const imgH  = (canvas.height * pageW) / canvas.width;

        if (imgH <= pageH) {
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
        } else {
          const pxPerPage = Math.floor((canvas.height * pageH) / imgH);
          let offsetY = 0, page = 0;
          while (offsetY < canvas.height) {
            if (page > 0) pdf.addPage();
            const slice = document.createElement("canvas");
            slice.width  = canvas.width;
            slice.height = pxPerPage;
            const ctx = slice.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, slice.width, slice.height);
            ctx.drawImage(canvas, 0, -offsetY);
            pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, imgW, pageH);
            offsetY += pxPerPage;
            page++;
          }
        }

        const blob = pdf.output("blob");
        const file = new File([blob], `produzione_${date}.pdf`, { type: "application/pdf" });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Produzione ${fmtD(date)}` });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `produzione_${date}.pdf`; a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.warn("PDF fallback a testo", e);
    }
    let txt = `📊 Produzione ${fmtD(date)}\n\n`;
    for (const brand of ["MOSAICON", "EMOS"]) {
      txt += `━ ${brand} ━\n`;
      for (const st of stations[brand]) {
        if (TIMES.some(t => getV(brand, st.id, t)))
          txt += `${st.name}: ${TIMES.map(t => getV(brand, st.id, t) || "—").join(" | ")}\n`;
      }
      txt += "\n";
    }
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`);
  }

  function runAnalysis() {
    const stList = stations[anBrand] || [];
    const sid = anSid || stList.find(s => s.isTotal)?.id || stList[0]?.id;
    const stName = stList.find(s => s.id === sid)?.name || "";
    const pts = [];
    const cur = new Date(anFrom), end = new Date(anTo);
    while (cur <= end) {
      const d = cur.toISOString().split("T")[0];
      const v = lastVal(reports[d], anBrand, sid);
      if (v !== null) pts.push({ date: d, label: fmtD(d), value: v });
      cur.setDate(cur.getDate() + 1);
    }
    if (!pts.length) { setAnRes({ empty: true, stName, brand: anBrand }); return; }
    const vals = pts.map(p => p.value);
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = +(total / vals.length).toFixed(1);
    const max = Math.max(...vals), min = Math.min(...vals);
    const trend = vals.length > 1 ? +((vals[vals.length-1] - vals[0]) / vals[0] * 100).toFixed(1) : 0;
    setAnRes({ stName, brand: anBrand, sid, from: anFrom, to: anTo, pts, total, avg, max, min, trend,
      days: pts.length, maxDay: pts[vals.indexOf(max)], minDay: pts[vals.indexOf(min)] });
  }

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100dvh", background:BG, fontFamily:FONT, gap:12 }}>
      <div style={{ fontSize:40 }}>🏭</div>
      <div style={{ fontSize:16, fontWeight:700, color:TXT }}>Caricamento dati…</div>
      <div style={{ width:120, height:3, background:BRD, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:"60%", height:"100%", background:M, animation:"load 1.2s ease-in-out infinite alternate" }} />
      </div>
      <style>{`@keyframes load{from{width:20%}to{width:90%}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth:900, margin:"0 auto", minHeight:"100dvh", display:"flex", flexDirection:"column", background:BG, fontFamily:FONT }}>
      <style>{`
        @keyframes cellFlash { 0%{background:rgba(0,184,122,0)} 30%{background:rgba(0,184,122,0.25)} 100%{background:rgba(0,184,122,0)} }
        .cell-flash { animation: cellFlash 1.5s ease-out forwards; }
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${BRD2};border-radius:2px}
        @media print{.no-print{display:none!important}.print-only{display:block!important}body{background:#fff}}
        .print-only{display:none}
      `}</style>

      {/* TOP BAR */}
      <div className="no-print" style={{ background:"linear-gradient(135deg,#0A3D9C 0%,#1A5CFF 55%,#0099CC 100%)", padding:"12px 16px", flexShrink:0, boxShadow:"0 3px 18px rgba(26,92,255,0.28)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:24 }}>🏭</span>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:"#fff", letterSpacing:"0.04em" }}>MOSAICON · EMOS</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background: online ? GRN : RED }} />
                <span style={{ fontSize:8, color:"rgba(255,255,255,0.65)", fontWeight:600 }}>
                  {online ? "In linea" : "Offline"}{saving ? " · salvataggio…" : ""}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ border:"none", background:"rgba(255,255,255,0.18)", fontFamily:MONO, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", outline:"none", padding:"5px 10px", borderRadius:8 }} />
            <button onClick={shareWA}
              style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"7px 13px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:FONT }}>
              📤 PDF
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="no-print" style={{ flex:1, overflowY:"auto" }}>
        {tab === "home"    && <HomeTab date={date} reports={reports} stations={stations} onGoFoglio={() => setTab("foglio")} />}
        {tab === "foglio"  && <FoglioTab stations={stations} getV={getV} getN={getN} openCell={openCell} savedKeys={savedKeys}
          onEditSt={(brand, st) => { setStModal({ brand, st }); setStNewName(st.name); }}
          onAddSt={(brand, afterId) => { setAddModal({ brand, afterId }); setAddName(""); }} />}
        {tab === "storico" && <StoricoTab reports={reports} stations={stations} onOpen={d => { setDate(d); setTab("foglio"); }} />}
        {tab === "analisi" && <AnalisiTab stations={stations} reports={reports}
          anBrand={anBrand} setAnBrand={setAnBrand} anSid={anSid} setAnSid={setAnSid}
          anFrom={anFrom} setAnFrom={setAnFrom} anTo={anTo} setAnTo={setAnTo}
          anRes={anRes} run={runAnalysis} />}
      </div>

      {/* PRINT DOC nascosto, usato da html2canvas */}
      <div id="print-doc" style={{ display:"none", padding:"24px 28px", background:"#fff" }}>
        <PrintDoc date={date} stations={stations} getV={getV} getN={getN} />
      </div>

      {/* BOTTOM NAV */}
      <div className="no-print" style={{ background:S0, borderTop:`1px solid ${BRD}`, display:"flex", flexShrink:0, boxShadow:"0 -2px 12px rgba(13,27,42,0.07)" }}>
        {[
          { id:"home",    icon:"🏠", label:"Home" },
          { id:"foglio",  icon:"📋", label:"Foglio" },
          { id:"storico", icon:"📁", label:"Storico" },
          { id:"analisi", icon:"📊", label:"Analisi" },
        ].map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex:1, background:"none", border:"none", padding:"10px 4px 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontFamily:FONT }}>
            <span style={{ fontSize:19 }}>{icon}</span>
            <span style={{ fontSize:9, fontWeight:700, color: tab === id ? M : T3 }}>{label}</span>
            {tab === id && <div style={{ width:20, height:2, background:M, borderRadius:1 }} />}
          </button>
        ))}
      </div>

      {/* CELL MODAL */}
      {cellModal && (
        <Modal onClose={() => setCellModal(null)}>
          <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>
            {cellModal.brand} · {cellModal.t}
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:TXT, marginBottom:14 }}>{cellModal.name}</div>
          <input type="number" inputMode="decimal" autoFocus value={cellVal}
            onChange={e => setCellVal(e.target.value)}
            style={{ width:"100%", background:BG, border:`2.5px solid ${bc(cellModal.brand)}`, borderRadius:12, padding:14, fontFamily:MONO, fontSize:34, fontWeight:700, color:bc(cellModal.brand), textAlign:"center", outline:"none", marginBottom:12 }} />
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ width:7, height:7, background:ACC, borderRadius:"50%" }} />
            <span style={{ fontSize:9, fontWeight:700, color:ACC, letterSpacing:"0.1em", textTransform:"uppercase" }}>Commento</span>
            <span style={{ marginLeft:"auto", fontSize:8, color:T3 }}>max 30 car.</span>
          </div>
          <input type="text" value={cellNote} onChange={e => setCellNote(e.target.value.slice(0, 30))}
            placeholder="Appare sotto il numero…"
            style={{ width:"100%", background:BG, border:`1.5px solid ${BRD}`, borderRadius:10, padding:"10px 12px", fontSize:13, color:TXT, outline:"none", marginBottom:14, fontFamily:FONT }} />
          <Btn color={bc(cellModal.brand)} onClick={() => saveCell(cellVal, cellNote)}>✓ SALVA</Btn>
          {(cellVal || cellNote) && <Btn color={BG} textColor={T2} style={{ marginTop:8 }} onClick={() => saveCell("", "")}>Cancella valore</Btn>}
          <Btn color={BG} textColor={T3} style={{ marginTop:8 }} onClick={() => setCellModal(null)}>Annulla</Btn>
        </Modal>
      )}

      {/* STATION MODAL */}
      {stModal && (
        <Modal onClose={() => setStModal(null)}>
          <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>Stazione · {stModal.brand}</div>
          <div style={{ fontSize:18, fontWeight:800, color:TXT, marginBottom:14 }}>{stModal.st.name}</div>
          <input autoFocus value={stNewName} onChange={e => setStNewName(e.target.value)} placeholder="Nuovo nome…"
            style={{ width:"100%", background:BG, border:`2px solid ${bc(stModal.brand)}`, borderRadius:10, padding:"11px 12px", fontSize:15, color:TXT, outline:"none", marginBottom:12, fontFamily:FONT }} />
          <Btn color={bc(stModal.brand)} onClick={() => stNewName.trim() && renameStation(stModal.brand, stModal.st.id, stNewName.trim())}>✓ RINOMINA</Btn>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={() => { moveStation(stModal.brand, stModal.st.id, "up");   setStModal(null); }} style={{ flex:1, background:BG, border:`1px solid ${BRD}`, borderRadius:8, padding:9, fontSize:14, cursor:"pointer" }}>⬆ Su</button>
            <button onClick={() => { moveStation(stModal.brand, stModal.st.id, "down"); setStModal(null); }} style={{ flex:1, background:BG, border:`1px solid ${BRD}`, borderRadius:8, padding:9, fontSize:14, cursor:"pointer" }}>⬇ Giù</button>
          </div>
          {!stModal.st.isTotal && (
            <Btn color="#FEE2E2" textColor={RED} style={{ marginTop:8 }}
              onClick={() => { if (window.confirm(`Eliminare "${stModal.st.name}"?`)) deleteStation(stModal.brand, stModal.st.id); }}>
              🗑 Elimina stazione
            </Btn>
          )}
          <Btn color={BG} textColor={T3} style={{ marginTop:8 }} onClick={() => setStModal(null)}>Annulla</Btn>
        </Modal>
      )}

      {/* ADD MODAL */}
      {addModal && (
        <Modal onClose={() => setAddModal(null)}>
          <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>Nuova stazione · {addModal.brand}</div>
          <div style={{ fontSize:18, fontWeight:800, color:TXT, marginBottom:14 }}>Aggiungi stazione</div>
          <input autoFocus value={addName} onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addName.trim() && addStation(addModal.brand, addModal.afterId, addName)}
            placeholder="Nome stazione…"
            style={{ width:"100%", background:BG, border:`2px solid ${bc(addModal.brand)}`, borderRadius:10, padding:"11px 12px", fontSize:15, color:TXT, outline:"none", marginBottom:14, fontFamily:FONT }} />
          <Btn color={bc(addModal.brand)} onClick={() => addName.trim() && addStation(addModal.brand, addModal.afterId, addName)}>+ AGGIUNGI</Btn>
          <Btn color={BG} textColor={T3} style={{ marginTop:8 }} onClick={() => setAddModal(null)}>Annulla</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ═══ HOME TAB ═══ */
function HomeTab({ date, reports, stations, onGoFoglio }) {
  const getTot = (rDay, brand) => {
    const t = stations[brand]?.find(s => s.isTotal);
    return t ? lastVal(rDay, brand, t.id) : null;
  };

  const rToday = reports[date];
  const rYest  = reports[yesterdayStr()];

  const mTod  = getTot(rToday, "MOSAICON");
  const eTod  = getTot(rToday, "EMOS");
  const mYest = getTot(rYest,  "MOSAICON");
  const eYest = getTot(rYest,  "EMOS");
  const combined     = (mTod  ?? 0) + (eTod  ?? 0);
  const combinedYest = (mYest ?? 0) + (eYest ?? 0);

  const pct = (a, b) => (b && a !== null) ? +(((a - b) / b) * 100).toFixed(1) : null;

  const last7 = useMemo(() => {
    const pts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const m = getTot(reports[ds], "MOSAICON") ?? 0;
      const e = getTot(reports[ds], "EMOS")     ?? 0;
      pts.push({ label:`${d.getDate()}/${d.getMonth()+1}`, MOSAICON:m, EMOS:e, total:m+e });
    }
    return pts;
  }, [reports]);

  return (
    <div style={{ padding:"16px 14px", fontFamily:FONT }}>

      <div style={{ marginBottom:14, padding:"10px 16px", background:S0, borderRadius:16, border:`1px solid ${BRD}`, boxShadow:"0 2px 10px rgba(13,27,42,0.05)" }}>
        <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:2 }}>
          {date === todayStr() ? "Oggi" : "Data selezionata"}
        </div>
        <div style={{ fontSize:18, fontWeight:800, color:TXT }}>
          {new Date(date + "T12:00:00").toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        {[
          { brand:"MOSAICON", val:mTod, yest:mYest, color:M },
          { brand:"EMOS",     val:eTod, yest:eYest, color:E },
        ].map(({ brand, val, yest, color }) => {
          const p = pct(val, yest);
          const isUp = p !== null && p >= 0;
          return (
            <div key={brand} style={{ background:S0, borderRadius:16, border:`1.5px solid ${color}30`, padding:"14px 13px", boxShadow:"0 2px 10px rgba(13,27,42,0.05)", borderLeft:`4px solid ${color}` }}>
              <div style={{ fontSize:8, fontWeight:700, color, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>{brand}</div>
              <div style={{ fontFamily:MONO, fontSize:32, fontWeight:700, color, lineHeight:1, marginBottom:6 }}>{val ?? "—"}</div>
              {p !== null && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:3, background: isUp ? "#DCFCE7" : "#FEE2E2", borderRadius:6, padding:"2px 7px", marginBottom:4 }}>
                  <span style={{ fontSize:9, fontWeight:800, color: isUp ? GRN : RED }}>{isUp ? "▲" : "▼"} {Math.abs(p)}%</span>
                </div>
              )}
              {yest !== null && yest !== undefined && <div style={{ fontSize:9, color:T3 }}>ieri: {yest}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ background:"linear-gradient(135deg,#0A3D9C,#1A5CFF 60%,#0099CC)", borderRadius:18, padding:"18px 20px", marginBottom:16, boxShadow:"0 6px 24px rgba(26,92,255,0.28)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.6)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>Totale combinato</div>
          <div style={{ fontFamily:MONO, fontSize:44, fontWeight:700, color:"#fff", lineHeight:1 }}>{combined || "—"}</div>
          {combinedYest > 0 && (() => { const p = pct(combined, combinedYest); return p !== null ? (
            <div style={{ marginTop:6, fontSize:11, fontWeight:700, color: p >= 0 ? "#86EFAC" : "#FCA5A5" }}>
              {p >= 0 ? "▲" : "▼"} {Math.abs(p)}% rispetto a ieri ({combinedYest})
            </div>
          ) : null; })()}
        </div>
        <div style={{ fontSize:40, opacity:0.35 }}>🏭</div>
      </div>

      <div style={{ background:S0, borderRadius:16, border:`1px solid ${BRD}`, padding:"14px 10px 10px", marginBottom:16, boxShadow:"0 2px 10px rgba(13,27,42,0.05)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:T2, paddingLeft:6, marginBottom:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>Ultimi 7 giorni</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={last7} margin={{ top:4, right:8, left:0, bottom:0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke={BRD} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize:8, fill:T3, fontFamily:MONO }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:8, fill:T3, fontFamily:MONO }} axisLine={false} tickLine={false} width={34} />
            <Tooltip contentStyle={{ background:S0, border:`1px solid ${BRD}`, borderRadius:8, fontFamily:FONT, fontSize:12 }}
              labelStyle={{ color:TXT, fontWeight:700 }} />
            <Bar dataKey="MOSAICON" fill={M} radius={[4,4,0,0]} maxBarSize={20} />
            <Bar dataKey="EMOS"     fill={E} radius={[4,4,0,0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button onClick={onGoFoglio}
        style={{ width:"100%", background:S0, border:`1.5px solid ${BRD}`, borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:FONT, boxShadow:"0 2px 10px rgba(13,27,42,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:24 }}>📋</span>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:700, color:TXT }}>Inserisci dati produzione</div>
            <div style={{ fontSize:10, color:T2, marginTop:2 }}>Apri il foglio di oggi</div>
          </div>
        </div>
        <span style={{ fontSize:22, color:BRD2 }}>›</span>
      </button>

      <div style={{ height:24 }} />
    </div>
  );
}

/* ═══ FOGLIO TAB ═══ */
function FoglioTab({ stations, getV, getN, openCell, savedKeys, onEditSt, onAddSt }) {
  return (
    <div>
      {["MOSAICON", "EMOS"].map(brand => (
        <div key={brand} style={{ marginTop: brand === "EMOS" ? 16 : 0 }}>

          {/* Brand header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:bl(brand), borderBottom:`2px solid ${bc(brand)}`, borderLeft:`5px solid ${bc(brand)}`, position:"sticky", top:0, zIndex:10 }}>
            <span style={{ fontSize:17, fontWeight:900, color:bc(brand), letterSpacing:"0.12em" }}>{brand}</span>
            <span style={{ fontFamily:MONO, fontSize:13, fontWeight:800, background:`${bc(brand)}20`, color:bc(brand), padding:"4px 14px", borderRadius:20 }}>
              {(() => {
                const tot = stations[brand]?.find(s => s.isTotal);
                if (!tot) return "—";
                const v = ["17:00","15:00","12:00","10:00"].reduce((a, t) => {
                  const val = getV(brand, tot.id, t);
                  return a || (val && !isNaN(+val) ? val : null);
                }, null);
                return v ? `TOT ${v}` : "—";
              })()}
            </span>
          </div>

          {/* Time header */}
          <div style={{ display:"grid", gridTemplateColumns:"130px repeat(4,1fr)", padding:"6px 10px 6px 14px", background:S2, borderBottom:`1px solid ${BRD}`, position:"sticky", top:48, zIndex:9 }}>
            <div style={{ fontSize:9, fontWeight:700, color:T2, letterSpacing:"0.1em", textTransform:"uppercase", display:"flex", alignItems:"center" }}>STAZIONE</div>
            {TIMES.map(t => (
              <div key={t} style={{ fontSize:12, fontWeight:800, color:bc(brand), textAlign:"center", borderLeft:`1px solid ${BRD}`, fontFamily:MONO, display:"flex", alignItems:"center", justifyContent:"center", padding:"4px 0" }}>{t}</div>
            ))}
          </div>

          {/* Rows */}
          {stations[brand]?.map((st, idx) => {
            const hasNote = TIMES.some(t => getN(brand, st.id, t));
            const isTotal = !!st.isTotal;
            return (
              <div key={st.id} style={{ display:"grid", gridTemplateColumns:"130px repeat(4,1fr)", background: isTotal ? bl(brand) : idx%2===0 ? S0 : S1, borderBottom:`1px solid ${BRD}`, borderLeft: isTotal ? `5px solid ${bc(brand)}` : hasNote ? `4px solid ${ACC}` : "4px solid transparent", minHeight:54 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 6px 8px 10px", overflow:"hidden" }}>
                  <span style={{ flex:1, fontSize: isTotal ? 12 : 11, fontWeight: isTotal ? 900 : 700, color: isTotal ? bc(brand) : hasNote ? ACC : TXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>{st.name}</span>
                  <button onClick={() => onEditSt(brand, st)} style={{ flexShrink:0, fontSize:8, background:S2, border:`1px solid ${BRD2}`, color:T2, borderRadius:4, padding:"2px 5px", cursor:"pointer", lineHeight:1.5 }}>✏</button>
                </div>
                {TIMES.map(t => {
                  const v = getV(brand, st.id, t);
                  const n = getN(brand, st.id, t);
                  const flashKey = `${brand}_${st.id}_${t.replace(":","_")}`;
                  return (
                    <button key={t}
                      className={savedKeys.has(flashKey) ? "cell-flash" : ""}
                      onClick={() => openCell(brand, st.id, t, st.name)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderLeft:`1px solid ${BRD}`, background: v ? `${bc(brand)}12` : "transparent", cursor:"pointer", gap:3, padding:"6px 4px", width:"100%", height:"100%", minHeight:54, border:"none", borderLeft:`1px solid ${BRD}`, transition:"background 0.2s" }}>
                      <span style={{ fontFamily:MONO, fontSize: v ? 18 : 13, fontWeight: v ? 800 : 400, color: v ? bc(brand) : "#C8D8E8", lineHeight:1 }}>{v || "—"}</span>
                      {n && <span style={{ fontSize:7.5, color:ACC, background:ACL, border:"1px solid rgba(255,82,0,0.2)", borderRadius:4, padding:"1px 5px", maxWidth:58, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.4 }}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Add station */}
          <button onClick={() => onAddSt(brand, stations[brand]?.[stations[brand].length-1]?.id)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", margin:"8px 12px", background:S0, border:`1.5px dashed ${BRD2}`, borderRadius:10, cursor:"pointer", fontFamily:FONT, width:"calc(100% - 24px)" }}>
            <span style={{ width:20, height:20, borderRadius:5, background:bl(brand), color:bc(brand), display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, flexShrink:0 }}>+</span>
            <span style={{ fontSize:11, fontWeight:600, color:T2 }}>Aggiungi stazione {brand}</span>
          </button>
        </div>
      ))}
      <div style={{ height:24 }} />
    </div>
  );
}


/* ═══ STORICO TAB ═══ */
function StoricoTab({ reports, stations, onOpen }) {
  const sorted = useMemo(() =>
    Object.keys(reports).filter(k => reports[k]._meta).sort((a,b) => b.localeCompare(a)),
  [reports]);

  if (!sorted.length) return (
    <div style={{ padding:40, textAlign:"center", color:T3, fontFamily:FONT }}>
      <div style={{ fontSize:42, marginBottom:12 }}>📁</div>
      <div style={{ fontSize:15, fontWeight:700, color:TXT }}>Nessun report ancora</div>
      <div style={{ fontSize:12, marginTop:6 }}>I dati si salvano automaticamente su Firebase.</div>
    </div>
  );

  return (
    <div style={{ fontFamily:FONT }}>
      {sorted.map((d, idx) => {
        const rDay = reports[d];
        const mTot = (() => { const t = stations.MOSAICON?.find(s => s.isTotal); return t ? lastVal(rDay,"MOSAICON",t.id) : null; })();
        const eTot = (() => { const t = stations.EMOS?.find(s => s.isTotal);     return t ? lastVal(rDay,"EMOS",    t.id) : null; })();
        const notesN = ["MOSAICON","EMOS"].flatMap(b =>
          (stations[b]||[]).flatMap(s => TIMES.filter(t => rDay?.[b]?.[s.id]?.[t.replace(":","_")]?.note))
        ).length;
        const dt = new Date(d + "T12:00:00");
        return (
          <button key={d} onClick={() => onOpen(d)}
            style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background: idx%2===0 ? S0 : S1, border:"none", borderBottom:`1px solid ${BRD}`, width:"100%", cursor:"pointer", textAlign:"left", fontFamily:FONT }}>
            <div style={{ flexShrink:0, textAlign:"center", width:36 }}>
              <div style={{ fontFamily:MONO, fontSize:22, fontWeight:800, color:M, lineHeight:1 }}>{String(dt.getDate()).padStart(2,"0")}</div>
              <div style={{ fontSize:8, fontWeight:700, color:T3, letterSpacing:"0.06em", textTransform:"uppercase" }}>{dt.toLocaleDateString("it-IT",{month:"short"})}</div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:TXT, textTransform:"capitalize" }}>
                {dt.toLocaleDateString("it-IT",{weekday:"long"})} {fmtD(d)}
              </div>
              <div style={{ display:"flex", gap:5, marginTop:5, flexWrap:"wrap" }}>
                {mTot !== null && <span style={{ fontFamily:MONO, fontSize:8, fontWeight:700, background:ML, color:M, padding:"2px 7px", borderRadius:4 }}>MOA {mTot}</span>}
                {eTot !== null && <span style={{ fontFamily:MONO, fontSize:8, fontWeight:700, background:EL, color:E, padding:"2px 7px", borderRadius:4 }}>EMS {eTot}</span>}
                {notesN > 0   && <span style={{ fontSize:8, fontWeight:700, background:ACL, color:ACC, padding:"2px 7px", borderRadius:4 }}>{notesN} nota{notesN>1?"e":""}</span>}
              </div>
            </div>
            <span style={{ fontSize:20, color:BRD2, flexShrink:0 }}>›</span>
          </button>
        );
      })}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ═══ ANALISI TAB ═══ */
function AnalisiTab({ stations, reports, anBrand, setAnBrand, anSid, setAnSid, anFrom, setAnFrom, anTo, setAnTo, anRes, run }) {
  const stList = stations[anBrand] || [];
  const sidEff = anSid || stList.find(s => s.isTotal)?.id || stList[0]?.id;

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ background:S0, borderBottom:`1px solid ${BRD}`, padding:"14px 14px 16px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 }}>Filtri analisi</div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {["MOSAICON","EMOS"].map(b => (
            <button key={b} onClick={() => { setAnBrand(b); setAnSid(""); }}
              style={{ flex:1, padding:10, background: anBrand===b ? bl(b) : BG, border:`1.5px solid ${anBrand===b ? bc(b) : BRD}`, borderRadius:10, fontSize:12, fontWeight:800, color: anBrand===b ? bc(b) : T3, cursor:"pointer", fontFamily:FONT }}>{b}</button>
          ))}
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T2, marginBottom:5, letterSpacing:"0.08em", textTransform:"uppercase" }}>Stazione</div>
          <select value={sidEff} onChange={e => setAnSid(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${BRD}`, borderRadius:10, fontSize:13, color:TXT, background:BG, outline:"none", fontFamily:FONT, cursor:"pointer" }}>
            {stList.map(s => <option key={s.id} value={s.id}>{s.name}{s.isTotal?" ★":""}</option>)}
          </select>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          {[["DAL", anFrom, setAnFrom],["AL", anTo, setAnTo]].map(([label, val, setter]) => (
            <div key={label}>
              <div style={{ fontSize:9, fontWeight:700, color:T2, marginBottom:5, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
              <input type="date" value={val} onChange={e => setter(e.target.value)}
                style={{ width:"100%", padding:"9px 10px", border:`1.5px solid ${BRD}`, borderRadius:10, fontSize:12, color:TXT, background:BG, outline:"none", fontFamily:MONO }} />
            </div>
          ))}
        </div>
        <button onClick={run}
          style={{ width:"100%", padding:13, background:bc(anBrand), color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:FONT }}>
          📊 ANALIZZA
        </button>
      </div>

      {anRes && (
        <div style={{ padding:14 }}>
          {anRes.empty ? (
            <div style={{ textAlign:"center", padding:32, color:T3 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
              <div style={{ fontSize:14, fontWeight:700, color:TXT }}>Nessun dato trovato</div>
              <div style={{ fontSize:12, marginTop:6 }}>per <strong>{anRes.stName}</strong> nel periodo selezionato</div>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:bc(anRes.brand), letterSpacing:"0.08em", marginBottom:1 }}>{anRes.brand}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:TXT }}>{anRes.stName}</div>
                  <div style={{ fontSize:10, color:T2, marginTop:2, fontFamily:MONO }}>{fmtD(anRes.from)} → {fmtD(anRes.to)} · {anRes.days} gg</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                <KpiSmall label="Totale periodo"    value={anRes.total} color={bc(anRes.brand)} sub={`in ${anRes.days} giorni`} />
                <KpiSmall label="Media giornaliera" value={anRes.avg}   color={bc(anRes.brand)} sub="paia/giorno" />
                <KpiSmall label="Giorno migliore"   value={anRes.max}   color={GRN} sub={fmtD(anRes.maxDay?.date)} arrow="▲" />
                <KpiSmall label="Giorno peggiore"   value={anRes.min}   color={anRes.min < anRes.avg*0.8 ? RED : T2} sub={fmtD(anRes.minDay?.date)} arrow="▼" />
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, padding:"12px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:42, height:42, borderRadius:12, background: anRes.trend>=0 ? "#DCFCE7" : "#FEE2E2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                  {anRes.trend >= 0 ? "📈" : "📉"}
                </div>
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:T2, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:2 }}>Variazione periodo</div>
                  <div style={{ fontSize:26, fontWeight:800, color: anRes.trend>=0 ? GRN : RED, fontFamily:MONO, lineHeight:1 }}>
                    {anRes.trend>=0?"+":""}{anRes.trend}%
                  </div>
                  <div style={{ fontSize:10, color:T3, marginTop:2 }}>dal primo all'ultimo giorno rilevato</div>
                </div>
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, padding:"14px 6px 10px", marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T2, paddingLeft:10, marginBottom:10 }}>{anRes.stName} — andamento</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={anRes.pts} margin={{ top:4, right:14, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BRD} />
                    <XAxis dataKey="label" tick={{ fontSize:8, fill:T3, fontFamily:MONO }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize:8, fill:T3, fontFamily:MONO }} width={38} />
                    <Tooltip contentStyle={{ background:S0, border:`1px solid ${BRD}`, borderRadius:8, fontFamily:FONT, fontSize:12 }}
                      labelStyle={{ color:TXT, fontWeight:700 }} formatter={v => [v, anRes.stName]} />
                    <ReferenceLine y={anRes.avg} stroke={T3} strokeDasharray="4 4"
                      label={{ value:`avg ${anRes.avg}`, position:"insideTopRight", fontSize:9, fill:T3, fontFamily:MONO }} />
                    <Line type="monotone" dataKey="value" stroke={bc(anRes.brand)} strokeWidth={2.5}
                      dot={{ r:3, fill:bc(anRes.brand) }} activeDot={{ r:5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, overflow:"hidden", marginBottom:14 }}>
                <div style={{ padding:"10px 14px", borderBottom:`1px solid ${BRD}`, fontSize:10, fontWeight:700, color:T2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Dettaglio giornaliero</div>
                {[...anRes.pts].reverse().map((pt, i) => (
                  <div key={pt.date} style={{ display:"flex", alignItems:"center", padding:"10px 14px", background: i%2===0 ? S0 : S1, borderBottom:`1px solid ${BRD}` }}>
                    <div style={{ flex:1, fontSize:12, fontWeight:600, color:TXT }}>{pt.label}</div>
                    <div style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color: pt.value===anRes.max ? GRN : pt.value===anRes.min ? RED : bc(anRes.brand), marginRight:12 }}>{pt.value}</div>
                    <div style={{ width:60, height:5, background:BRD, borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${(pt.value/anRes.max)*100}%`, height:"100%", background:bc(anRes.brand), borderRadius:3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ═══ PRINT DOC ═══ */
function PrintDoc({ date, stations, getV, getN }) {
  const G = { display:"grid", gridTemplateColumns:"180px repeat(4,1fr)" };
  return (
    <div style={{ fontFamily:FONT, background:"#fff", padding:"24px 28px" }}>

      <div style={{ background:"linear-gradient(135deg,#0A3D9C,#1A5CFF 55%,#009FCC)", padding:"16px 20px", marginBottom:24, borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:28 }}>🏭</span>
          <div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.65)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:3 }}>Report Produzione Giornaliero</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:"0.08em" }}>MOSAICON + EMOS</div>
          </div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.2)", color:"#fff", fontFamily:MONO, fontSize:16, fontWeight:700, padding:"8px 16px", borderRadius:8 }}>{fmtD(date)}</div>
      </div>

      {["MOSAICON","EMOS"].map(brand => (
        <div key={brand} style={{ marginBottom:28 }}>

          <div style={{ ...G, background:bl(brand), borderLeft:`5px solid ${bc(brand)}`, padding:"10px 12px", borderRadius:"10px 10px 0 0" }}>
            <div style={{ fontSize:13, fontWeight:900, color:bc(brand), letterSpacing:"0.12em", display:"flex", alignItems:"center" }}>{brand}</div>
            {TIMES.map(t => (
              <div key={t} style={{ fontSize:12, fontWeight:800, color:bc(brand), textAlign:"center", fontFamily:MONO, borderLeft:`1px solid ${bc(brand)}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>{t}</div>
            ))}
          </div>

          {stations[brand]?.map((st, i) => {
            const isTotal = !!st.isTotal;
            const hasNote = TIMES.some(t => getN(brand, st.id, t));
            return (
              <div key={st.id} style={{ ...G, background: isTotal ? bl(brand) : i%2===0 ? "#fff" : S1, borderBottom:`1px solid ${BRD}`, borderLeft: isTotal ? `5px solid ${bc(brand)}` : hasNote ? `3px solid ${ACC}` : "5px solid transparent", minHeight:46 }}>
                <div style={{ display:"flex", alignItems:"center", padding:"8px 10px 8px 14px" }}>
                  <span style={{ fontSize: isTotal ? 11 : 10, fontWeight: isTotal ? 900 : 600, color: isTotal ? bc(brand) : hasNote ? ACC : TXT }}>{st.name}</span>
                </div>
                {TIMES.map(t => {
                  const v = getV(brand, st.id, t);
                  const n = getN(brand, st.id, t);
                  return (
                    <div key={t} style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderLeft:`1px solid ${BRD}`, background: v ? `${bc(brand)}12` : "transparent", padding:"6px 4px", gap:3 }}>
                      <span style={{ fontFamily:MONO, fontSize: v ? 20 : 14, fontWeight: v ? 800 : 400, color: v ? bc(brand) : "#C8D8E8", lineHeight:1 }}>{v || "—"}</span>
                      {n && <span style={{ fontSize:8, color:ACC, background:ACL, border:`1px solid rgba(255,82,0,0.2)`, borderRadius:3, padding:"1px 5px" }}>{n}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ borderTop:`2px solid ${BRD}`, paddingTop:10, display:"flex", justifyContent:"space-between", fontSize:9, color:T3 }}>
        <span style={{ fontWeight:600, letterSpacing:"0.06em" }}>RICEVERE QUALITÀ · FARE QUALITÀ · CONSEGNARE QUALITÀ</span>
        <span style={{ fontFamily:MONO }}>{fmtD(date)}</span>
      </div>
    </div>
  );
}

/* ═══ SHARED COMPONENTS ═══ */
function Modal({ children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(13,27,42,0.5)", display:"flex", alignItems:"flex-end", zIndex:9999 }} onClick={onClose}>
      <div style={{ background:S0, width:"100%", maxWidth:900, margin:"0 auto", borderRadius:"20px 20px 0 0", padding:"20px 20px 40px", borderTop:`1px solid ${BRD2}`, boxShadow:"0 -8px 32px rgba(13,27,42,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:32, height:3, background:BRD2, borderRadius:2, margin:"0 auto 16px" }} />
        {children}
      </div>
    </div>
  );
}

function Btn({ children, color = M, textColor = "#fff", onClick, style = {} }) {
  return (
    <button onClick={onClick}
      style={{ width:"100%", padding:13, background:color, color:textColor, border:"none", borderRadius:12, fontSize:13, fontWeight:800, cursor:"pointer", letterSpacing:"0.05em", fontFamily:FONT, ...style }}>
      {children}
    </button>
  );
}

function KpiSmall({ label, value, color, sub, arrow }) {
  return (
    <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, padding:"12px 13px", boxShadow:"0 2px 8px rgba(13,27,42,0.04)" }}>
      <div style={{ fontSize:7.5, fontWeight:700, color:T3, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:MONO, fontSize:26, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T2, marginTop:5 }}>{arrow && <span style={{ marginRight:3 }}>{arrow}</span>}{sub}</div>}
    </div>
  );
}

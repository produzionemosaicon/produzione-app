import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { db, ref, set, get, onValue } from "./firebase.js";

/* ═══════════════════════════════════════
   COLORI & COSTANTI
═══════════════════════════════════════ */
const M   = "#1A5CFF", ML  = "#EBF0FF", MB  = "rgba(26,92,255,0.12)";
const E   = "#00A896", EL  = "#E6FAF8", EB  = "rgba(0,168,150,0.12)";
const ACC = "#FF5200", ACL = "#FFF0EA";
const BG  = "#EDF1F7", S0  = "#fff",   S1  = "#F5F8FC", S2 = "#EEF2F8";
const BRD = "#DDE4EF", BRD2 = "#C8D4E4";
const TXT = "#0D1B2A", T2  = "#5A7494", T3  = "#9BB0C8";
const GRN = "#00B87A", RED = "#E53E3E";
const FONT = "'Outfit', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const TIMES = ["10:00", "12:00", "15:00", "17:00"];

const bc = (b) => (b === "MOSAICON" ? M : E);
const bl = (b) => (b === "MOSAICON" ? ML : EL);

const GRID = { display: "grid", gridTemplateColumns: "108px repeat(4, 1fr)" };

/* ═══════════════════════════════════════
   STAZIONI DEFAULT
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */
const todayStr = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtD = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
function lastVal(rDay, brand, sid) {
  for (const t of ["17:00", "15:00", "12:00", "10:00"]) {
    const v = rDay?.[brand]?.[sid]?.[t]?.value;
    if (v !== undefined && v !== "" && !isNaN(+v)) return +v;
  }
  return null;
}

/* ═══════════════════════════════════════
   APP ROOT
═══════════════════════════════════════ */
export default function App() {
  const [tab,      setTab]      = useState("foglio");
  const [date,     setDate]     = useState(todayStr);
  const [stations, setStations] = useState(DEF_STATIONS);
  const [reports,  setReports]  = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [online,   setOnline]   = useState(navigator.onLine);

  // Modal states
  const [cellModal, setCellModal] = useState(null);
  const [cellVal,   setCellVal]   = useState("");
  const [cellNote,  setCellNote]  = useState("");
  const [stModal,   setStModal]   = useState(null);
  const [stNewName, setStNewName] = useState("");
  const [addModal,  setAddModal]  = useState(null);
  const [addName,   setAddName]   = useState("");

  // Analytics states
  const [anBrand, setAnBrand] = useState("MOSAICON");
  const [anSid,   setAnSid]   = useState("");
  const [anFrom,  setAnFrom]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [anTo,  setAnTo]  = useState(todayStr);
  const [anRes, setAnRes] = useState(null);

  /* ── Online / offline indicator ── */
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* ── Firebase: ascolta stazioni in realtime ── */
  useEffect(() => {
    const r = ref(db, "stations");
    const unsub = onValue(r, (snap) => {
      if (snap.exists()) setStations(snap.val());
    });
    return () => unsub();
  }, []);

  /* ── Firebase: ascolta tutti i report in realtime ── */
  useEffect(() => {
    const r = ref(db, "reports");
    const unsub = onValue(r, (snap) => {
      if (snap.exists()) setReports(snap.val());
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  /* ── Salva stazioni su Firebase ── */
  const saveStations = useCallback(async (s) => {
    setStations(s);
    try { await set(ref(db, "stations"), s); } catch (e) { console.error(e); }
  }, []);

  /* ── Salva singola cella su Firebase ── */
  const saveCell = useCallback(async (val, note) => {
    const { brand, sid, t } = cellModal;
    const path = `reports/${date}/${brand}/${sid}/${t.replace(":", "_")}`;
    setSaving(true);
    try {
      await set(ref(db, path), { value: val, note });
      // salva metadata del giorno
      await set(ref(db, `reports/${date}/_meta`), { date, ts: Date.now() });
    } catch (e) { console.error(e); }
    setSaving(false);
    setCellModal(null);
  }, [cellModal, date]);

  /* ── Accessors locali (Firebase già tiene i dati in sync) ── */
  const getV = (brand, sid, t) =>
    reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.value ?? "";
  const getN = (brand, sid, t) =>
    reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.note ?? "";

  /* ── Open cell modal ── */
  function openCell(brand, sid, t, name) {
    setCellVal(reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.value ?? "");
    setCellNote(reports[date]?.[brand]?.[sid]?.[t.replace(":", "_")]?.note ?? "");
    setCellModal({ brand, sid, t, name });
  }

  /* ── Station ops ── */
  async function renameStation(brand, sid, name) {
    const ns = { ...stations, [brand]: stations[brand].map((s) => s.id === sid ? { ...s, name } : s) };
    await saveStations(ns);
    setStModal(null);
  }
  async function deleteStation(brand, sid) {
    const ns = { ...stations, [brand]: stations[brand].filter((s) => s.id !== sid) };
    await saveStations(ns);
    setStModal(null);
  }
  async function addStation(brand, afterId, name) {
    const arr = stations[brand];
    const idx = afterId ? arr.findIndex((s) => s.id === afterId) : arr.length - 1;
    const newSt = { id: `${brand[0].toLowerCase()}_${uid()}`, name: name.trim() };
    const ns = { ...stations, [brand]: [...arr.slice(0, idx + 1), newSt, ...arr.slice(idx + 1)] };
    await saveStations(ns);
    setAddModal(null);
    setAddName("");
  }
  async function moveStation(brand, sid, dir) {
    const arr = [...stations[brand]];
    const i = arr.findIndex((s) => s.id === sid);
    if (dir === "up"   && i > 0)               [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (dir === "down" && i < arr.length - 1)  [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    await saveStations({ ...stations, [brand]: arr });
  }

  /* ── WhatsApp share ── */
  function shareWA() {
    let txt = `📊 Produzione ${fmtD(date)}\n\n`;
    for (const brand of ["MOSAICON", "EMOS"]) {
      txt += `━ ${brand} ━\n`;
      for (const st of stations[brand]) {
        const vals = TIMES.map((t) => getV(brand, st.id, t) || "—");
        if (TIMES.some((t) => getV(brand, st.id, t)))
          txt += `${st.name}: ${vals.join(" | ")}\n`;
      }
      txt += "\n";
    }
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`);
  }

  /* ── Analytics ── */
  function runAnalysis() {
    const stList = stations[anBrand] || [];
    const sid = anSid || stList.find((s) => s.isTotal)?.id || stList[0]?.id;
    const stName = stList.find((s) => s.id === sid)?.name || "";
    const pts = [];
    const cur = new Date(anFrom);
    const end = new Date(anTo);
    while (cur <= end) {
      const d = cur.toISOString().split("T")[0];
      const v = lastVal(reports[d], anBrand, sid);
      if (v !== null) pts.push({ date: d, label: fmtD(d), value: v });
      cur.setDate(cur.getDate() + 1);
    }
    if (!pts.length) { setAnRes({ empty: true, stName, brand: anBrand }); return; }
    const vals = pts.map((p) => p.value);
    const total = vals.reduce((a, b) => a + b, 0);
    const avg   = +(total / vals.length).toFixed(1);
    const max   = Math.max(...vals);
    const min   = Math.min(...vals);
    const trend = vals.length > 1 ? +((vals[vals.length - 1] - vals[0]) / vals[0] * 100).toFixed(1) : 0;
    setAnRes({ stName, brand: anBrand, sid, from: anFrom, to: anTo, pts, total, avg, max, min, trend, days: pts.length,
      maxDay: pts[vals.indexOf(max)], minDay: pts[vals.indexOf(min)] });
  }

  /* ── Print PDF ── */
  function printPDF() { window.print(); }

  /* ═══ LOADING SCREEN ═══ */
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: BG, fontFamily: FONT, gap: 12 }}>
      <div style={{ fontSize: 36 }}>🏭</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TXT }}>Caricamento dati…</div>
      <div style={{ fontSize: 12, color: T3 }}>Connessione a Firebase in corso</div>
      <div style={{ width: 120, height: 3, background: BRD, borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
        <div style={{ width: "60%", height: "100%", background: M, borderRadius: 2, animation: "load 1.2s ease-in-out infinite alternate" }} />
      </div>
      <style>{`@keyframes load { from { width: 20% } to { width: 90% } }`}</style>
    </div>
  );

  /* ═══ MAIN RENDER ═══ */
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: BG, fontFamily: FONT, position: "relative", overflow: "hidden" }}>

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
        }
        .print-only { display: none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${BRD2}; border-radius: 2px; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div className="no-print" style={{ background: S0, borderBottom: `1px solid ${BRD}`, padding: "10px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: online ? GRN : RED }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: T3, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {online ? "In linea" : "Offline"}
              </span>
              {saving && <span style={{ fontSize: 8, color: T2 }}>· salvataggio…</span>}
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ border: "none", background: "transparent", fontFamily: MONO, fontSize: 17, fontWeight: 700, color: ACC, cursor: "pointer", outline: "none", padding: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={printPDF} style={{ background: M, color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>⬇ PDF</button>
            <button onClick={shareWA}  style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>📤 WA</button>
          </div>
        </div>
      </div>

      {/* ── PRINT DOCUMENT ── */}
      <div className="print-only" style={{ padding: "20px 24px" }}>
        <PrintDoc date={date} stations={stations} reports={reports} getV={getV} getN={getN} />
      </div>

      {/* ── CONTENT ── */}
      <div className="no-print" style={{ flex: 1, overflowY: "auto" }}>
        {tab === "foglio" && (
          <FoglioTab stations={stations} getV={getV} getN={getN} openCell={openCell}
            onEditSt={(brand, st) => { setStModal({ brand, st }); setStNewName(st.name); }}
            onAddSt={(brand, afterId) => { setAddModal({ brand, afterId }); setAddName(""); }} />
        )}
        {tab === "storico" && (
          <StoricoTab reports={reports} stations={stations}
            onOpen={(d) => { setDate(d); setTab("foglio"); }} />
        )}
        {tab === "analisi" && (
          <AnalisiTab stations={stations} reports={reports}
            anBrand={anBrand} setAnBrand={setAnBrand}
            anSid={anSid} setAnSid={setAnSid}
            anFrom={anFrom} setAnFrom={setAnFrom}
            anTo={anTo} setAnTo={setAnTo}
            anRes={anRes} run={runAnalysis} />
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="no-print" style={{ background: S0, borderTop: `1px solid ${BRD}`, display: "flex", flexShrink: 0 }}>
        {[
          { id: "foglio",  icon: "📋", label: "Foglio" },
          { id: "storico", icon: "📁", label: "Storico" },
          { id: "analisi", icon: "📊", label: "Analisi" },
        ].map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, background: "none", border: "none", padding: "10px 4px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: tab === id ? M : T3 }}>{label}</span>
            {tab === id && <div style={{ width: 20, height: 2, background: M, borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* ── CELL MODAL ── */}
      {cellModal && (
        <Modal onClose={() => setCellModal(null)}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
            {cellModal.brand} · {cellModal.t}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TXT, marginBottom: 14 }}>{cellModal.name}</div>
          <input type="number" inputMode="decimal" autoFocus value={cellVal}
            onChange={(e) => setCellVal(e.target.value)}
            style={{ width: "100%", background: BG, border: `2px solid ${bc(cellModal.brand)}`, borderRadius: 10, padding: 12, fontFamily: MONO, fontSize: 30, fontWeight: 700, color: bc(cellModal.brand), textAlign: "center", outline: "none", marginBottom: 12 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, background: ACC, borderRadius: "50%" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: ACC, letterSpacing: "0.1em", textTransform: "uppercase" }}>Commento breve</span>
            <span style={{ marginLeft: "auto", fontSize: 8, color: T3 }}>max 30 car.</span>
          </div>
          <input type="text" value={cellNote} onChange={(e) => setCellNote(e.target.value.slice(0, 30))}
            placeholder="Appare sotto il numero…"
            style={{ width: "100%", background: BG, border: `1.5px solid ${BRD}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, color: TXT, outline: "none", marginBottom: 14, fontFamily: FONT }} />
          <Btn color={bc(cellModal.brand)} onClick={() => saveCell(cellVal, cellNote)}>✓ SALVA</Btn>
          {(cellVal || cellNote) && <Btn color={BG} textColor={T2} style={{ marginTop: 8 }} onClick={() => saveCell("", "")}>Cancella valore</Btn>}
          <Btn color={BG} textColor={T3} style={{ marginTop: 8 }} onClick={() => setCellModal(null)}>Annulla</Btn>
        </Modal>
      )}

      {/* ── STATION MODAL ── */}
      {stModal && (
        <Modal onClose={() => setStModal(null)}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Stazione · {stModal.brand}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TXT, marginBottom: 14 }}>{stModal.st.name}</div>
          <input autoFocus value={stNewName} onChange={(e) => setStNewName(e.target.value)}
            placeholder="Nuovo nome…"
            style={{ width: "100%", background: BG, border: `2px solid ${bc(stModal.brand)}`, borderRadius: 10, padding: "11px 12px", fontSize: 15, color: TXT, outline: "none", marginBottom: 12, fontFamily: FONT }} />
          <Btn color={bc(stModal.brand)} onClick={() => stNewName.trim() && renameStation(stModal.brand, stModal.st.id, stNewName.trim())}>✓ RINOMINA</Btn>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => { moveStation(stModal.brand, stModal.st.id, "up"); setStModal(null); }}
              style={{ flex: 1, background: BG, border: `1px solid ${BRD}`, borderRadius: 8, padding: 9, fontSize: 14, cursor: "pointer" }}>⬆ Su</button>
            <button onClick={() => { moveStation(stModal.brand, stModal.st.id, "down"); setStModal(null); }}
              style={{ flex: 1, background: BG, border: `1px solid ${BRD}`, borderRadius: 8, padding: 9, fontSize: 14, cursor: "pointer" }}>⬇ Giù</button>
          </div>
          {!stModal.st.isTotal && (
            <Btn color="#FEE2E2" textColor={RED} style={{ marginTop: 8 }}
              onClick={() => { if (window.confirm(`Eliminare "${stModal.st.name}"?`)) deleteStation(stModal.brand, stModal.st.id); }}>
              🗑 Elimina stazione
            </Btn>
          )}
          <Btn color={BG} textColor={T3} style={{ marginTop: 8 }} onClick={() => setStModal(null)}>Annulla</Btn>
        </Modal>
      )}

      {/* ── ADD STATION MODAL ── */}
      {addModal && (
        <Modal onClose={() => setAddModal(null)}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Nuova stazione · {addModal.brand}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TXT, marginBottom: 14 }}>Aggiungi stazione</div>
          <input autoFocus value={addName} onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addName.trim() && addStation(addModal.brand, addModal.afterId, addName)}
            placeholder="Nome stazione…"
            style={{ width: "100%", background: BG, border: `2px solid ${bc(addModal.brand)}`, borderRadius: 10, padding: "11px 12px", fontSize: 15, color: TXT, outline: "none", marginBottom: 14, fontFamily: FONT }} />
          <Btn color={bc(addModal.brand)} onClick={() => addName.trim() && addStation(addModal.brand, addModal.afterId, addName)}>+ AGGIUNGI</Btn>
          <Btn color={BG} textColor={T3} style={{ marginTop: 8 }} onClick={() => setAddModal(null)}>Annulla</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   FOGLIO TAB
═══════════════════════════════════════ */
function FoglioTab({ stations, getV, getN, openCell, onEditSt, onAddSt }) {
  return (
    <div>
      {["MOSAICON", "EMOS"].map((brand) => (
        <div key={brand} style={{ marginTop: brand === "EMOS" ? 10 : 0 }}>
          {/* Brand header sticky */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: bl(brand), borderBottom: `1px solid ${BRD}`, borderLeft: `3px solid ${bc(brand)}`, position: "sticky", top: 0, zIndex: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: bc(brand), letterSpacing: "0.14em" }}>{brand}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, background: `${bc(brand)}20`, color: bc(brand), padding: "2px 9px", borderRadius: 20 }}>
              {(() => {
                const tot = stations[brand]?.find((s) => s.isTotal);
                if (!tot) return "—";
                const v = ["17:00","15:00","12:00","10:00"].reduce((a, t) => {
                  const val = getV(brand, tot.id, t);
                  return a || (val && !isNaN(+val) ? val : null);
                }, null);
                return v ? `TOT ${v}` : "—";
              })()}
            </span>
          </div>

          {/* Time header — stessa griglia delle righe dati */}
          <div style={{ ...GRID, padding: "4px 10px 4px 12px", background: S1, borderBottom: `1px solid ${BRD}`, position: "sticky", top: 38, zIndex: 9 }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: T3, letterSpacing: "0.08em", textTransform: "uppercase" }}>STAZIONE</div>
            {TIMES.map((t) => (
              <div key={t} style={{ fontSize: 8, fontWeight: 700, color: T3, textAlign: "center", borderLeft: `1px solid ${BRD}`, fontFamily: MONO }}>{t}</div>
            ))}
          </div>

          {/* Rows */}
          {stations[brand]?.map((st, idx) => {
            const hasNote = TIMES.some((t) => getN(brand, st.id, t));
            const isTotal = !!st.isTotal;
            return (
              <div key={st.id} style={{ ...GRID, padding: "0 10px 0 12px", background: isTotal ? bl(brand) : idx % 2 === 0 ? S0 : S1, borderBottom: `1px solid ${BRD}`, borderLeft: isTotal ? `3px solid ${bc(brand)}` : hasNote ? `2.5px solid ${ACC}` : "3px solid transparent", minHeight: 32 }}>
                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 4px 5px 0", overflow: "hidden" }}>
                  <span style={{ flex: 1, fontSize: isTotal ? 9.5 : 9, fontWeight: isTotal ? 800 : 600, color: isTotal ? bc(brand) : hasNote ? ACC : TXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.name}</span>
                  <button onClick={() => onEditSt(brand, st)} style={{ flexShrink: 0, fontSize: 7, background: S2, border: `1px solid ${BRD2}`, color: T2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", lineHeight: 1.5 }}>✏</button>
                </div>
                {/* Value cells — stesso bordo sinistro dell'header */}
                {TIMES.map((t) => {
                  const v = getV(brand, st.id, t);
                  const n = getN(brand, st.id, t);
                  return (
                    <button key={t} onClick={() => openCell(brand, st.id, t, st.name)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: `1px solid ${BRD}`, background: "transparent", border: "none", borderLeft: `1px solid ${BRD}`, cursor: "pointer", gap: 2, padding: "3px 2px", width: "100%", height: "100%", minHeight: 32 }}>
                      <span style={{ fontFamily: MONO, fontSize: v ? 13 : 11, fontWeight: v ? 700 : 400, color: v ? bc(brand) : "#C8D8E8", lineHeight: 1 }}>{v || "—"}</span>
                      {n && <span style={{ fontSize: 6.5, color: ACC, background: ACL, border: "1px solid rgba(255,82,0,0.2)", borderRadius: 3, padding: "1px 4px", maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Add station button */}
          <button onClick={() => onAddSt(brand, stations[brand]?.[stations[brand].length - 1]?.id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", margin: "5px 10px", background: S0, border: `1.5px dashed ${BRD2}`, borderRadius: 8, cursor: "pointer", fontFamily: FONT, width: "calc(100% - 20px)" }}>
            <span style={{ width: 17, height: 17, borderRadius: 4, background: bl(brand), color: bc(brand), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>+</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: T2 }}>Aggiungi stazione {brand}</span>
          </button>
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
}

/* ═══════════════════════════════════════
   STORICO TAB
═══════════════════════════════════════ */
function StoricoTab({ reports, stations, onOpen }) {
  const sorted = useMemo(() =>
    Object.keys(reports)
      .filter((k) => reports[k]._meta)
      .sort((a, b) => b.localeCompare(a)),
  [reports]);

  if (!sorted.length) return (
    <div style={{ padding: 40, textAlign: "center", color: T3, fontFamily: FONT }}>
      <div style={{ fontSize: 42, marginBottom: 12 }}>📁</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: TXT }}>Nessun report ancora</div>
      <div style={{ fontSize: 12, marginTop: 6, color: T3 }}>I dati si salvano automaticamente su Firebase e sono visibili su tutti i dispositivi.</div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT }}>
      {sorted.map((d, idx) => {
        const rDay = reports[d];
        const mTot = (() => { const t = stations.MOSAICON?.find((s) => s.isTotal); return t ? lastVal(rDay, "MOSAICON", t.id) : null; })();
        const eTot = (() => { const t = stations.EMOS?.find((s) => s.isTotal);     return t ? lastVal(rDay, "EMOS",     t.id) : null; })();
        const notesN = ["MOSAICON","EMOS"].flatMap((b) =>
          (stations[b] || []).flatMap((s) =>
            TIMES.filter((t) => rDay?.[b]?.[s.id]?.[t.replace(":","_")]?.note)
          )
        ).length;
        const dt = new Date(d);
        return (
          <button key={d} onClick={() => onOpen(d)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: idx % 2 === 0 ? S0 : S1, border: "none", borderBottom: `1px solid ${BRD}`, width: "100%", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
            <div style={{ flexShrink: 0, textAlign: "center", width: 34 }}>
              <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: M, lineHeight: 1 }}>{String(dt.getDate()).padStart(2,"0")}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T3, letterSpacing: "0.06em", textTransform: "uppercase" }}>{dt.toLocaleDateString("it-IT",{month:"short"})}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TXT, textTransform: "capitalize" }}>
                {dt.toLocaleDateString("it-IT",{weekday:"long"})} {fmtD(d)}
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                {mTot !== null && <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, background: ML, color: M, padding: "2px 6px", borderRadius: 4 }}>MOA {mTot}</span>}
                {eTot !== null && <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, background: EL, color: E, padding: "2px 6px", borderRadius: 4 }}>EMS {eTot}</span>}
                {notesN > 0   && <span style={{ fontSize: 8, fontWeight: 700, background: ACL, color: ACC, padding: "2px 6px", borderRadius: 4 }}>{notesN} {notesN === 1 ? "nota" : "note"}</span>}
              </div>
            </div>
            <div style={{ fontSize: 18, color: BRD2, flexShrink: 0 }}>›</div>
          </button>
        );
      })}
      <div style={{ height: 24 }} />
    </div>
  );
}

/* ═══════════════════════════════════════
   ANALISI TAB
═══════════════════════════════════════ */
function AnalisiTab({ stations, reports, anBrand, setAnBrand, anSid, setAnSid, anFrom, setAnFrom, anTo, setAnTo, anRes, run }) {
  const stList = stations[anBrand] || [];
  const sidEff = anSid || stList.find((s) => s.isTotal)?.id || stList[0]?.id;

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Filtri */}
      <div style={{ background: S0, borderBottom: `1px solid ${BRD}`, padding: "14px 14px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Filtri analisi</div>

        {/* Brand */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["MOSAICON","EMOS"].map((b) => (
            <button key={b} onClick={() => { setAnBrand(b); setAnSid(""); }}
              style={{ flex: 1, padding: 9, background: anBrand === b ? bl(b) : BG, border: `1.5px solid ${anBrand === b ? bc(b) : BRD}`, borderRadius: 9, fontSize: 12, fontWeight: 800, color: anBrand === b ? bc(b) : T3, cursor: "pointer", letterSpacing: "0.06em", fontFamily: FONT }}>{b}</button>
          ))}
        </div>

        {/* Stazione */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T2, marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Stazione / Postazione</div>
          <select value={sidEff} onChange={(e) => setAnSid(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${BRD}`, borderRadius: 9, fontSize: 13, color: TXT, background: BG, outline: "none", fontFamily: FONT, cursor: "pointer" }}>
            {stList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.isTotal ? " ★" : ""}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[["DAL", anFrom, setAnFrom], ["AL", anTo, setAnTo]].map(([label, val, setter]) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T2, marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
              <input type="date" value={val} onChange={(e) => setter(e.target.value)}
                style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${BRD}`, borderRadius: 9, fontSize: 12, color: TXT, background: BG, outline: "none", fontFamily: MONO }} />
            </div>
          ))}
        </div>

        <button onClick={run}
          style={{ width: "100%", padding: 12, background: bc(anBrand), color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em", fontFamily: FONT }}>
          📊 ANALIZZA
        </button>
      </div>

      {/* Results */}
      {anRes && (
        <div style={{ padding: 14 }}>
          {anRes.empty ? (
            <div style={{ textAlign: "center", padding: 32, color: T3 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TXT }}>Nessun dato trovato</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>per <strong>{anRes.stName}</strong> nel periodo selezionato</div>
            </div>
          ) : (
            <>
              {/* Report header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: bc(anRes.brand), letterSpacing: "0.08em", marginBottom: 1 }}>{anRes.brand}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TXT }}>{anRes.stName}</div>
                  <div style={{ fontSize: 10, color: T2, marginTop: 2, fontFamily: MONO }}>{fmtD(anRes.from)} → {fmtD(anRes.to)} · {anRes.days} gg</div>
                </div>
                <button onClick={() => window.print()}
                  style={{ background: M, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: FONT, flexShrink: 0 }}>⬇ PDF</button>
              </div>

              {/* KPI grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
                <KpiCard label="Totale periodo"     value={anRes.total} color={bc(anRes.brand)} sub={`in ${anRes.days} giorni`} />
                <KpiCard label="Media giornaliera"  value={anRes.avg}   color={bc(anRes.brand)} sub="paia/giorno" />
                <KpiCard label="Giorno migliore"    value={anRes.max}   color={GRN} sub={fmtD(anRes.maxDay?.date)} arrow="▲" />
                <KpiCard label="Giorno peggiore"    value={anRes.min}   color={anRes.min < anRes.avg * 0.8 ? RED : T2} sub={fmtD(anRes.minDay?.date)} arrow="▼" />
              </div>

              {/* Trend badge */}
              <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: anRes.trend >= 0 ? "#DCFCE7" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {anRes.trend >= 0 ? "📈" : "📉"}
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Variazione periodo</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: anRes.trend >= 0 ? GRN : RED, fontFamily: MONO, lineHeight: 1 }}>
                    {anRes.trend >= 0 ? "+" : ""}{anRes.trend}%
                  </div>
                  <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>dal primo all'ultimo giorno rilevato</div>
                </div>
              </div>

              {/* Line chart */}
              <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12, padding: "14px 6px 10px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T2, paddingLeft: 10, marginBottom: 10 }}>{anRes.stName} — andamento</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={anRes.pts} margin={{ top: 4, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BRD} />
                    <XAxis dataKey="label" tick={{ fontSize: 8, fill: T3, fontFamily: MONO }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 8, fill: T3, fontFamily: MONO }} width={38} />
                    <Tooltip contentStyle={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 8, fontFamily: FONT, fontSize: 12 }}
                      labelStyle={{ color: TXT, fontWeight: 700 }} formatter={(v) => [v, anRes.stName]} />
                    <ReferenceLine y={anRes.avg} stroke={T3} strokeDasharray="4 4"
                      label={{ value: `avg ${anRes.avg}`, position: "insideTopRight", fontSize: 9, fill: T3, fontFamily: MONO }} />
                    <Line type="monotone" dataKey="value" stroke={bc(anRes.brand)} strokeWidth={2.5}
                      dot={{ r: 3, fill: bc(anRes.brand) }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Detail table */}
              <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${BRD}`, fontSize: 10, fontWeight: 700, color: T2, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dettaglio giornaliero</div>
                {[...anRes.pts].reverse().map((pt, i) => (
                  <div key={pt.date} style={{ display: "flex", alignItems: "center", padding: "9px 14px", background: i % 2 === 0 ? S0 : S1, borderBottom: `1px solid ${BRD}` }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: TXT }}>{pt.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: pt.value === anRes.max ? GRN : pt.value === anRes.min ? RED : bc(anRes.brand), marginRight: 10 }}>{pt.value}</div>
                    <div style={{ width: 60, height: 5, background: BRD, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${(pt.value / anRes.max) * 100}%`, height: "100%", background: bc(anRes.brand), borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

/* ═══════════════════════════════════════
   PRINT DOCUMENT
═══════════════════════════════════════ */
function PrintDoc({ date, stations, getV, getN }) {
  return (
    <div style={{ fontFamily: FONT, background: "#fff" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0A3D9C,#1A5CFF 55%,#009FCC)", padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 3 }}>Report Produzione Giornaliero</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "0.1em" }}>MOSAICON + EMOS</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.18)", color: "#fff", fontFamily: MONO, fontSize: 12, padding: "4px 10px", borderRadius: 5 }}>{fmtD(date)}</div>
      </div>

      {["MOSAICON","EMOS"].map((brand) => (
        <div key={brand} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "5px 8px", background: bl(brand) }}>
            <div style={{ width: 3, height: 16, background: bc(brand), borderRadius: 2 }} />
            <div style={{ fontSize: 12, fontWeight: 900, color: bc(brand), letterSpacing: "0.1em" }}>{brand}</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#EEF3FA" }}>
                <th style={{ padding: "5px 8px", fontSize: 8, fontWeight: 700, color: T2, textAlign: "left", borderBottom: `2px solid ${BRD}`, width: "38%" }}>STAZIONE</th>
                {TIMES.map((t) => <th key={t} style={{ padding: "5px 6px", fontSize: 8, fontWeight: 700, color: T2, textAlign: "center", borderBottom: `2px solid ${BRD}`, fontFamily: MONO, borderLeft: `1px solid ${BRD}` }}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {stations[brand]?.map((st, i) => (
                <tr key={st.id} style={{ background: st.isTotal ? bl(brand) : i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                  <td style={{ padding: "5px 8px", fontSize: 9, fontWeight: st.isTotal ? 800 : 600, color: st.isTotal ? bc(brand) : TXT, borderBottom: `1px solid #EEF3F9` }}>{st.name}</td>
                  {TIMES.map((t) => {
                    const v = getV(brand, st.id, t);
                    const n = getN(brand, st.id, t);
                    return (
                      <td key={t} style={{ padding: "4px", textAlign: "center", borderBottom: `1px solid #EEF3F9`, borderLeft: `1px solid #EEF3F9`, verticalAlign: "middle" }}>
                        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: v ? bc(brand) : "#C8D8E8" }}>{v || "—"}</div>
                        {n && <div style={{ fontSize: 7, color: ACC, background: ACL, borderRadius: 2, padding: "1px 4px", marginTop: 2, display: "inline-block" }}>{n}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${BRD}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 8, color: T3 }}>
        <span>RICEVERE QUALITÀ · FARE QUALITÀ · CONSEGNARE QUALITÀ</span>
        <span style={{ fontFamily: MONO }}>1/1</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   SHARED UI COMPONENTS
═══════════════════════════════════════ */
function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,0.5)", display: "flex", alignItems: "flex-end", zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: S0, width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", borderTop: `1px solid ${BRD2}`, boxShadow: "0 -8px 32px rgba(13,27,42,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 32, height: 3, background: BRD2, borderRadius: 2, margin: "0 auto 16px" }} />
        {children}
      </div>
    </div>
  );
}

function Btn({ children, color = M, textColor = "#fff", onClick, style = {} }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", padding: 12, background: color, color: textColor, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em", fontFamily: FONT, ...style }}>
      {children}
    </button>
  );
}

function KpiCard({ label, value, color, sub, arrow }) {
  return (
    <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12, padding: "12px 13px" }}>
      <div style={{ fontSize: 7.5, fontWeight: 700, color: T3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T2, marginTop: 5 }}>{arrow && <span style={{ marginRight: 3 }}>{arrow}</span>}{sub}</div>}
    </div>
  );
}

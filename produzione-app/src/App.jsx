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
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const fmtD = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const timeKey = (t) => t.replace(":", "_");

function lastVal(rDay, brand, sid) {
  for (const t of ["17:00", "15:00", "12:00", "10:00"]) {
    const v = rDay?.[brand]?.[sid]?.[timeKey(t)]?.value;
    if (v !== undefined && v !== "" && !isNaN(+v)) return +v;
  }
  return null;
}

/* ═══ APP ROOT ═══ */
export default function App() {
  const [tab, setTab] = useState("home");
  const [date, setDate] = useState(() => todayStr());
  const [stations, setStations] = useState(DEF_STATIONS);
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [savedKeys, setSavedKeys] = useState(new Set());

  const [pdfLibs, setPdfLibs] = useState({ html2canvas: null, jsPDF: null });

  const [cellModal, setCellModal] = useState(null);
  const [cellVal, setCellVal] = useState("");
  const [cellNote, setCellNote] = useState("");
  const [stModal, setStModal] = useState(null);
  const [stNewName, setStNewName] = useState("");
  const [addModal, setAddModal] = useState(null);
  const [addName, setAddName] = useState("");

  const [anBrand, setAnBrand] = useState("MOSAICON");
  const [anSid, setAnSid] = useState("");
  const [anFrom, setAnFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [anTo, setAnTo] = useState(() => todayStr());
  const [anRes, setAnRes] = useState(null);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);

        if (mounted) {
          setPdfLibs({ html2canvas, jsPDF });
        }
      } catch (e) {
        console.error("Preload librerie PDF fallito:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return onValue(ref(db, "stations"), (snap) => {
      if (snap.exists()) setStations(snap.val());
    });
  }, []);

  useEffect(() => {
    return onValue(
      ref(db, "reports"),
      (snap) => {
        if (snap.exists()) setReports(snap.val());
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  const saveStations = useCallback(async (s) => {
    setStations(s);
    try {
      await set(ref(db, "stations"), s);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveCell = useCallback(async (val, note) => {
    if (!cellModal) return;

    const { brand, sid, t } = cellModal;
    const tKey = timeKey(t);
    const flashKey = `${brand}_${sid}_${tKey}`;
    setSaving(true);

    try {
      await set(ref(db, `reports/${date}/${brand}/${sid}/${tKey}`), {
        value: val,
        note,
      });
      await set(ref(db, `reports/${date}/_meta`), {
        date,
        ts: Date.now(),
        updated: Date.now(),
      });

      setSavedKeys(prev => new Set([...prev, flashKey]));
      setTimeout(() => {
        setSavedKeys(prev => {
          const n = new Set(prev);
          n.delete(flashKey);
          return n;
        });
      }, 1500);
    } catch (e) {
      console.error(e);
    }

    setSaving(false);
    setCellModal(null);
  }, [cellModal, date]);

  const getV = (brand, sid, t) =>
    reports[date]?.[brand]?.[sid]?.[timeKey(t)]?.value ?? "";

  const getN = (brand, sid, t) =>
    reports[date]?.[brand]?.[sid]?.[timeKey(t)]?.note ?? "";

  function openCell(brand, sid, t, name) {
    setCellVal(reports[date]?.[brand]?.[sid]?.[timeKey(t)]?.value ?? "");
    setCellNote(reports[date]?.[brand]?.[sid]?.[timeKey(t)]?.note ?? "");
    setCellModal({ brand, sid, t, name });
  }

  async function renameStation(brand, sid, name) {
    await saveStations({
      ...stations,
      [brand]: stations[brand].map(s => s.id === sid ? { ...s, name } : s)
    });
    setStModal(null);
  }

  async function deleteStation(brand, sid) {
    await saveStations({
      ...stations,
      [brand]: stations[brand].filter(s => s.id !== sid)
    });
    setStModal(null);
  }

  async function addStation(brand, afterId, name) {
    const arr = stations[brand];
    const idxFound = afterId ? arr.findIndex(s => s.id === afterId) : arr.length - 1;
    const idx = idxFound >= 0 ? idxFound : arr.length - 1;

    const ns = {
      ...stations,
      [brand]: [
        ...arr.slice(0, idx + 1),
        { id: `${brand[0].toLowerCase()}_${uid()}`, name: name.trim() },
        ...arr.slice(idx + 1)
      ]
    };
    await saveStations(ns);
    setAddModal(null);
    setAddName("");
  }

  async function moveStation(brand, sid, dir) {
    const arr = [...stations[brand]];
    const i = arr.findIndex(s => s.id === sid);
    if (i === -1) return;
    if (arr[i].isTotal) return;

    if (dir === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (dir === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];

    await saveStations({ ...stations, [brand]: arr });
  }

  async function shareWA() {
  const el = document.getElementById("print-doc");
  if (!el) {
    alert("Area PDF non trovata");
    return;
  }

  const { html2canvas, jsPDF } = pdfLibs;
  if (!html2canvas || !jsPDF) {
    alert("Le librerie PDF non sono ancora pronte. Riprova tra un secondo.");
    return;
  }

  const prevDisplay = el.style.display;
  const prevWidth = el.style.width;

  try {
    el.style.display = "block";
    el.style.width = "1320px";

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });

    const pageW = 210; // A4 width in mm
    const pageH = (canvas.height * pageW) / canvas.width;

    const pdf = new jsPDF({
      orientation: pageH > pageW ? "portrait" : "landscape",
      unit: "mm",
      format: [pageH, pageW], // pagina personalizzata lunga
      compress: true,
    });

    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      0,
      pageW,
      pageH,
      undefined,
      "FAST"
    );

    const blob = pdf.output("blob");
    const file = new File([blob], `produzione_${date}.pdf`, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    const shareData = {
      files: [file],
      title: `Produzione ${fmtD(date)}`,
      text: `Report produzione ${fmtD(date)}`,
    };

    if (!window.isSecureContext) {
      throw new Error("L'app non è in HTTPS");
    }

    if (typeof navigator.share !== "function") {
      throw new Error("navigator.share non disponibile");
    }

    if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) {
      throw new Error("Il browser non accetta la condivisione di questo file");
    }

    await navigator.share(shareData);
  } catch (e) {
    console.error("Errore shareWA:", e);
    alert(`Condivisione non riuscita: ${e.message}`);
  } finally {
    el.style.display = prevDisplay;
    el.style.width = prevWidth;
  }
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
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const m = getTot(reports[ds], "MOSAICON") ?? 0;
      const e = getTot(reports[ds], "EMOS")     ?? 0;
      pts.push({ label:`${d.getDate()}/${d.getMonth()+1}`, MOSAICON:m, EMOS:e, total:m+e });
    }
    return pts;
  }, [reports, stations]);

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
          {combinedYest > 0 && (() => {
            const p = pct(combined, combinedYest);
            return p !== null ? (
              <div style={{ marginTop:6, fontSize:11, fontWeight:700, color: p >= 0 ? "#86EFAC" : "#FCA5A5" }}>
                {p >= 0 ? "▲" : "▼"} {Math.abs(p)}% rispetto a ieri ({combinedYest})
              </div>
            ) : null;
          })()}
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
            <Tooltip contentStyle={{ background:S0, border:`1px solid ${BRD}`, borderRadius:8, fontFamily:FONT, fontSize:12 }} labelStyle={{ color:TXT, fontWeight:700 }} />
            <Bar dataKey="MOSAICON" fill={M} radius={[4,4,0,0]} maxBarSize={20} />
            <Bar dataKey="EMOS" fill={E} radius={[4,4,0,0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button
        onClick={onGoFoglio}
        style={{ width:"100%", background:S0, border:`1.5px solid ${BRD}`, borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:FONT, boxShadow:"0 2px 10px rgba(13,27,42,0.05)" }}
      >
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

          <div style={{ display:"grid", gridTemplateColumns:"130px repeat(4,1fr)", padding:"6px 10px 6px 14px", background:S2, borderBottom:`1px solid ${BRD}`, position:"sticky", top:48, zIndex:9 }}>
            <div style={{ fontSize:9, fontWeight:700, color:T2, letterSpacing:"0.1em", textTransform:"uppercase", display:"flex", alignItems:"center" }}>STAZIONE</div>
            {TIMES.map(t => (
              <div key={t} style={{ fontSize:12, fontWeight:800, color:bc(brand), textAlign:"center", borderLeft:`1px solid ${BRD}`, fontFamily:MONO, display:"flex", alignItems:"center", justifyContent:"center", padding:"4px 0" }}>{t}</div>
            ))}
          </div>

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
                  const flashKey = `${brand}_${st.id}_${timeKey(t)}`;
                  return (
                    <button
                      key={t}
                      className={savedKeys.has(flashKey) ? "cell-flash" : ""}
                      onClick={() => openCell(brand, st.id, t, st.name)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderLeft:`1px solid ${BRD}`, background: v ? `${bc(brand)}12` : "transparent", cursor:"pointer", gap:3, padding:"6px 4px", width:"100%", height:"100%", minHeight:54, border:"none", transition:"background 0.2s" }}
                    >
                      <span style={{ fontFamily:MONO, fontSize: v ? 18 : 13, fontWeight: v ? 800 : 400, color: v ? bc(brand) : "#C8D8E8", lineHeight:1 }}>{v || "—"}</span>
                      {n && <span style={{ fontSize:7.5, color:ACC, background:ACL, border:"1px solid rgba(255,82,0,0.2)", borderRadius:4, padding:"1px 5px", maxWidth:58, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.4 }}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <button onClick={() => onAddSt(brand, stations[brand]?.[stations[brand].length-1]?.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", margin:"8px 12px", background:S0, border:`1.5px dashed ${BRD2}`, borderRadius:10, cursor:"pointer", fontFamily:FONT, width:"calc(100% - 24px)" }}>
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
  const sorted = useMemo(
    () => Object.keys(reports).filter(k => reports[k]._meta).sort((a,b) => b.localeCompare(a)),
    [reports]
  );

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
        const eTot = (() => { const t = stations.EMOS?.find(s => s.isTotal); return t ? lastVal(rDay,"EMOS",t.id) : null; })();
        const notesN = ["MOSAICON","EMOS"].flatMap(b =>
          (stations[b]||[]).flatMap(s => TIMES.filter(t => rDay?.[b]?.[s.id]?.[timeKey(t)]?.note))
        ).length;
        const dt = new Date(d + "T12:00:00");

        return (
          <button key={d} onClick={() => onOpen(d)} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background: idx%2===0 ? S0 : S1, border:"none", borderBottom:`1px solid ${BRD}`, width:"100%", cursor:"pointer", textAlign:"left", fontFamily:FONT }}>
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
                {notesN > 0 && <span style={{ fontSize:8, fontWeight:700, background:ACL, color:ACC, padding:"2px 7px", borderRadius:4 }}>{notesN} nota{notesN>1?"e":""}</span>}
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
              style={{ flex:1, padding:10, background: anBrand===b ? bl(b) : BG, border:`1.5px solid ${anBrand===b ? bc(b) : BRD}`, borderRadius:10, fontSize:12, fontWeight:800, color: anBrand===b ? bc(b) : T3, cursor:"pointer", fontFamily:FONT }}>
              {b}
            </button>
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
                    <Tooltip contentStyle={{ background:S0, border:`1px solid ${BRD}`, borderRadius:8, fontFamily:FONT, fontSize:12 }} labelStyle={{ color:TXT, fontWeight:700 }} formatter={v => [v, anRes.stName]} />
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

/* ═══ PRINT DOC NUOVO ═══ */
function PrintDoc({ date, stations, getV, getN }) {
  const COL = "430px repeat(4, 1fr)";

  const brandTotal = (brand) => {
    const totalStation = stations[brand]?.find((s) => s.isTotal);
    if (!totalStation) return null;
    return ["17:00", "15:00", "12:00", "10:00"].reduce((acc, t) => {
      const val = getV(brand, totalStation.id, t);
      return acc || (val && !isNaN(+val) ? val : null);
    }, null);
  };

  return (
    <div style={{ fontFamily: FONT, background: "#EAF0F8", padding: 26 }}>
      <div
        data-print-row="true"
        style={{
          background: "linear-gradient(135deg,#0A3D9C 0%,#1A5CFF 58%,#00A0D6 100%)",
          borderRadius: 32,
          padding: "34px 40px",
          marginBottom: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 16px 36px rgba(26,92,255,0.24)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "rgba(255,255,255,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
            }}
          >
            🏭
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.70)",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Report Produzione Giornaliero
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.08em",
                lineHeight: 1,
              }}
            >
              MOSAICON + EMOS
            </div>
            <div
              style={{
                fontSize: 17,
                color: "rgba(255,255,255,0.84)",
                marginTop: 12,
                fontWeight: 500,
              }}
            >
              Report operativo giornaliero
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.14)",
            color: "#fff",
            padding: "18px 26px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.22)",
            textAlign: "right",
            minWidth: 190,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.66)",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Data
          </div>
          <div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 900, lineHeight: 1 }}>
            {fmtD(date)}
          </div>
        </div>
      </div>

      {["MOSAICON", "EMOS"].map((brand) => (
        <div
          key={brand}
          style={{
            marginBottom: 30,
            background: "#fff",
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: "0 8px 26px rgba(13,27,42,0.08)",
            border: `1px solid ${BRD}`,
          }}
        >
          <div
            data-print-row="true"
            style={{
              display: "grid",
              gridTemplateColumns: COL,
              background: `linear-gradient(135deg, ${bc(brand)}14, #ffffff 72%)`,
              borderBottom: `1px solid ${BRD}`,
            }}
          >
            <div
              style={{
                padding: "24px 28px",
                borderLeft: `10px solid ${bc(brand)}`,
                display: "flex",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    color: bc(brand),
                    letterSpacing: "0.16em",
                    lineHeight: 1,
                  }}
                >
                  {brand}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: T2,
                    marginTop: 10,
                    fontWeight: 600,
                  }}
                >
                  Totale attuale: {brandTotal(brand) ?? "—"}
                </div>
              </div>
            </div>

            {TIMES.map((t) => (
              <div
                key={t}
                style={{
                  borderLeft: `1px solid ${BRD}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px 10px",
                  background: `${bc(brand)}08`,
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 34,
                    fontWeight: 900,
                    color: bc(brand),
                    lineHeight: 1,
                    letterSpacing: "0.03em",
                  }}
                >
                  {t}
                </div>
              </div>
            ))}
          </div>

          {stations[brand]?.map((st, i) => {
            const isTotal = !!st.isTotal;
            const hasNote = TIMES.some((t) => getN(brand, st.id, t));
            const borderColor = isTotal ? bc(brand) : hasNote ? ACC : "transparent";

            return (
              <div
                key={st.id}
                data-print-row="true"
                style={{
                  display: "grid",
                  gridTemplateColumns: COL,
                  background: isTotal ? `${bc(brand)}10` : i % 2 === 0 ? "#fff" : "#F8FBFF",
                  borderBottom: `1px solid ${BRD}`,
                }}
              >
                <div
                  style={{
                    padding: "22px 26px",
                    borderLeft: `10px solid ${borderColor}`,
                    borderRight: `1px solid ${BRD}`,
                    display: "flex",
                    alignItems: "center",
                    minHeight: 96,
                  }}
                >
                  <div style={{ width: "100%" }}>
                    <div
                      style={{
                        fontSize: isTotal ? 34 : 30,
                        fontWeight: isTotal ? 900 : 800,
                        color: isTotal ? bc(brand) : TXT,
                        lineHeight: 1.1,
                        letterSpacing: isTotal ? "0.03em" : "0.01em",
                        wordBreak: "break-word",
                      }}
                    >
                      {st.name}
                    </div>

                    {hasNote && !isTotal && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {TIMES.map((t) => {
                          const note = getN(brand, st.id, t);
                          if (!note) return null;
                          return (
                            <span
                              key={t}
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: ACC,
                                background: ACL,
                                border: "1px solid rgba(255,82,0,0.18)",
                                borderRadius: 999,
                                padding: "4px 9px",
                                letterSpacing: "0.04em",
                              }}
                            >
                              {t} · {note}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {TIMES.map((t) => {
                  const v = getV(brand, st.id, t);

                  return (
                    <div
                      key={t}
                      style={{
                        borderLeft: `1px solid ${BRD}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "14px 8px",
                        background: isTotal ? `${bc(brand)}08` : "transparent",
                        minHeight: 96,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: isTotal ? 52 : 46,
                          fontWeight: 900,
                          lineHeight: 1,
                          color: v ? bc(brand) : "#C7D3E0",
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {v || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}

      <div
        data-print-row="true"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 8px 2px",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: T2,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Ricevere Qualità · Fare Qualità · Consegnare Qualità
        </span>
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: T2 }}>
          {fmtD(date)}
        </span>
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

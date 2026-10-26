import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { db, ref, set, onValue } from "./firebase.js";
import { remove } from "firebase/database";
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

/* Voci di navigazione (in alto, 4 per riga): per aggiungere un bottone basta una riga qui
   e il relativo blocco {tab === "id" && ...} nel render. */
const TABS = [
  { id: "home",     icon: "🏠", label: "Home" },
  { id: "foglio",   icon: "📋", label: "Foglio" },
  { id: "storico",  icon: "📁", label: "Storico" },
  { id: "analisi",  icon: "📊", label: "Analisi" },
  { id: "taglio",   icon: "✂️", label: "Taglio" },
  { id: "giacenza", icon: "📦", label: "Giacenza" },
  { id: "setting",  icon: "⚙️", label: "Setting" },
];

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

// Venerdì più recente (oggi incluso, se è venerdì)
const lastFridayStr = () => {
  const d = new Date();
  const back = (d.getDay() + 2) % 7; // venerdì = 5 → 0 giorni indietro
  d.setDate(d.getDate() - back);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const timeKey = (t) => t.replace(":", "_");
const encodedStationKey = (brand, sid) => `${brand}::${sid}`;
const parseStationKey = (key) => {
  const [brand, sid] = key.split("::");
  return { brand, sid };
};

function lastVal(rDay, brand, sid) {
  for (const t of ["17:00", "15:00", "12:00", "10:00"]) {
    const v = rDay?.[brand]?.[sid]?.[timeKey(t)]?.value;
    if (v !== undefined && v !== "" && !isNaN(+v)) return +v;
  }
  return null;
}

function getNumericCell(rDay, brand, sid, t) {
  const v = rDay?.[brand]?.[sid]?.[timeKey(t)]?.value;
  return v !== undefined && v !== "" && !isNaN(+v) ? +v : null;
}

function getPackingStationId(brand, stations) {
  if (brand === "MOSAICON") {
    return stations.MOSAICON?.find((s) => s.id === "m32")?.id || stations.MOSAICON?.find((s) => s.name === "INSCATOLAMENTO")?.id || null;
  }
  if (brand === "EMOS") {
    return stations.EMOS?.find((s) => s.id === "e18")?.id || stations.EMOS?.find((s) => s.name === "INSCATOLAMENTO")?.id || null;
  }
  return null;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ═══ PDF: PUNTI DI TAGLIO TRA LE PAGINE ═══ */
// Posizioni (in pixel del canvas) delle righe che il cambio pagina non deve tagliare.
// Sono misurate rispetto all'elemento stampato e con la stessa scala dell'immagine:
// offsetTop non va bene perché parte dall'inizio della pagina web, non del documento.
function getSafeBreaks(el, canvas, selector) {
  const base = el.getBoundingClientRect();
  const scale = canvas.width / base.width;
  return Array.from(el.querySelectorAll(selector))
    .map((node) => {
      const r = node.getBoundingClientRect();
      return {
        top: Math.round((r.top - base.top) * scale),
        bottom: Math.round((r.bottom - base.top) * scale),
      };
    })
    .filter((r) => r.bottom > r.top)
    .sort((a, b) => a.top - b.top);
}

// Dove finisce la pagina che parte da `start`: se il taglio cadrebbe dentro una riga,
// la pagina si ferma all'inizio di quella riga, che passa intera alla pagina dopo.
function pageSliceEnd(start, pageHeightPx, totalHeight, breaks) {
  const end = Math.min(start + pageHeightPx, totalHeight);
  if (end >= totalHeight) return end;
  const crossing = breaks.find((r) => r.top < end && r.bottom > end);
  if (crossing && crossing.top > start + pageHeightPx * 0.3) return crossing.top;
  return end;
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
  const [addPosition, setAddPosition] = useState("");
  const [pdfLibs, setPdfLibs] = useState({ html2canvas: null, jsPDF: null });

  const [cellModal, setCellModal] = useState(null);
  const [cellVal, setCellVal] = useState("");
  const [cellNote, setCellNote] = useState("");
  const [stModal, setStModal] = useState(null);
  const [stNewName, setStNewName] = useState("");
  const [addModal, setAddModal] = useState(null);
  const [addName, setAddName] = useState("");

  const [anBrands, setAnBrands] = useState({
    MOSAICON: true,
    EMOS: false,
  });
  const [anSids, setAnSids] = useState([]);
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

  const [goals, setGoals] = useState({});
  const [tg, setTg] = useState({});
  const [giac, setGiac] = useState({});

  useEffect(() => {
    return onValue(ref(db, "giacenze"), (snap) => {
      setGiac(snap.exists() ? snap.val() : {});
    });
  }, []);

  // Salva l'intera giacenza di un venerdì: sostituisce il nodo del giorno con le righe correnti
  const saveGiacDay = useCallback(async (day, rows) => {
    const node = {};
    rows.forEach((r) => {
      node[r.id] = {
        articolo: (r.articolo || "").trim().slice(0, 80),
        ordine: (r.ordine || "").trim().slice(0, 40),
        paia: Math.round(+r.paia),
        ts: r.ts || Date.now(),
      };
    });
    node._meta = { savedAt: Date.now() };
    await set(ref(db, `giacenze/${day}`), node);
  }, []);

  useEffect(() => {
    return onValue(ref(db, "taglioGiunteria"), (snap) => {
      setTg(snap.exists() ? snap.val() : {});
    });
  }, []);

  const saveTg = useCallback(async (day, taglio, giunteria, note) => {
    const num = (v) => (v === "" || isNaN(+v) || +v < 0 ? null : Math.round(+v));
    await set(ref(db, `taglioGiunteria/${day}`), {
      date: day,
      taglio: num(taglio),
      giunteria: num(giunteria),
      note: (note || "").slice(0, 300),
      ts: Date.now(),
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, "goals"), (snap) => {
      if (snap.exists()) setGoals(snap.val());
      else setGoals({});
    });
  }, []);

  const saveGoal = useCallback(async (brand, sid, value) => {
    const key = `${brand}::${sid}`;
    const newGoals = { ...goals };
    if (value === "" || value === null || isNaN(+value) || +value <= 0) {
      delete newGoals[key];
    } else {
      newGoals[key] = +value;
    }
    setGoals(newGoals);
    try {
      await set(ref(db, "goals"), newGoals);
    } catch (e) {
      console.error(e);
    }
  }, [goals]);

  useEffect(() => {
    return onValue(ref(db, "stations"), async (snap) => {
      if (snap.exists()) {
        setStations(snap.val());
      } else {
        try {
          await set(ref(db, "stations"), DEF_STATIONS);
          setStations(DEF_STATIONS);
        } catch (e) {
          console.error("Errore inizializzazione stations:", e);
        }
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);
        if (mounted) setPdfLibs({ html2canvas, jsPDF });
      } catch (e) {
        console.error("Preload librerie PDF fallito:", e);
      }
    })();
    return () => { mounted = false; };
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

  useEffect(() => {
    const activeBrands = Object.entries(anBrands).filter(([, ok]) => ok).map(([b]) => b);
    const available = activeBrands.flatMap((brand) =>
      (stations[brand] || []).map((s) => encodedStationKey(brand, s.id))
    );
    setAnSids((prev) => prev.filter((k) => available.includes(k)));
  }, [anBrands, stations]);

  const saveStations = useCallback(async (s) => {
    try {
      await set(ref(db, "stations"), s);
      setStations(s);
    } catch (e) {
      console.error("Errore salvataggio stations:", e);
      alert("Errore nel salvataggio delle stazioni.");
    }
  }, []);

  const saveCell = useCallback(async (val, note) => {
    if (!cellModal) return;
    const { brand, sid, t } = cellModal;
    const tKey = timeKey(t);
    const flashKey = `${brand}_${sid}_${tKey}`;
    setSaving(true);
    try {
      await set(ref(db, `reports/${date}/${brand}/${sid}/${tKey}`), { value: val, note });
      await set(ref(db, `reports/${date}/_meta`), { date, ts: Date.now(), updated: Date.now() });
      setSavedKeys((prev) => new Set([...prev, flashKey]));
      setTimeout(() => {
        setSavedKeys((prev) => { const n = new Set(prev); n.delete(flashKey); return n; });
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

  async function deleteReportDay(day) {
    const ok = window.confirm(
      `Vuoi eliminare definitivamente il report del giorno ${fmtD(day)}?\n\nQuesta azione rimuoverà i dati dallo storico e dalle analisi.`
    );
    if (!ok) return;
    try {
      await remove(ref(db, `reports/${day}`));
    } catch (e) {
      console.error(e);
      alert("Errore durante l'eliminazione del report.");
    }
  }

  async function renameStation(brand, sid, name) {
    const cleanName = name.trim();
    if (!cleanName) return;
    await saveStations({
      ...stations,
      [brand]: (stations[brand] || []).map((s) =>
        s.id === sid ? { ...s, name: cleanName } : s
      ),
    });
    setStModal(null);
  }

  async function deleteStation(brand, sid) {
    await saveStations({
      ...stations,
      [brand]: (stations[brand] || []).filter((s) => s.id !== sid),
    });
    setStModal(null);
  }

  async function addStation(brand, positionId, name) {
    const arr = [...(stations[brand] || [])];
    const cleanName = name.trim();
    if (!cleanName) return;
    let insertIndex = arr.length;
    if (positionId) {
      const foundIndex = arr.findIndex((s) => s.id === positionId);
      if (foundIndex >= 0) insertIndex = foundIndex;
    }
    const newStation = { id: `${brand[0].toLowerCase()}_${uid()}`, name: cleanName };
    const updatedBrandStations = [
      ...arr.slice(0, insertIndex),
      newStation,
      ...arr.slice(insertIndex),
    ];
    await saveStations({ ...stations, [brand]: updatedBrandStations });
    setAddModal(null);
    setAddName("");
    setAddPosition("");
  }

  async function moveStation(brand, sid, dir) {
    const arr = [...(stations[brand] || [])];
    const i = arr.findIndex((s) => s.id === sid);
    if (i === -1) return;
    if (arr[i].isTotal) return;
    if (dir === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (dir === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    await saveStations({ ...stations, [brand]: arr });
  }

  function toggleBrand(brand) {
    setAnBrands((prev) => {
      const next = { ...prev, [brand]: !prev[brand] };
      if (!next.MOSAICON && !next.EMOS) return prev;
      return next;
    });
  }

  function toggleStation(key) {
    setAnSids((prev) => (
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    ));
  }

  async function shareNodeAsPaginatedPdf(nodeId, filename, titleText, widthPx = 1480) {
    const el = document.getElementById(nodeId);
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
      el.style.width = `${widthPx}px`;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pxPerMm = canvas.width / pageW;
      const pageHeightPx = Math.floor(pageH * pxPerMm);
      const safeBreaks = getSafeBreaks(el, canvas, '[data-print-row="true"]');
      let rendered = 0;
      let page = 0;
      while (rendered < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceEnd = pageSliceEnd(rendered, pageHeightPx, canvas.height, safeBreaks);
        const sliceHeight = Math.max(1, sliceEnd - rendered);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const imgH = sliceHeight / pxPerMm;
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, imgH, undefined, "FAST");
        rendered += sliceHeight;
        page++;
      }
      const blob = pdf.output("blob");
      const file = new File([blob], filename, { type: "application/pdf", lastModified: Date.now() });
      const shareData = { files: [file], title: titleText, text: titleText };
      if (!window.isSecureContext) throw new Error("L'app non è in HTTPS");
      if (typeof navigator.share !== "function") throw new Error("navigator.share non disponibile");
      if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) throw new Error("Il browser non accetta la condivisione di questo file");
      await navigator.share(shareData);
    } catch (e) {
      console.error("Errore condivisione PDF:", e);
      alert(`Condivisione non riuscita: ${e.message}`);
    } finally {
      el.style.display = prevDisplay;
      el.style.width = prevWidth;
    }
  }

  async function shareWA() {
    await shareNodeAsPaginatedPdf(
      "print-doc",
      `produzione_${date}.pdf`,
      `Report produzione ${fmtD(date)}`,
      900
    );
  }

  async function shareAnalysisPdf() {
    if (!anRes || anRes.empty) {
      alert("Esegui prima un'analisi con dati disponibili.");
      return;
    }
    const el = document.getElementById("analysis-print-doc");
    if (!el) { alert("Area PDF non trovata"); return; }
    const { html2canvas, jsPDF } = pdfLibs;
    if (!html2canvas || !jsPDF) { alert("Le librerie PDF non sono ancora pronte. Riprova tra un secondo."); return; }
    const prevDisplay = el.style.display;
    const prevWidth = el.style.width;
    try {
      el.style.display = "block";
      el.style.width = "520px";
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#EAF0F8",
        logging: false,
        windowWidth: 520,
        windowHeight: el.scrollHeight,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pxPerMm = canvas.width / pageW;
      const pageHeightPx = Math.floor(pageH * pxPerMm);
      const safeBreaks = getSafeBreaks(el, canvas, '[data-print-row="true"], [data-day-cell="true"]');
      let rendered = 0;
      let page = 0;
      while (rendered < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceEnd = pageSliceEnd(rendered, pageHeightPx, canvas.height, safeBreaks);
        const sliceHeight = Math.max(1, sliceEnd - rendered);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#EAF0F8";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const imgH = sliceHeight / pxPerMm;
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, imgH, undefined, "FAST");
        rendered += sliceHeight;
        page++;
      }
      const blob = pdf.output("blob");
      const file = new File([blob], `analisi_${anFrom}_${anTo}.pdf`, { type: "application/pdf", lastModified: Date.now() });
      const shareData = { files: [file], title: `Report analisi ${fmtD(anFrom)} - ${fmtD(anTo)}`, text: `Report analisi ${fmtD(anFrom)} - ${fmtD(anTo)}` };
      if (!window.isSecureContext) throw new Error("L'app non è in HTTPS");
      if (typeof navigator.share !== "function") throw new Error("navigator.share non disponibile");
      if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) throw new Error("Il browser non accetta la condivisione di questo file");
      await navigator.share(shareData);
    } catch (e) {
      console.error("Errore condivisione PDF:", e);
      alert(`Condivisione non riuscita: ${e.message}`);
    } finally {
      el.style.display = prevDisplay;
      el.style.width = prevWidth;
    }
  }

  function runAnalysis() {
    const activeBrands = Object.entries(anBrands).filter(([, ok]) => ok).map(([b]) => b);
    const selectedKeys = anSids.filter((key) => {
      const { brand, sid } = parseStationKey(key);
      return activeBrands.includes(brand) && stations[brand]?.some((s) => s.id === sid);
    });
    const effectiveKeys = selectedKeys.length
      ? selectedKeys
      : activeBrands.flatMap((brand) => {
          const packingId = getPackingStationId(brand, stations);
          return packingId ? [encodedStationKey(brand, packingId)] : [];
        });
    const selectedStations = effectiveKeys.map((key) => {
      const { brand, sid } = parseStationKey(key);
      const st = stations[brand]?.find((s) => s.id === sid);
      return { key, brand, sid, name: st?.name || sid };
    });
    const totalPts = [];
    const stationSeries = selectedStations.map((s) => ({ ...s, pts: [], total: 0 }));
    const cur = new Date(anFrom + "T12:00:00");
    const end = new Date(anTo + "T12:00:00");
    while (cur <= end) {
      const d = cur.toISOString().split("T")[0];
      const label = fmtD(d);
      const dayReport = reports[d];
      let dayTotal = 0;
      let hasAny = false;
      stationSeries.forEach((serie) => {
        const v = lastVal(dayReport, serie.brand, serie.sid);
        if (v !== null) {
          serie.pts.push({ date: d, label, value: v });
          serie.total += v;
          dayTotal += v;
          hasAny = true;
        } else {
          serie.pts.push({ date: d, label, value: null });
        }
      });
      if (hasAny) totalPts.push({ date: d, label, value: dayTotal });
      cur.setDate(cur.getDate() + 1);
    }
    if (!totalPts.length) {
      setAnRes({ empty: true, brands: activeBrands, selectedStations });
      return;
    }
    const vals = totalPts.map((p) => p.value);
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = +(total / vals.length).toFixed(1);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const trend = vals.length > 1 && vals[0] !== 0
      ? +((((vals[vals.length - 1] - vals[0]) / vals[0]) * 100)).toFixed(1)
      : 0;
    const byBrandTotals = activeBrands.map((brand) => {
      const val = stationSeries.filter((s) => s.brand === brand).reduce((acc, s) => acc + s.total, 0);
      return { brand, total: val };
    });
    setAnRes({
      empty: false, brands: activeBrands, selectedStations, stationSeries,
      totalPts, total, avg, max, min, trend,
      days: totalPts.length,
      maxDay: totalPts[vals.indexOf(max)],
      minDay: totalPts[vals.indexOf(min)],
      byBrandTotals, from: anFrom, to: anTo,
    });
  }

  if (loading) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100dvh", background:BG, fontFamily:FONT, gap:12 }}>
        <div style={{ fontSize:40 }}>🏭</div>
        <div style={{ fontSize:16, fontWeight:700, color:TXT }}>Caricamento dati…</div>
        <div style={{ width:120, height:3, background:BRD, borderRadius:2, overflow:"hidden" }}>
          <div style={{ width:"60%", height:"100%", background:M, animation:"load 1.2s ease-in-out infinite alternate" }} />
        </div>
        <style>{`@keyframes load{from{width:20%}to{width:90%}}`}</style>
      </div>
    );
  }

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
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ border:"none", background:"rgba(255,255,255,0.18)", fontFamily:MONO, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", outline:"none", padding:"5px 10px", borderRadius:8 }}
            />
            <button
              onClick={tab === "analisi" ? shareAnalysisPdf : shareWA}
              style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"7px 13px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:FONT }}
            >
              📤 PDF
            </button>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ background:S0, borderBottom:`1px solid ${BRD}`, padding:"8px 10px", display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:6, flexShrink:0, boxShadow:"0 2px 10px rgba(13,27,42,0.05)" }}>
        {TABS.map(({ id, icon, label }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={on ? "page" : undefined}
              style={{ height:40, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"0 2px", minWidth:0, overflow:"hidden", borderRadius:12, cursor:"pointer", fontFamily:FONT, fontSize:12, fontWeight:800, whiteSpace:"nowrap", border:`1px solid ${on ? M : BRD}`, background: on ? M : S1, color: on ? "#fff" : T2, boxShadow: on ? "0 3px 10px rgba(26,92,255,0.25)" : "none" }}
            >
              <span style={{ fontSize:15, lineHeight:1 }}>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="no-print" style={{ flex:1, overflowY:"auto" }}>
        {tab === "home" && (
          <HomeTab date={date} reports={reports} stations={stations} onGoFoglio={() => setTab("foglio")} />
        )}
        {tab === "foglio" && (
          <FoglioTab
            stations={stations} getV={getV} getN={getN} openCell={openCell} savedKeys={savedKeys}
            onEditSt={(brand, st) => { setStModal({ brand, st }); setStNewName(st.name); }}
            onAddSt={(brand, afterId) => { setAddModal({ brand, afterId }); setAddName(""); setAddPosition(afterId || ""); }}
          />
        )}
        {tab === "storico" && (
          <StoricoTab reports={reports} stations={stations} onOpen={(d) => { setDate(d); setTab("foglio"); }} onDelete={deleteReportDay} />
        )}
        {tab === "analisi" && (
          <AnalisiTab
            stations={stations} anBrands={anBrands} toggleBrand={toggleBrand}
            anSids={anSids} toggleStation={toggleStation}
            anFrom={anFrom} setAnFrom={setAnFrom} anTo={anTo} setAnTo={setAnTo}
            anRes={anRes} run={runAnalysis} onShare={shareAnalysisPdf}
          />
        )}
        {tab === "taglio" && (
          <TaglioTab date={date} tg={tg} saveTg={saveTg} onOpen={(d) => setDate(d)} />
        )}
        {tab === "setting" && (
          <SettingsTab stations={stations} goals={goals} saveGoal={saveGoal} />
        )}
        <div style={{ display: tab === "giacenza" ? "block" : "none" }}>
          <GiacenzaTab giac={giac} saveGiacDay={saveGiacDay} />
        </div>
      </div>

      <div id="print-doc" style={{ display:"none", padding:"30px", background:"#fff" }}>
        <PrintDoc date={date} stations={stations} getV={getV} getN={getN} goals={goals} />
      </div>

      <div id="analysis-print-doc" style={{ display:"none", padding:"30px", background:"#EAF0F8" }}>
        {anRes && !anRes.empty ? <PrintAnalysisDoc anRes={anRes} /> : null}
      </div>

      {cellModal && (
        <Modal onClose={() => setCellModal(null)}>
          <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>
            {cellModal.brand} · {cellModal.t}
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:TXT, marginBottom:14 }}>{cellModal.name}</div>
          <input
            type="number" inputMode="decimal" autoFocus value={cellVal}
            onChange={(e) => setCellVal(e.target.value)}
            style={{ width:"100%", background:BG, border:`2.5px solid ${bc(cellModal.brand)}`, borderRadius:12, padding:14, fontFamily:MONO, fontSize:34, fontWeight:700, color:bc(cellModal.brand), textAlign:"center", outline:"none", marginBottom:12 }}
          />
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ width:7, height:7, background:ACC, borderRadius:"50%" }} />
            <span style={{ fontSize:9, fontWeight:700, color:ACC, letterSpacing:"0.1em", textTransform:"uppercase" }}>Commento</span>
            <span style={{ marginLeft:"auto", fontSize:8, color:T3 }}>max 30 car.</span>
          </div>
          <input
            type="text" value={cellNote}
            onChange={(e) => setCellNote(e.target.value.slice(0, 30))}
            placeholder="Appare sotto il numero…"
            style={{ width:"100%", background:BG, border:`1.5px solid ${BRD}`, borderRadius:10, padding:"10px 12px", fontSize:13, color:TXT, outline:"none", marginBottom:14, fontFamily:FONT }}
          />
          <Btn color={bc(cellModal.brand)} onClick={() => saveCell(cellVal, cellNote)}>✓ SALVA</Btn>
          {(cellVal || cellNote) && <Btn color={BG} textColor={T2} style={{ marginTop:8 }} onClick={() => saveCell("", "")}>Cancella valore</Btn>}
          <Btn color={BG} textColor={T3} style={{ marginTop:8 }} onClick={() => setCellModal(null)}>Annulla</Btn>
        </Modal>
      )}

      {stModal && (
        <Modal onClose={() => setStModal(null)}>
          <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>Stazione · {stModal.brand}</div>
          <div style={{ fontSize:18, fontWeight:800, color:TXT, marginBottom:14 }}>{stModal.st.name}</div>
          <input
            autoFocus value={stNewName} onChange={(e) => setStNewName(e.target.value)}
            placeholder="Nuovo nome…"
            style={{ width:"100%", background:BG, border:`2px solid ${bc(stModal.brand)}`, borderRadius:10, padding:"11px 12px", fontSize:15, color:TXT, outline:"none", marginBottom:12, fontFamily:FONT }}
          />
          <Btn color={bc(stModal.brand)} onClick={() => stNewName.trim() && renameStation(stModal.brand, stModal.st.id, stNewName.trim())}>✓ RINOMINA</Btn>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={() => { moveStation(stModal.brand, stModal.st.id, "up"); setStModal(null); }} style={{ flex:1, background:BG, border:`1px solid ${BRD}`, borderRadius:8, padding:9, fontSize:14, cursor:"pointer" }}>⬆ Su</button>
            <button onClick={() => { moveStation(stModal.brand, stModal.st.id, "down"); setStModal(null); }} style={{ flex:1, background:BG, border:`1px solid ${BRD}`, borderRadius:8, padding:9, fontSize:14, cursor:"pointer" }}>⬇ Giù</button>
          </div>
          {!stModal.st.isTotal && (
            <Btn color="#FEE2E2" textColor={RED} style={{ marginTop:8 }} onClick={() => { if (window.confirm(`Eliminare "${stModal.st.name}"?`)) deleteStation(stModal.brand, stModal.st.id); }}>
              🗑 Elimina stazione
            </Btn>
          )}
          <Btn color={BG} textColor={T3} style={{ marginTop:8 }} onClick={() => setStModal(null)}>Annulla</Btn>
        </Modal>
      )}

      {addModal && (
        <Modal onClose={() => setAddModal(null)}>
          <div style={{ fontSize:9, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>Nuova stazione · {addModal.brand}</div>
          <div style={{ fontSize:18, fontWeight:800, color:TXT, marginBottom:14 }}>Aggiungi stazione</div>
          <input
            autoFocus value={addName} onChange={(e) => setAddName(e.target.value)}
            placeholder="Nome stazione…"
            style={{ width:"100%", background:BG, border:`2px solid ${bc(addModal.brand)}`, borderRadius:10, padding:"11px 12px", fontSize:15, color:TXT, outline:"none", marginBottom:12, fontFamily:FONT }}
          />
          <div style={{ fontSize:10, fontWeight:700, color:T2, marginBottom:6, letterSpacing:"0.08em", textTransform:"uppercase" }}>Posizione</div>
          <select
            value={addPosition} onChange={(e) => setAddPosition(e.target.value)}
            style={{ width:"100%", background:BG, border:`1.5px solid ${BRD}`, borderRadius:10, padding:"11px 12px", fontSize:14, color:TXT, outline:"none", marginBottom:14, fontFamily:FONT }}
          >
            <option value="">In fondo</option>
            {stations[addModal.brand]?.map((st) => (
              <option key={st.id} value={st.id}>Prima di: {st.name}</option>
            ))}
          </select>
          <Btn color={bc(addModal.brand)} onClick={() => addName.trim() && addStation(addModal.brand, addPosition, addName)}>+ AGGIUNGI</Btn>
          <Btn color={BG} textColor={T3} style={{ marginTop:8 }} onClick={() => setAddModal(null)}>Annulla</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ═══ HOME TAB ═══ */
function HomeTab({ date, reports, stations, onGoFoglio }) {
  const getPacking17 = (rDay, brand) => {
    const sid = getPackingStationId(brand, stations);
    return sid ? getNumericCell(rDay, brand, sid, "17:00") : null;
  };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const rToday = reports[date];
  const rYest = reports[yesterdayStr()];
  const mTod = getPacking17(rToday, "MOSAICON");
  const eTod = getPacking17(rToday, "EMOS");
  const mYest = getPacking17(rYest, "MOSAICON");
  const eYest = getPacking17(rYest, "EMOS");
  const combined = (mTod ?? 0) + (eTod ?? 0);
  const combinedYest = (mYest ?? 0) + (eYest ?? 0);
  const pct = (a, b) => (b && a !== null ? +((((a - b) / b) * 100)).toFixed(1) : null);

  const last7 = useMemo(() => {
    const pts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = ymd(d);
      const m = getPacking17(reports[ds], "MOSAICON") ?? 0;
      const e = getPacking17(reports[ds], "EMOS") ?? 0;
      pts.push({ ds, label: `${d.getDate()}/${d.getMonth() + 1}`, MOSAICON: m, EMOS: e, total: m + e });
    }
    return pts;
  }, [reports, stations]);

  const activeDays = last7.filter((p) => p.total > 0);
  const avg7 = activeDays.length ? Math.round(activeDays.reduce((s, p) => s + p.total, 0) / activeDays.length) : 0;
  const hasSel = last7.some((p) => p.ds === date);

  // Unico momento animato: la barra delle quote si allarga al caricamento
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setGrown(true); return undefined; }
    const t = setTimeout(() => setGrown(true), 80);
    return () => clearTimeout(t);
  }, []);

  const mShare = combined > 0 ? ((mTod ?? 0) / combined) * 100 : 0;
  const eShare = combined > 0 ? 100 - mShare : 0;
  const grow = "width 900ms cubic-bezier(0.2,0.7,0.2,1)";
  const num = { fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" };
  const card = { background: S0, borderRadius: 20, border: `1px solid ${BRD}`, boxShadow: "0 2px 12px rgba(13,27,42,0.05)" };

  const chip = (p) => p === null ? null : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: p >= 0 ? "#DCFCE7" : "#FEE2E2", color: p >= 0 ? GRN : RED, borderRadius: 8, padding: "3px 8px", fontSize: 12, fontWeight: 800 }}>
      {p >= 0 ? "▲" : "▼"} {Math.abs(p)}%
    </span>
  );

  const brandStat = (name, val, yest, color, align) => {
    const p = pct(val, yest);
    return (
      <div style={{ flex: 1, textAlign: align }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T2 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
          {name}
        </div>
        <div style={{ ...num, fontSize: 30, color, lineHeight: 1.1, marginTop: 4 }}>{val ?? "—"}</div>
        <div style={{ fontSize: 12, color: T2, marginTop: 3 }}>
          {yest !== null && yest !== undefined ? `ieri ${yest}` : "ieri non inserito"}
          {p !== null && <span style={{ marginLeft: 6, fontWeight: 800, color: p >= 0 ? GRN : RED }}>{p >= 0 ? "▲" : "▼"} {Math.abs(p)}%</span>}
        </div>
      </div>
    );
  };

  const totalDelta = combinedYest > 0 ? pct(combined, combinedYest) : null;

  return (
    <div style={{ padding: "18px 14px 24px", fontFamily: FONT }}>
      <div style={{ padding: "0 4px", marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: TXT, letterSpacing: "-0.01em" }}>
          {(() => {
            const s = new Date(date + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
            return s.charAt(0).toUpperCase() + s.slice(1);
          })()}
        </div>
        <div style={{ fontSize: 13, color: T2, marginTop: 2 }}>
          {date === todayStr() ? "Oggi" : "Giorno selezionato"} · {new Date(date + "T12:00:00").getFullYear()}
        </div>
      </div>

      <div style={{ ...card, padding: "20px 20px 22px", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T2 }}>Paia inscatolate alle 17:00</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
          <div style={{ ...num, fontSize: 68, color: TXT, lineHeight: 1 }}>{combined || "—"}</div>
          {chip(totalDelta)}
        </div>
        {totalDelta !== null && <div style={{ fontSize: 12, color: T2, marginTop: 6 }}>rispetto a ieri ({combinedYest} paia)</div>}

        <div style={{ display: "flex", gap: 3, height: 14, marginTop: 20, background: S2, borderRadius: 7, overflow: "hidden" }}>
          <div style={{ width: grown ? `${mShare}%` : "0%", background: M, borderRadius: 7, transition: grow }} />
          <div style={{ width: grown ? `${eShare}%` : "0%", background: E, borderRadius: 7, transition: grow }} />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          {brandStat("Mosaicon", mTod, mYest, M, "left")}
          {brandStat("EMOS", eTod, eYest, E, "right")}
        </div>
      </div>

      <div style={{ ...card, padding: "18px 12px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 8px", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: TXT }}>Ultimi 7 giorni</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, fontWeight: 600, color: T2 }}>
            {avg7 > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: ACC }}><span style={{ width: 14, borderTop: `2px dashed ${ACC}` }} />media {avg7}</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: M }} />Mosaicon</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: E }} />EMOS</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={176}>
          <BarChart data={last7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={BRD} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: T2, fontFamily: FONT }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: T3, fontFamily: FONT }} axisLine={false} tickLine={false} width={34} />
            <Tooltip cursor={{ fill: "rgba(26,92,255,0.06)" }} contentStyle={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 10, fontFamily: FONT, fontSize: 12 }} labelStyle={{ color: TXT, fontWeight: 700 }} />
            <Bar dataKey="MOSAICON" stackId="paia" fill={M} maxBarSize={28}>
              {last7.map((p) => <Cell key={p.ds} fillOpacity={hasSel && p.ds !== date ? 0.55 : 1} />)}
            </Bar>
            <Bar dataKey="EMOS" stackId="paia" fill={E} radius={[6, 6, 0, 0]} maxBarSize={28}>
              {last7.map((p) => <Cell key={p.ds} fillOpacity={hasSel && p.ds !== date ? 0.55 : 1} />)}
            </Bar>
            {avg7 > 0 && <ReferenceLine y={avg7} stroke={ACC} strokeDasharray="5 4" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button
        onClick={onGoFoglio}
        style={{ width: "100%", background: ACC, color: "#fff", border: "none", borderRadius: 16, padding: "17px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: FONT, fontSize: 16, fontWeight: 800, boxShadow: "0 8px 20px rgba(255,82,0,0.28)" }}
      >
        <span>{date === todayStr() ? "Inserisci i dati di oggi" : `Inserisci i dati del ${fmtD(date)}`}</span>
        <span style={{ fontSize: 24, lineHeight: 1 }}>›</span>
      </button>
    </div>
  );
}

/* ═══ FOGLIO TAB ═══ */
function FoglioTab({ stations, getV, getN, openCell, savedKeys, onEditSt, onAddSt }) {
  return (
    <div>
      {["MOSAICON", "EMOS"].map((brand) => (
        <div key={brand} style={{ marginTop: brand === "EMOS" ? 16 : 0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:bl(brand), borderBottom:`2px solid ${bc(brand)}`, borderLeft:`5px solid ${bc(brand)}`, position:"sticky", top:0, zIndex:10 }}>
            <span style={{ fontSize:17, fontWeight:900, color:bc(brand), letterSpacing:"0.12em" }}>{brand}</span>
            <span style={{ fontFamily:MONO, fontSize:13, fontWeight:800, background:`${bc(brand)}20`, color:bc(brand), padding:"4px 14px", borderRadius:20 }}>
              {(() => {
                const packId = getPackingStationId(brand, stations);
                if (!packId) return "—";
                const v = getV(brand, packId, "17:00");
                return v ? `PACK 17 ${v}` : "—";
              })()}
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"130px repeat(4,1fr)", padding:"6px 10px 6px 14px", background:S2, borderBottom:`1px solid ${BRD}`, position:"sticky", top:48, zIndex:9 }}>
            <div style={{ fontSize:9, fontWeight:700, color:T2, letterSpacing:"0.1em", textTransform:"uppercase", display:"flex", alignItems:"center" }}>STAZIONE</div>
            {TIMES.map((t) => (
              <div key={t} style={{ fontSize:12, fontWeight:800, color:bc(brand), textAlign:"center", borderLeft:`1px solid ${BRD}`, fontFamily:MONO, display:"flex", alignItems:"center", justifyContent:"center", padding:"4px 0" }}>{t}</div>
            ))}
          </div>
          {stations[brand]?.map((st, idx) => {
            const hasNote = TIMES.some((t) => getN(brand, st.id, t));
            const isTotal = !!st.isTotal;
            return (
              <div key={st.id} style={{ display:"grid", gridTemplateColumns:"130px repeat(4,1fr)", background: isTotal ? bl(brand) : idx%2===0 ? S0 : S1, borderBottom:`1px solid ${BRD}`, borderLeft: isTotal ? `5px solid ${bc(brand)}` : hasNote ? `4px solid ${ACC}` : "4px solid transparent", minHeight:54 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 6px 8px 10px", overflow:"hidden" }}>
                  <span style={{ flex:1, fontSize: isTotal ? 12 : 11, fontWeight: isTotal ? 900 : 700, color: isTotal ? bc(brand) : hasNote ? ACC : TXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>{st.name}</span>
                  <button onClick={() => onEditSt(brand, st)} style={{ flexShrink:0, fontSize:8, background:S2, border:`1px solid ${BRD2}`, color:T2, borderRadius:4, padding:"2px 5px", cursor:"pointer", lineHeight:1.5 }}>✏</button>
                </div>
                {TIMES.map((t) => {
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
          <button onClick={() => onAddSt(brand, stations[brand]?.[stations[brand].length - 1]?.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", margin:"8px 12px", background:S0, border:`1.5px dashed ${BRD2}`, borderRadius:10, cursor:"pointer", fontFamily:FONT, width:"calc(100% - 24px)" }}>
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
function StoricoTab({ reports, stations, onOpen, onDelete }) {
  const sorted = useMemo(
    () => Object.keys(reports).filter((k) => reports[k]._meta).sort((a, b) => b.localeCompare(a)),
    [reports]
  );
  if (!sorted.length) {
    return (
      <div style={{ padding:40, textAlign:"center", color:T3, fontFamily:FONT }}>
        <div style={{ fontSize:42, marginBottom:12 }}>📁</div>
        <div style={{ fontSize:15, fontWeight:700, color:TXT }}>Nessun report ancora</div>
        <div style={{ fontSize:12, marginTop:6 }}>I dati si salvano automaticamente su Firebase.</div>
      </div>
    );
  }
  return (
    <div style={{ fontFamily:FONT }}>
      {sorted.map((d, idx) => {
        const rDay = reports[d];
        const mPack = (() => { const sid = getPackingStationId("MOSAICON", stations); return sid ? getNumericCell(rDay, "MOSAICON", sid, "17:00") : null; })();
        const ePack = (() => { const sid = getPackingStationId("EMOS", stations); return sid ? getNumericCell(rDay, "EMOS", sid, "17:00") : null; })();
        const notesN = ["MOSAICON","EMOS"].flatMap((b) =>
          (stations[b] || []).flatMap((s) => TIMES.filter((t) => rDay?.[b]?.[s.id]?.[timeKey(t)]?.note))
        ).length;
        const dt = new Date(d + "T12:00:00");
        return (
          <div key={d} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background: idx%2===0 ? S0 : S1, borderBottom:`1px solid ${BRD}`, width:"100%", textAlign:"left", fontFamily:FONT }}>
            <div style={{ flexShrink:0, textAlign:"center", width:36 }}>
              <div style={{ fontFamily:MONO, fontSize:22, fontWeight:800, color:M, lineHeight:1 }}>{String(dt.getDate()).padStart(2,"0")}</div>
              <div style={{ fontSize:8, fontWeight:700, color:T3, letterSpacing:"0.06em", textTransform:"uppercase" }}>{dt.toLocaleDateString("it-IT",{month:"short"})}</div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:TXT, textTransform:"capitalize" }}>{dt.toLocaleDateString("it-IT",{weekday:"long"})} {fmtD(d)}</div>
              <div style={{ display:"flex", gap:5, marginTop:5, flexWrap:"wrap" }}>
                {mPack !== null && <span style={{ fontFamily:MONO, fontSize:8, fontWeight:700, background:ML, color:M, padding:"2px 7px", borderRadius:4 }}>MOA PACK {mPack}</span>}
                {ePack !== null && <span style={{ fontFamily:MONO, fontSize:8, fontWeight:700, background:EL, color:E, padding:"2px 7px", borderRadius:4 }}>EMS PACK {ePack}</span>}
                {notesN > 0 && <span style={{ fontSize:8, fontWeight:700, background:ACL, color:ACC, padding:"2px 7px", borderRadius:4 }}>{notesN} nota{notesN>1?"e":""}</span>}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <button onClick={() => onOpen(d)} style={{ background:BG, border:`1px solid ${BRD}`, borderRadius:8, padding:"7px 10px", fontSize:12, fontWeight:700, color:TXT, cursor:"pointer", fontFamily:FONT }}>Apri</button>
              <button onClick={() => onDelete(d)} style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:8, padding:"7px 10px", fontSize:12, fontWeight:700, color:RED, cursor:"pointer", fontFamily:FONT }}>Elimina</button>
            </div>
          </div>
        );
      })}
      <div style={{ height:24 }} />
    </div>
  );
}

/* ═══ ANALISI TAB ═══ */
function AnalisiTab({ stations, anBrands, toggleBrand, anSids, toggleStation, anFrom, setAnFrom, anTo, setAnTo, anRes, run, onShare }) {
  const activeBrands = Object.entries(anBrands).filter(([, ok]) => ok).map(([b]) => b);
  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ background:S0, borderBottom:`1px solid ${BRD}`, padding:"14px 14px 16px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:T3, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 }}>Filtri analisi</div>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T2, marginBottom:8, letterSpacing:"0.08em", textTransform:"uppercase" }}>Brand</div>
          <div style={{ display:"flex", gap:8 }}>
            {["MOSAICON", "EMOS"].map((b) => (
              <button key={b} onClick={() => toggleBrand(b)} style={{ flex:1, padding:10, background: anBrands[b] ? bl(b) : BG, border:`1.5px solid ${anBrands[b] ? bc(b) : BRD}`, borderRadius:10, fontSize:12, fontWeight:800, color: anBrands[b] ? bc(b) : T3, cursor:"pointer", fontFamily:FONT }}>
                {anBrands[b] ? "✓ " : ""}{b}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T2, marginBottom:8, letterSpacing:"0.08em", textTransform:"uppercase" }}>Stazioni selezionabili</div>
          {activeBrands.length === 0 ? (
            <div style={{ fontSize:12, color:T3 }}>Seleziona almeno un brand.</div>
          ) : (
            activeBrands.map((brand) => (
              <div key={brand} style={{ marginBottom:10, border:`1px solid ${BRD}`, borderRadius:12, overflow:"hidden" }}>
                <div style={{ padding:"10px 12px", background:bl(brand), color:bc(brand), fontWeight:800, fontSize:12 }}>{brand}</div>
                <div style={{ padding:"10px 12px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, background:S0 }}>
                  {(stations[brand] || []).map((st) => {
                    const key = encodedStationKey(brand, st.id);
                    const checked = anSids.includes(key);
                    return (
                      <button key={key} onClick={() => toggleStation(key)} style={{ textAlign:"left", padding:"9px 10px", borderRadius:10, border:`1px solid ${checked ? bc(brand) : BRD}`, background: checked ? `${bc(brand)}12` : BG, color: checked ? bc(brand) : TXT, fontSize:11, fontWeight: checked ? 800 : 600, cursor:"pointer", fontFamily:FONT }}>
                        {checked ? "✓ " : ""}{st.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div style={{ fontSize:10, color:T3, marginTop:6 }}>Se non selezioni nessuna stazione, l'analisi usa automaticamente l'INSCATOLAMENTO dei brand attivi.</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          {[["DAL", anFrom, setAnFrom], ["AL", anTo, setAnTo]].map(([label, val, setter]) => (
            <div key={label}>
              <div style={{ fontSize:9, fontWeight:700, color:T2, marginBottom:5, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
              <input type="date" value={val} onChange={(e) => setter(e.target.value)} style={{ width:"100%", padding:"9px 10px", border:`1.5px solid ${BRD}`, borderRadius:10, fontSize:12, color:TXT, background:BG, outline:"none", fontFamily:MONO }} />
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={run} style={{ flex:1, padding:13, background:M, color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:FONT }}>📊 ANALIZZA</button>
          <button onClick={onShare} style={{ flex:1, padding:13, background:"#25D366", color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:FONT }}>📤 PDF</button>
        </div>
      </div>
      {anRes && (
        <div style={{ padding:14 }}>
          {anRes.empty ? (
            <div style={{ textAlign:"center", padding:32, color:T3 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
              <div style={{ fontSize:14, fontWeight:700, color:TXT }}>Nessun dato trovato</div>
              <div style={{ fontSize:12, marginTop:6 }}>per i filtri selezionati</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:800, color:M, letterSpacing:"0.08em", marginBottom:3 }}>{anRes.brands.join(" + ")}</div>
                <div style={{ fontSize:16, fontWeight:800, color:TXT }}>Analisi aggregata</div>
                <div style={{ fontSize:10, color:T2, marginTop:2, fontFamily:MONO }}>{fmtD(anRes.from)} → {fmtD(anRes.to)} · {anRes.days} gg</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                <KpiSmall label="Totale periodo" value={anRes.total} color={M} sub={`in ${anRes.days} giorni`} />
                <KpiSmall label="Media giornaliera" value={anRes.avg} color={M} sub="paia/giorno" />
                <KpiSmall label="Giorno migliore" value={anRes.max} color={GRN} sub={fmtD(anRes.maxDay?.date)} arrow="▲" />
                <KpiSmall label="Giorno peggiore" value={anRes.min} color={RED} sub={fmtD(anRes.minDay?.date)} arrow="▼" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                {anRes.byBrandTotals.map((b) => (
                  <KpiSmall key={b.brand} label={`Totale ${b.brand}`} value={b.total} color={bc(b.brand)} sub="somma periodo" />
                ))}
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T2, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Stazioni incluse</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {anRes.selectedStations.map((s) => (
                    <span key={s.key} style={{ fontSize:10, fontWeight:800, color:bc(s.brand), background:bl(s.brand), padding:"4px 8px", borderRadius:999 }}>{s.brand} · {s.name}</span>
                  ))}
                </div>
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, padding:"14px 6px 10px", marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T2, paddingLeft:10, marginBottom:10 }}>Andamento totale aggregato</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={anRes.totalPts} margin={{ top:4, right:14, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BRD} />
                    <XAxis dataKey="label" tick={{ fontSize:8, fill:T3, fontFamily:MONO }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize:8, fill:T3, fontFamily:MONO }} width={38} />
                    <Tooltip contentStyle={{ background:S0, border:`1px solid ${BRD}`, borderRadius:8, fontFamily:FONT, fontSize:12 }} labelStyle={{ color:TXT, fontWeight:700 }} />
                    <ReferenceLine y={anRes.avg} stroke={T3} strokeDasharray="4 4" label={{ value:`avg ${anRes.avg}`, position:"insideTopRight", fontSize:9, fill:T3, fontFamily:MONO }} />
                    <Line type="monotone" dataKey="value" stroke={M} strokeWidth={2.8} dot={{ r:3, fill:M }} activeDot={{ r:5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, overflow:"hidden", marginBottom:14 }}>
                <div style={{ padding:"10px 14px", borderBottom:`1px solid ${BRD}`, fontSize:10, fontWeight:700, color:T2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Totale per stazione selezionata</div>
                {anRes.stationSeries.map((serie, i) => (
                  <div key={serie.key} style={{ display:"flex", alignItems:"center", padding:"10px 14px", background: i%2===0 ? S0 : S1, borderBottom:`1px solid ${BRD}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:TXT }}>{serie.name}</div>
                      <div style={{ fontSize:10, color:T3 }}>{serie.brand}</div>
                    </div>
                    <div style={{ fontFamily:MONO, fontSize:20, fontWeight:800, color:bc(serie.brand) }}>{serie.total}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, overflow:"hidden", marginBottom:14 }}>
                <div style={{ padding:"10px 14px", borderBottom:`1px solid ${BRD}`, fontSize:10, fontWeight:700, color:T2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Dettaglio giornaliero aggregato</div>
                {[...anRes.totalPts].reverse().map((pt, i) => (
                  <div key={pt.date} style={{ display:"flex", alignItems:"center", padding:"10px 14px", background: i%2===0 ? S0 : S1, borderBottom:`1px solid ${BRD}` }}>
                    <div style={{ flex:1, fontSize:12, fontWeight:600, color:TXT }}>{pt.label}</div>
                    <div style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:M, marginRight:12 }}>{pt.value}</div>
                    <div style={{ width:60, height:5, background:BRD, borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${(pt.value/anRes.max)*100}%`, height:"100%", background:M, borderRadius:3 }} />
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

/* ═══ PRINT DOC PRODUZIONE ═══ */
function PrintDoc({ date, stations, getV, getN, goals = {} }) {
  const COL = "340px repeat(4, 1fr)";
  const mosaiconTargets = { "10:00": 75, "12:00": 150, "15:00": 225, "17:00": 300 };
  const getHighlightStationId = (brand) => {
    if (brand === "MOSAICON") return "m32";
    if (brand === "EMOS") return "e18";
    return null;
  };
  return (
    <div style={{ fontFamily: FONT, background: "#EAF0F8", padding: 18 }}>
      <div data-print-row="true" style={{ background: "linear-gradient(135deg,#0A3D9C 0%,#1A5CFF 58%,#00A0D6 100%)", borderRadius: 22, padding: "22px 26px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 24px rgba(26,92,255,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🏭</div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.72)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Report Produzione Giornaliero</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "0.04em" }}>MOSAICON + EMOS</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.86)", marginTop: 6, fontWeight: 500 }}>Report operativo giornaliero</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.14)", color: "#fff", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.20)", textAlign: "right", minWidth: 170 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.66)", fontWeight: 700, marginBottom: 4 }}>Data</div>
          <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmtD(date)}</div>
        </div>
      </div>
      {["MOSAICON", "EMOS"].map((brand) => {
        const highlightId = getHighlightStationId(brand);
        return (
          <div key={brand} style={{ marginBottom: 18, background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 14px rgba(13,27,42,0.06)", border: `1px solid ${BRD}`, breakInside: "avoid", pageBreakInside: "avoid" }}>
            <div data-print-row="true" style={{ display: "grid", gridTemplateColumns: COL, background: `linear-gradient(135deg, ${bc(brand)}18, #ffffff 78%)`, borderBottom: `1px solid ${BRD}` }}>
              <div style={{ padding: "18px 20px", borderLeft: `6px solid ${bc(brand)}`, display: "flex", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: bc(brand), letterSpacing: "0.10em", lineHeight: 1 }}>{brand}</div>
                  <div style={{ fontSize: 12, color: T2, marginTop: 6, fontWeight: 600 }}>Report linea produzione</div>
                </div>
              </div>
              {TIMES.map((t) => (
                <div key={t} style={{ borderLeft: `1px solid ${BRD}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 8px", background: `${bc(brand)}08` }}>
                  <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 900, color: bc(brand), lineHeight: 1, letterSpacing: "0.02em" }}>{t}</div>
                </div>
              ))}
            </div>
            {stations[brand]?.filter((st) => st.name !== "DA INSCATOLARE/GIÀ CQ").map((st, i) => {
              const isHighlight = st.id === highlightId;
              const rowBg = isHighlight ? `${bc(brand)}10` : i % 2 === 0 ? "#FFFFFF" : "#F6F8FC";
              return (
                <div key={st.id} data-print-row="true" style={{ display: "grid", gridTemplateColumns: COL, background: rowBg, borderBottom: `1px solid ${BRD}` }}>
                  <div style={{ padding: "18px 20px", borderLeft: isHighlight ? `6px solid ${bc(brand)}` : "6px solid transparent", borderRight: `1px solid ${BRD}`, display: "flex", alignItems: "center", minHeight: 82 }}>
                    <div style={{ fontSize: isHighlight ? 28 : 22, fontWeight: isHighlight ? 900 : 800, color: isHighlight ? bc(brand) : TXT, lineHeight: 1.08, letterSpacing: "0.01em", wordBreak: "break-word" }}>{st.name}</div>
                  </div>
                  {TIMES.map((t) => {
                    const v = getV(brand, st.id, t);
                    const note = getN(brand, st.id, t);
                    const stGoal = goals[`${brand}::${st.id}`];
                    const isMosaiconTotalRow = brand === "MOSAICON" && st.id === "m_t";
                    const effectiveGoal = stGoal || (isMosaiconTotalRow ? mosaiconTargets["17:00"] : null);
                    const goalDenominators = effectiveGoal ? {
                      "10:00": stGoal ? Math.round(stGoal * 0.25) : mosaiconTargets["10:00"],
                      "12:00": stGoal ? Math.round(stGoal * 0.50) : mosaiconTargets["12:00"],
                      "15:00": stGoal ? Math.round(stGoal * 0.75) : mosaiconTargets["15:00"],
                      "17:00": stGoal || mosaiconTargets["17:00"],
                    } : null;
                    const displayValue = (goalDenominators && v)
                      ? `${v}/${goalDenominators[t]}`
                      : v || "—";
                    return (
                      <div key={t} style={{ borderLeft: `1px solid ${BRD}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 6px", background: isHighlight ? `${bc(brand)}08` : "transparent", minHeight: 82 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: note ? 5 : 0, width: "100%", overflow: "hidden" }}>
                          <div style={{ fontFamily: MONO, fontSize: (isMosaiconTotalRow || goalDenominators) ? 26 : isHighlight ? 34 : 30, fontWeight: 900, lineHeight: 1, color: v ? bc(brand) : "#C7D3E0", letterSpacing: isMosaiconTotalRow ? "-0.04em" : "-0.02em", textAlign: "center", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{displayValue}</div>
                          {note ? <div style={{ fontSize: 9, fontWeight: 800, color: ACC, background: ACL, border: "1px solid rgba(255,82,0,0.18)", borderRadius: 999, padding: "3px 6px", lineHeight: 1.05, maxWidth: "90%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      <div data-print-row="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px 0" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase" }}>Ricevere Qualità · Fare Qualità · Consegnare Qualità</span>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: T2 }}>{fmtD(date)}</span>
      </div>
    </div>
  );
}

/* ═══ PRINT ANALISI ═══ */
function PrintAnalysisDoc({ anRes }) {
  return (
    <div style={{ fontFamily: FONT, background: "#EAF0F8", padding: 16, width: "100%" }}>

      {/* HEADER */}
      <div
        data-print-row="true"
        style={{ background: "linear-gradient(135deg,#0A3D9C 0%,#1A5CFF 58%,#00A0D6 100%)", borderRadius: 18, padding: "18px 20px", marginBottom: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📊</div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Report Analisi Produzione</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{anRes.brands.join(" + ")}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.60)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 2 }}>Periodo</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 900, color: "#fff" }}>{fmtD(anRes.from)} → {fmtD(anRes.to)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.14)", padding: "7px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.60)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 2 }}>Giorni</div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{anRes.days}</div>
          </div>
        </div>
      </div>

      {/* KPI — solo 2 */}
      <div
        data-print-row="true"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}
      >
        {[
          { label: "Totale periodo",    value: anRes.total, color: M,         bg: "rgba(26,92,255,0.08)",  border: "rgba(26,92,255,0.20)",  icon: "📦", sub: `${anRes.days} giorni` },
          { label: "Media giornaliera", value: anRes.avg,   color: "#0099CC", bg: "rgba(0,153,204,0.08)", border: "rgba(0,153,204,0.20)", icon: "📈", sub: "paia / giorno" },
        ].map((item) => (
          <div key={item.label} style={{ background: item.bg, border: `2px solid ${item.border}`, borderRadius: 14, padding: "12px 13px 10px", position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: 18, marginBottom: 5 }}>{item.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: 3 }}>{item.value}</div>
            <div style={{ fontSize: 10, color: T2, fontWeight: 600 }}>{item.sub}</div>
            <div style={{ position: "absolute", top: -10, right: -10, width: 50, height: 50, borderRadius: "50%", background: item.border }} />
          </div>
        ))}
      </div>

      {/* BRAND */}
      <div data-print-row="true" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {anRes.byBrandTotals.map((b) => (
          <div key={b.brand} style={{ background: "#fff", border: `1.5px solid ${bc(b.brand)}30`, borderLeft: `7px solid ${bc(b.brand)}`, borderRadius: "0 14px 14px 0", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Totale periodo</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: bc(b.brand) }}>{b.brand}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 900, color: bc(b.brand), lineHeight: 1 }}>{b.total}</div>
              <div style={{ fontSize: 11, color: T2, marginTop: 2 }}>~{(b.total / anRes.days).toFixed(1)} / giorno</div>
            </div>
          </div>
        ))}
      </div>

      {/* DETTAGLIO GIORNALIERO — griglia 3 colonne */}
      <div
        data-print-row="true"
        style={{ background: "#fff", border: `1px solid ${BRD}`, borderRadius: 16, overflow: "hidden" }}
      >
        <div style={{ padding: "11px 16px", borderBottom: `1px solid ${BRD}`, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(90deg,#F0F4FF,#fff)" }}>
          <span style={{ display: "inline-block", width: 4, height: 14, background: M, borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: "uppercase", letterSpacing: "0.10em" }}>Dettaglio giornaliero</span>
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, fontWeight: 700, color: T3 }}>media: {anRes.avg} paia/g</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
          {[...anRes.totalPts].reverse().map((pt, i) => {
            const isAboveAvg = pt.value >= anRes.avg;
            const barPct = anRes.max > 0 ? (pt.value / anRes.max) * 100 : 0;
            return (
              <div
                key={pt.date}
                data-day-cell="true"
                style={{ padding: "8px 10px", background: i % 2 === 0 ? "#fff" : "#F8FBFF", borderBottom: `1px solid ${BRD}`, borderRight: (i % 3 !== 2) ? `1px solid ${BRD}` : "none" }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: T2, marginBottom: 3 }}>{pt.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 900, color: M, lineHeight: 1 }}>{pt.value}</div>
                  <div style={{ fontSize: 8, fontWeight: 800, padding: "2px 4px", borderRadius: 4, background: isAboveAvg ? "#DCFCE7" : "#FEE2E2", color: isAboveAvg ? GRN : RED }}>
                    {isAboveAvg ? "▲" : "▼"}
                  </div>
                </div>
                <div style={{ height: 4, background: BRD, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${barPct}%`, height: "100%", background: `linear-gradient(90deg,${M},#0099CC)`, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#EEF4FF", borderTop: `2px solid ${M}30` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M }}>Media periodo</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 900, color: M }}>{anRes.avg}</div>
            <div style={{ fontSize: 11, color: T2 }}>paia / giorno</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div data-print-row="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 0", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ricevere Qualità · Fare Qualità · Consegnare Qualità</span>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: T2 }}>{fmtD(anRes.from)} → {fmtD(anRes.to)}</span>
      </div>

    </div>
  );
}

/* ═══ MODAL ═══ */
function TaglioTab({ date, tg, saveTg, onOpen }) {
  const cur = tg[date] || {};
  const [taglio, setTaglio] = useState("");
  const [giunteria, setGiunteria] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTaglio(cur.taglio ?? "");
    setGiunteria(cur.giunteria ?? "");
    setNote(cur.note ?? "");
    setState("idle");
  }, [date, cur.taglio, cur.giunteria, cur.note]);

  const days = Object.keys(tg).sort().reverse().slice(0, 14);

  const doSave = async () => {
    setState("saving");
    try {
      await saveTg(date, taglio, giunteria, note);
      setState("ok");
    } catch (e) {
      console.error(e);
      setState("err");
    }
  };

  const copyAll = async () => {
    const rows = Object.keys(tg).sort().map((d) => ({ date: d, taglio: tg[d].taglio ?? null, giunteria: tg[d].giunteria ?? null, note: tg[d].note || "" }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert("Copia non riuscita.");
    }
  };

  const field = (label, value, setValue, color) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, fontWeight:700, color, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
      <input
        type="number" inputMode="numeric" value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width:"100%", boxSizing:"border-box", background:S0, border:`2.5px solid ${color}`, borderRadius:14, padding:"14px 16px", fontFamily:MONO, fontSize:34, fontWeight:700, color, outline:"none" }}
      />
    </div>
  );

  return (
    <div style={{ padding:16 }}>
      <div style={{ fontSize:18, fontWeight:800, color:TXT }}>Taglio e giunteria</div>
      <div style={{ fontSize:12, color:T2, marginBottom:16 }}>Paia del giorno {fmtD(date)}. Cambia la data in alto per correggere un altro giorno.</div>

      {field("Taglio · paia del giorno", taglio, setTaglio, M)}
      {field("Giunteria · paia del giorno", giunteria, setGiunteria, E)}

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:T2, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Nota (facoltativa)</div>
        <input
          type="text" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)}
          placeholder="Es. fermo macchina, mancanza materiale"
          style={{ width:"100%", boxSizing:"border-box", background:S0, border:`1.5px solid ${BRD2}`, borderRadius:12, padding:"12px 14px", fontFamily:FONT, fontSize:15, color:TXT, outline:"none" }}
        />
      </div>

      <Btn color={ACC} onClick={doSave} style={{ width:"100%", padding:"16px 0", fontSize:16 }}>
        {state === "saving" ? "Salvataggio…" : "Salva giornata"}
      </Btn>
      {state === "ok" && <div style={{ marginTop:8, fontSize:13, fontWeight:700, color:GRN }}>Salvato.</div>}
      {state === "err" && <div style={{ marginTop:8, fontSize:13, fontWeight:700, color:RED }}>Non salvato: riprova o avvisa Stefano.</div>}

      <div style={{ marginTop:22, fontSize:10, fontWeight:700, color:T2, letterSpacing:"0.1em", textTransform:"uppercase" }}>Ultimi giorni (tocca per correggere)</div>
      <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:12, marginTop:8 }}>
        {days.length === 0 && <div style={{ padding:14, fontSize:13, color:T3 }}>Nessun dato inserito.</div>}
        {days.map((d, i) => (
          <button key={d} onClick={() => onOpen(d)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", minHeight:44, padding:"0 14px", background:"none", border:"none", borderTop: i ? `1px solid ${BRD}` : "none", cursor:"pointer", fontFamily:FONT, fontSize:14, color:TXT }}>
            <span>{fmtD(d)}</span>
            <span style={{ fontFamily:MONO, fontWeight:700 }}>
              <span style={{ color:M }}>{tg[d].taglio ?? "–"}</span> · <span style={{ color:E }}>{tg[d].giunteria ?? "–"}</span>
            </span>
          </button>
        ))}
      </div>

      <button onClick={copyAll} style={{ marginTop:18, background:"none", border:`1px solid ${BRD2}`, borderRadius:10, padding:"10px 14px", fontFamily:FONT, fontSize:12, fontWeight:700, color:T2, cursor:"pointer" }}>
        {copied ? "Copiato" : "Copia tutti i dati"}
      </button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,0.5)", display: "flex", alignItems: "flex-end", zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: S0, width: "100%", maxWidth: 900, margin: "0 auto", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", borderTop: `1px solid ${BRD2}`, boxShadow: "0 -8px 32px rgba(13,27,42,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 32, height: 3, background: BRD2, borderRadius: 2, margin: "0 auto 16px" }} />
        {children}
      </div>
    </div>
  );
}

/* ═══ BTN ═══ */
function Btn({ children, color = M, textColor = "#fff", onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{ width:"100%", padding:13, background:color, color:textColor, border:"none", borderRadius:12, fontSize:13, fontWeight:800, cursor:"pointer", letterSpacing:"0.05em", fontFamily:FONT, ...style }}>
      {children}
    </button>
  );
}

/* ═══ KPI SMALL ═══ */
function KpiSmall({ label, value, color, sub, arrow }) {
  return (
    <div style={{ background:S0, border:`1px solid ${BRD}`, borderRadius:14, padding:"12px 13px", boxShadow:"0 2px 8px rgba(13,27,42,0.04)" }}>
      <div style={{ fontSize:7.5, fontWeight:700, color:T3, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:MONO, fontSize:26, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T2, marginTop:5 }}>{arrow && <span style={{ marginRight:3 }}>{arrow}</span>}{sub}</div>}
    </div>
  );
}

/* ═══ GIACENZA DEL VENERDÌ SERA ═══ */
function GiacenzaTab({ giac, saveGiacDay }) {
  const [day, setDay] = useState(() => lastFridayStr());
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [editId, setEditId] = useState(null);
  const [articolo, setArticolo] = useState("");
  const [ordine, setOrdine] = useState("");
  const [paia, setPaia] = useState("");
  const [err, setErr] = useState("");
  const [saveState, setSaveState] = useState("idle");

  // Righe e data di salvataggio come stanno nel database per il venerdì scelto
  const node = giac[day];
  const exists = node !== undefined;
  const savedAt = node?._meta?.savedAt || null;
  const dbRows = useMemo(
    () => Object.entries(node || {})
      .filter(([k]) => k !== "_meta")
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0)),
    [node]
  );

  // Finché non ci sono modifiche in sospeso, la bozza segue il database
  useEffect(() => {
    if (!dirty) setDraft(dbRows);
  }, [dbRows, dirty]);

  // Avvisa se si chiude la pagina con modifiche non salvate
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const totale = draft.reduce((s, r) => s + (+r.paia || 0), 0);
  const isFriday = new Date(day + "T12:00:00").getDay() === 5;
  const savedDays = Object.keys(giac).sort().reverse().slice(0, 8);
  const formHasText = articolo.trim() !== "" || ordine.trim() !== "" || paia !== "";

  const resetForm = () => {
    setEditId(null);
    setArticolo("");
    setOrdine("");
    setPaia("");
    setErr("");
  };

  const changeDay = (d) => {
    if (d === day) return;
    if ((dirty || formHasText) && !window.confirm("Ci sono modifiche non salvate. Cambiando venerdì andranno perse. Continuare?")) return;
    setDay(d);
    setDirty(false);
    setSaveState("idle");
    resetForm();
  };

  const addOrUpdateRow = () => {
    const p = Math.round(+paia);
    if (!articolo.trim()) return setErr("Inserisci l'articolo.");
    if (!ordine.trim()) return setErr("Inserisci il numero d'ordine (es. 7/20410/1).");
    if (paia === "" || isNaN(p) || p <= 0) return setErr("Inserisci un numero di paia maggiore di zero.");
    const row = { articolo: articolo.trim(), ordine: ordine.trim(), paia: p };
    if (editId) {
      setDraft((prev) => prev.map((r) => (r.id === editId ? { ...r, ...row } : r)));
    } else {
      setDraft((prev) => [...prev, { id: uid(), ts: Date.now(), ...row }]);
    }
    setDirty(true);
    setSaveState("idle");
    resetForm();
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setArticolo(r.articolo || "");
    setOrdine(r.ordine || "");
    setPaia(String(r.paia ?? ""));
    setErr("");
  };

  const removeRow = (id) => {
    setDraft((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
    setSaveState("idle");
    if (editId === id) resetForm();
  };

  const discard = () => {
    if (!window.confirm("Annullare le modifiche non salvate e tornare all'ultima versione salvata?")) return;
    setDirty(false);
    setDraft(dbRows);
    setSaveState("idle");
    resetForm();
  };

  const doSave = async () => {
    if (formHasText) return setErr("C'è una riga non ancora aggiunta: premi «Aggiungi riga» oppure svuota i campi.");
    setErr("");
    setSaveState("saving");
    try {
      await saveGiacDay(day, draft);
      setDirty(false);
      setSaveState("ok");
    } catch (e) {
      console.error(e);
      setSaveState("err");
    }
  };

  const label = (txt, color = T2) => (
    <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{txt}</div>
  );
  const inputStyle = { width: "100%", boxSizing: "border-box", background: S0, border: `1.5px solid ${BRD2}`, borderRadius: 12, padding: "12px 14px", fontFamily: FONT, fontSize: 15, color: TXT, outline: "none" };

  const fmtSaved = (ts) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString("it-IT", { day: "numeric", month: "long" })} alle ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  };
  let status = { text: "Non ancora salvata", color: T2, bg: S2 };
  if (dirty) status = { text: "Modifiche non salvate", color: ACC, bg: ACL };
  else if (exists) status = { text: savedAt ? `Salvata il ${fmtSaved(savedAt)}` : "Salvata", color: GRN, bg: "#DCFCE7" };

  const canSave = dirty || !exists;

  return (
    <div style={{ fontFamily: FONT, padding: "14px 14px", paddingBottom: 32 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: TXT, marginBottom: 4 }}>Giacenza del venerdì sera</div>
      <div style={{ fontSize: 12, color: T2, marginBottom: 14 }}>Aggiungi una riga per ogni articolo e ordine rimasto in giacenza, poi premi «Salva giacenza».</div>

      <div style={{ marginBottom: 14 }}>
        {label("Venerdì di riferimento")}
        <input type="date" value={day} onChange={(e) => e.target.value && changeDay(e.target.value)} style={{ ...inputStyle, fontFamily: MONO, fontWeight: 700 }} />
        {!isFriday && <div style={{ fontSize: 11, color: ACC, marginTop: 6, fontWeight: 600 }}>Attenzione: la data scelta non è un venerdì.</div>}
      </div>

      <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 16, padding: 14, marginBottom: 16, boxShadow: "0 2px 10px rgba(13,27,42,0.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: editId ? ACC : M, marginBottom: 12 }}>{editId ? "Modifica riga" : "Nuova riga"}</div>
        <div style={{ marginBottom: 12 }}>
          {label("Articolo")}
          <input type="text" value={articolo} maxLength={80} onChange={(e) => setArticolo(e.target.value)} placeholder="Codice o nome articolo" style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1.4 }}>
            {label("N° ordine")}
            <input type="text" value={ordine} maxLength={40} onChange={(e) => setOrdine(e.target.value)} placeholder="7/20410/1" style={{ ...inputStyle, fontFamily: MONO, fontWeight: 700 }} />
          </div>
          <div style={{ flex: 1 }}>
            {label("Paia")}
            <input type="number" inputMode="numeric" min="1" value={paia} onChange={(e) => setPaia(e.target.value)} placeholder="0" style={{ ...inputStyle, fontFamily: MONO, fontWeight: 700, color: M }} />
          </div>
        </div>
        {err && <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 10 }}>{err}</div>}
        <Btn color={editId ? ACC : M} onClick={addOrUpdateRow}>
          {editId ? "✓ AGGIORNA RIGA" : "+ AGGIUNGI RIGA"}
        </Btn>
        {(editId || formHasText) && <Btn color={BG} textColor={T2} style={{ marginTop: 8 }} onClick={resetForm}>{editId ? "Annulla modifica" : "Svuota i campi"}</Btn>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Giacenza del {fmtD(day)}</div>
        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: TXT }}>{draft.length} {draft.length === 1 ? "riga" : "righe"} · {totale} paia</div>
      </div>
      <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12, overflow: "hidden" }}>
        {draft.length === 0 && <div style={{ padding: 14, fontSize: 13, color: T3 }}>Nessuna riga inserita per questo venerdì.</div>}
        {draft.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i ? `1px solid ${BRD}` : "none", background: editId === r.id ? ACL : "transparent" }}>
            <button onClick={() => startEdit(r)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.articolo}</div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: T2, marginTop: 2 }}>{r.ordine}</div>
            </button>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: M }}>{r.paia}</div>
            <button onClick={() => removeRow(r.id)} aria-label="Elimina riga" style={{ background: "#FEE2E2", color: RED, border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 14 }}>🗑</button>
          </div>
        ))}
      </div>
      {draft.length > 0 && <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>Tocca una riga per modificarla.</div>}

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, background: status.bg, color: status.color, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color }} />
        {status.text}
      </div>
      <Btn color={canSave ? ACC : BRD} textColor={canSave ? "#fff" : T3} style={{ marginTop: 10, padding: 16, fontSize: 15, cursor: canSave ? "pointer" : "default" }} onClick={() => { if (canSave && saveState !== "saving") doSave(); }}>
        {saveState === "saving" ? "Salvataggio…" : canSave ? "Salva giacenza" : "Giacenza salvata"}
      </Btn>
      {dirty && <Btn color={BG} textColor={T2} style={{ marginTop: 8 }} onClick={discard}>Annulla modifiche</Btn>}
      {saveState === "err" && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: RED }}>Non salvata: controlla la connessione e riprova.</div>}

      {savedDays.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Venerdì già salvati</div>
          <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12 }}>
            {savedDays.map((d, i) => {
              const rs = Object.entries(giac[d] || {}).filter(([k]) => k !== "_meta").map(([, r]) => r);
              const tot = rs.reduce((s, r) => s + (+r.paia || 0), 0);
              return (
                <button key={d} onClick={() => changeDay(d)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 44, padding: "0 14px", background: d === day ? ML : "none", border: "none", borderTop: i ? `1px solid ${BRD}` : "none", cursor: "pointer", fontFamily: FONT, fontSize: 14, color: TXT }}>
                  <span>{fmtD(d)}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, color: M }}>{rs.length} {rs.length === 1 ? "riga" : "righe"} · {tot} paia</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ SETTINGS TAB (obiettivi giornalieri) ═══ */
function SettingsTab({ stations, goals, saveGoal }) {
  const [localGoals, setLocalGoals] = useState({});

  useEffect(() => {
    setLocalGoals(goals);
  }, [goals]);

  return (
    <div style={{ fontFamily: FONT, padding: "14px 14px", paddingBottom: 32 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TXT, marginBottom: 4 }}>Obiettivi giornalieri</div>
        <div style={{ fontSize: 12, color: T2 }}>Imposta il target di paia al giorno per ogni stazione. Apparirà nel PDF come x/obiettivo per ogni orario.</div>
      </div>

      {["MOSAICON", "EMOS"].map((brand) => (
        <div key={brand} style={{ marginBottom: 20, background: S0, borderRadius: 16, border: `1px solid ${BRD}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(13,27,42,0.05)" }}>
          <div style={{ padding: "12px 16px", background: bl(brand), borderBottom: `2px solid ${bc(brand)}`, borderLeft: `5px solid ${bc(brand)}` }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: bc(brand), letterSpacing: "0.1em" }}>{brand}</span>
          </div>
          {(stations[brand] || []).map((st, i) => {
            const key = `${brand}::${st.id}`;
            const val = localGoals[key] ?? "";
            const goal = goals[key];
            return (
              <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: i % 2 === 0 ? S0 : S1, borderBottom: `1px solid ${BRD}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TXT }}>{st.name}</div>
                  {goal ? (
                    <div style={{ fontSize: 10, color: T2, marginTop: 2 }}>
                      10:00 /{Math.round(goal*0.25)} · 12:00 /{Math.round(goal*0.50)} · 15:00 /{Math.round(goal*0.75)} · 17:00 /{goal}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>Nessun obiettivo</div>
                  )}
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={val}
                  onChange={(e) => setLocalGoals(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={(e) => saveGoal(brand, st.id, e.target.value)}
                  style={{ width: 72, padding: "8px 10px", border: `2px solid ${goal ? bc(brand) : BRD}`, borderRadius: 10, fontFamily: MONO, fontSize: 16, fontWeight: 700, color: goal ? bc(brand) : TXT, textAlign: "center", outline: "none", background: goal ? `${bc(brand)}10` : BG }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

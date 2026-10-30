import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { db, ref, set, get, onValue, update } from "./firebase.js";
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
  { id: "manovia",  icon: "🔄", label: "Manovia" },
  { id: "piano",    icon: "🗓️", label: "Piano" },
  { id: "rientri",  icon: "↩️", label: "Rientri" },
  { id: "setting",  icon: "⚙️", label: "Setting" },
];

/* Schermo largo (PC): l'app usa tutta la larghezza invece della colonna da telefono */
const WIDE_MIN = 1100;
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= WIDE_MIN);
  useEffect(() => {
    const h = () => setWide(window.innerWidth >= WIDE_MIN);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return wide;
}

/* Monitor grandi (27"): oltre ~1600 px tutto viene ingrandito, così testo e celle restano leggibili */
const zoomFor = () => (typeof window === "undefined" ? 1 : Math.min(1.75, Math.max(1, window.innerWidth / 1500)));
function useZoom() {
  const [z, setZ] = useState(zoomFor);
  useEffect(() => {
    const h = () => setZ(zoomFor());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return z;
}

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
  const wide = useWide();
  const zoomRaw = useZoom();
  const zoom = wide ? zoomRaw : 1;
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
  const [man, setMan] = useState({});
  const [rie, setRie] = useState({});
  const [pia, setPia] = useState({});
  const [pvers, setPvers] = useState({});

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
    return onValue(ref(db, "manoviaSituazione"), (snap) => {
      setMan(snap.exists() ? snap.val() : {});
    });
  }, []);

  // Salva la situazione manovia di un giorno (due tabelle: per articolo e per cliente)
  const saveManDay = useCallback(async (day, draft) => {
    const node = {};
    ["art", "cli"].forEach((sec) => {
      node[sec] = {};
      (draft[sec] || []).forEach((r, i) => {
        node[sec][r.id] = {
          nome: (r.nome || "").trim().slice(0, 40),
          cons: (r.cons || "").trim().slice(0, 14),
          q: r.q || {},
          o: i,
        };
      });
    });
    node._meta = { savedAt: Date.now() };
    await set(ref(db, `manoviaSituazione/${day}`), node);
  }, []);

  useEffect(() => {
    return onValue(ref(db, "rientri"), (snap) => {
      setRie(snap.exists() ? snap.val() : {});
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, "piano"), (snap) => {
      setPia(snap.exists() ? snap.val() : {});
    });
  }, []);
  useEffect(() => {
    return onValue(ref(db, "pianoVers"), (snap) => {
      setPvers(snap.exists() ? snap.val() : {});
    });
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
    <div style={{ maxWidth: wide ? Math.floor(window.innerWidth / zoom) : 900, zoom: zoom > 1 ? zoom : undefined, margin:"0 auto", minHeight: zoom > 1 ? `${100 / zoom}dvh` : "100dvh", display:"flex", flexDirection:"column", background:BG, fontFamily:FONT }}>
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

      <div className="no-print" style={{ background:S0, borderBottom:`1px solid ${BRD}`, padding:"8px 10px", display:"grid", gridTemplateColumns: wide ? `repeat(${TABS.length}, minmax(0, 1fr))` : "repeat(4, minmax(0, 1fr))", gap:6, flexShrink:0, boxShadow:"0 2px 10px rgba(13,27,42,0.05)" }}>
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
          <HomeTab date={date} reports={reports} stations={stations} onGoFoglio={() => setTab("foglio")} wide={wide} />
        )}
        {tab === "foglio" && (
          <FoglioTab
            wide={wide} stations={stations} getV={getV} getN={getN} openCell={openCell} savedKeys={savedKeys}
            onEditSt={(brand, st) => { setStModal({ brand, st }); setStNewName(st.name); }}
            onAddSt={(brand, afterId) => { setAddModal({ brand, afterId }); setAddName(""); setAddPosition(afterId || ""); }}
          />
        )}
        {tab === "storico" && (
          <StoricoTab wide={wide} reports={reports} stations={stations} onOpen={(d) => { setDate(d); setTab("foglio"); }} onDelete={deleteReportDay} />
        )}
        {tab === "analisi" && (
          <AnalisiTab
            wide={wide} stations={stations} anBrands={anBrands} toggleBrand={toggleBrand}
            anSids={anSids} toggleStation={toggleStation}
            anFrom={anFrom} setAnFrom={setAnFrom} anTo={anTo} setAnTo={setAnTo}
            anRes={anRes} run={runAnalysis} onShare={shareAnalysisPdf}
          />
        )}
        {tab === "taglio" && (
          <TaglioTab wide={wide} date={date} tg={tg} saveTg={saveTg} onOpen={(d) => setDate(d)} />
        )}
        {tab === "setting" && (
          <SettingsTab wide={wide} stations={stations} goals={goals} saveGoal={saveGoal} />
        )}
        <div style={{ display: tab === "giacenza" ? "block" : "none" }}>
          <GiacenzaTab giac={giac} saveGiacDay={saveGiacDay} wide={wide} />
        </div>
        <div style={{ display: tab === "manovia" ? "block" : "none" }}>
          <ManoviaTab man={man} saveManDay={saveManDay} wide={wide} />
        </div>
        {tab === "piano" && <PianoTab pia={pia} vers={pvers} wide={wide} />}
        {tab === "rientri" && <RientriTab rie={rie} wide={wide} />}
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
function HomeTab({ date, reports, stations, onGoFoglio, wide }) {
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

      <div style={wide ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", gap: 14, alignItems: "stretch" } : undefined}>
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
function FoglioTab({ wide, stations, getV, getN, openCell, savedKeys, onEditSt, onAddSt }) {
  return (
    <div style={wide ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, alignItems: "start", padding: "0 14px" } : undefined}>
      {["MOSAICON", "EMOS"].map((brand) => (
        <div key={brand} style={{ marginTop: brand === "EMOS" && !wide ? 16 : 0 }}>
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
function StoricoTab({ wide, reports, stations, onOpen, onDelete }) {
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
    <div style={wide ? { fontFamily:FONT, display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(420px, 1fr))", gap:12, padding:14, alignItems:"start" } : { fontFamily:FONT }}>
      {sorted.map((d, idx) => {
        const rDay = reports[d];
        const mPack = (() => { const sid = getPackingStationId("MOSAICON", stations); return sid ? getNumericCell(rDay, "MOSAICON", sid, "17:00") : null; })();
        const ePack = (() => { const sid = getPackingStationId("EMOS", stations); return sid ? getNumericCell(rDay, "EMOS", sid, "17:00") : null; })();
        const notesN = ["MOSAICON","EMOS"].flatMap((b) =>
          (stations[b] || []).flatMap((s) => TIMES.filter((t) => rDay?.[b]?.[s.id]?.[timeKey(t)]?.note))
        ).length;
        const dt = new Date(d + "T12:00:00");
        return (
          <div key={d} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background: idx%2===0 || wide ? S0 : S1, borderBottom:`1px solid ${BRD}`, width:"100%", textAlign:"left", fontFamily:FONT, ...(wide ? { border:`1px solid ${BRD}`, borderRadius:14, boxSizing:"border-box" } : null) }}>
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
function AnalisiTab({ wide, stations, anBrands, toggleBrand, anSids, toggleStation, anFrom, setAnFrom, anTo, setAnTo, anRes, run, onShare }) {
  const activeBrands = Object.entries(anBrands).filter(([, ok]) => ok).map(([b]) => b);
  return (
    <div style={wide ? { fontFamily:FONT, display:"grid", gridTemplateColumns:"minmax(380px, 480px) minmax(0, 1fr)", alignItems:"start", gap:0 } : { fontFamily:FONT }}>
      <div style={{ background:S0, borderBottom:`1px solid ${BRD}`, padding:"14px 14px 16px", ...(wide ? { borderRight:`1px solid ${BRD}`, minHeight:"calc(100dvh - 110px)" } : null) }}>
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
      {wide && !anRes && (
        <div style={{ padding:40, textAlign:"center", color:T3 }}>
          <div style={{ fontSize:42, marginBottom:10 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:700, color:TXT }}>Scegli i filtri a sinistra</div>
          <div style={{ fontSize:12, marginTop:6 }}>Poi premi «Analizza»: qui compaiono totali, andamento e dettaglio giornaliero.</div>
        </div>
      )}
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
              <div style={{ display:"grid", gridTemplateColumns: wide ? "repeat(4, minmax(0, 1fr))" : "1fr 1fr", gap:10, marginBottom:14 }}>
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
                <ResponsiveContainer width="100%" height={wide ? 280 : 180}>
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
function TaglioTab({ wide, date, tg, saveTg, onOpen }) {
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

      <div style={wide ? { display:"grid", gridTemplateColumns:"minmax(0, 520px) minmax(0, 1fr)", gap:32, alignItems:"start" } : undefined}>
      <div>
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

      </div>
      <div>
      <div style={{ marginTop: wide ? 0 : 22, fontSize:10, fontWeight:700, color:T2, letterSpacing:"0.1em", textTransform:"uppercase" }}>Ultimi giorni (tocca per correggere)</div>
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
      </div>
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
function GiacenzaTab({ giac, saveGiacDay, wide }) {
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

      <div style={wide ? { display: "grid", gridTemplateColumns: "minmax(0, 420px) minmax(0, 1fr)", gap: 24, alignItems: "start" } : undefined}>
      <div>
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

      </div>
      <div>
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
      </div>
    </div>
  );
}

/* ═══ MANOVIA – SITUAZIONE ORE 17:30 ═══ */
// Colonne come nel modello Excel (foglio giornaliero). Le colonne "calc" si calcolano da sole.
// Le quantità si possono scrivere come somma: "17+11".
const MAN_COLS = [
  { k: "brand", l: "Brand", text: true, brand: true },
  { k: "cons", l: "Data di consegna", text: true },
  { k: "obi", l: "Obiettivo" },
  { k: "sped", l: "Spedito" },
  { k: "saldo", l: "Saldo", calc: true },
  { k: "insc", l: "Inscatolate" },
  { k: "dins", l: "Da inscatolare", calc: true },
  { k: "contr", l: "Controllate" },
  { k: "ingu", l: "Inguarnite" },
  { k: "scs", l: "Scorta sott." },
  { k: "scn", l: "Scorta no sott." },
  { k: "scf", l: "Scorta no sott. (ferme)" },
  { k: "fin", l: "Totale in finissaggio", calc: true },
  { k: "dain", l: "Da inguarnire" },
  { k: "dinc", l: "Da inchiodare" },
  { k: "sfo", l: "Sformate non inchiodate", l2: "DA SUOLARE" },
  { k: "suo", l: "Suolate non inchiodate", l2: "DA INCOLLARE" },
  { k: "sme", l: "Smerigliate non suolate", l2: "DA SMERIGLIARE" },
  { k: "cal", l: "Calzerate non smerigliate", l2: "DA SGROSSA + RIBATT." },
  { k: "mon", l: "Montate non calzerate" },
  { k: "car", l: "Caricate Non Montate" },
  { k: "dac", l: "Da Caricare" },
];
const MAN_INPUTS = MAN_COLS.filter((c) => !c.calc && !c.text);
const MAN_SECS = [
  { id: "art", title: "Per articolo", addLabel: "Nuovo articolo", variant: false },
  { id: "cli", title: "Per cliente", addLabel: "Nuovo cliente", variant: true },
];
// Elenco di partenza (dal foglio del 26/10): da qui in poi si parte dal giorno precedente
const MAN_TEMPLATE = {
  art: [
    ...["OMBRE", "ELBE", "OCEANE NERE", "OCEANE MARRONI", "VOLVER", "OMELA", "NEREE", "NINON", "OASIS", "JANE", "NOA"].map((n) => [n, "HERMÈS"]),
    ["CHROME HEARTS", "CHROME HEARTS"], ["MOMONI'", "MOMONÌ"],
    ...["WS271-1709", "WS271-766", "WS271-93", "WS271-89", "WS271-1024", "WS271-1703"].map((n) => [n, "DRIES VAN NOTEN"]),
    ["PIERRE HARDY", "PIERRE HARDY"], ["PH SUMMER", "PIERRE HARDY"], ["PROENZA", "PROENZA SCHOULER"], ["PLANC", "PLAN C"], ["LORENA", "LORENA"],
  ],
  cli: [
    ["HERMES OASIS", "HERMÈS"], ["DRIES VAN NOTEN", "DRIES VAN NOTEN"], ["PH", "PIERRE HARDY"], ["CHROME HEARTS", "CHROME HEARTS"],
    ["Momonì", "MOMONÌ"], ["PLAN C", "PLAN C"], ["CHANEL COCO", "CHANEL"], ["CHANEL DREAMY TAB", "CHANEL"],
  ],
};
// brand di una riga: quello scritto, altrimenti quello del modello (per giorni salvati prima della colonna Brand)
const manBrand = (secId, r) => {
  if (r.brand !== undefined && r.brand !== null) return r.brand;
  const t = MAN_TEMPLATE[secId].find(([n]) => n.toLowerCase() === String(r.nome || "").toLowerCase());
  return t ? t[1] : "";
};
const manBrandKey = (secId, r) => manBrand(secId, r).trim().toUpperCase();

// "5 + 5", "=17+11", "12" → numero; vuoto → 0; testo non valido → NaN
function manSum(v) {
  const s = String(v ?? "").trim().replace(/^[=+\s]+/, "").replace(/[+\s]+$/, "");
  if (s === "") return String(v ?? "").trim().replace(/[=+\s]/g, "") === "" ? 0 : NaN;
  if (!/^\d+(\s*\+\s*\d+)*$/.test(s)) return NaN;
  return s.split("+").reduce((a, x) => a + parseInt(x, 10), 0);
}
const manN = (r, k) => manSum(r.q?.[k]) || 0;
const manHas = (r, k) => String(r.q?.[k] ?? "").trim() !== "";
// valore di una colonna (anche calcolata); null = niente da mostrare
function manVal(r, k) {
  if (k === "saldo") return manHas(r, "obi") || manHas(r, "sped") ? manN(r, "obi") - manN(r, "sped") : null;
  if (k === "dins") return manHas(r, "obi") || manHas(r, "sped") || manHas(r, "insc") ? manN(r, "obi") - manN(r, "sped") - manN(r, "insc") : null;
  if (k === "fin") { const t = ["contr", "ingu", "scs", "scn", "scf"].reduce((s, x) => s + manN(r, x), 0); return t || null; }
  return manHas(r, k) ? manN(r, k) : null;
}
const manColTot = (rows, k) => rows.reduce((s, r) => s + (manVal(r, k) || 0), 0);
const manRowPairs = (r) => ["contr", "ingu", "scs", "scn", "scf", "dain", "dinc", "sfo", "suo", "sme", "cal", "mon", "car", "dac"].reduce((s, k) => s + manN(r, k), 0);

// Excel del giorno, stesso schema del modello. Saldo, Da inscatolare e Totale in finissaggio sono formule.
async function exportManoviaXlsx(day, draft) {
  const ExcelJS = (await import("exceljs")).default;
  const d = new Date(day + "T12:00:00");
  const giorno = d.toLocaleDateString("it-IT", { weekday: "long" });
  const dd = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(day.split("-").reverse().join("."), { views: [{ state: "frozen", xSplit: 1, zoomScale: 85 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const line = { style: "thin", color: { argb: "FF999999" } };
  const box = { top: line, left: line, bottom: line, right: line };
  const NC = MAN_COLS.length + 1;
  ws.mergeCells(1, 1, 1, NC);
  ws.getCell("A1").value = `${giorno.charAt(0).toUpperCase() + giorno.slice(1)} ${dd} (SITUAZIONE H. 17:30)`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(2, 1, 2, NC);
  ws.getCell("A2").value = `W ${String(week).padStart(2, "0")}`;
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  // stile come nel foglio di riferimento: titolo azzurro, bordi esterni medi, grigio sulle colonne calcolate
  const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const med = { style: "medium", color: { argb: "FF000000" } };
  const setB = (r, c, side, b) => { const cell = ws.getCell(r, c); cell.border = { ...(cell.border || {}), [side]: b }; };
  const outer = (r1, r2) => { for (let c = 1; c <= NC; c++) { setB(r1, c, "top", med); setB(r2, c, "bottom", med); } for (let r = r1; r <= r2; r++) { setB(r, 1, "left", med); setB(r, NC, "right", med); } };
  for (let c = 1; c <= NC; c++) { ws.getCell(1, c).fill = solid("FF8DB4E2"); ws.getCell(2, c).fill = solid("FF8DB4E2"); }
  ws.getRow(1).height = 18.75; ws.getRow(2).height = 22.5;
  outer(1, 2);
  const colL = (k) => ws.getColumn(MAN_COLS.findIndex((c) => c.k === k) + 2).letter;
  let rn = 3;
  MAN_SECS.forEach((sec, si) => {
    const rows = draft[sec.id] || [];
    if (si > 0) { rn += 1; ws.getRow(rn).height = 15.75; }
    const hdr = rn;
    ws.getCell(rn, 1).value = "Cliente";
    MAN_COLS.forEach((c, i) => { ws.getCell(rn, i + 2).value = sec.variant && c.l2 ? c.l2 : c.l; });
    for (let c = 1; c <= NC; c++) {
      const cell = ws.getCell(rn, c);
      const ci = c - 2;
      const small = ci >= 0 && ["cons", "obi", "saldo", "dins"].includes(MAN_COLS[ci].k);
      cell.font = { bold: true, size: small ? 8 : 11 };
      cell.fill = solid("FFDDE3F5");
      cell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
      cell.border = box;
    }
    ws.getRow(rn).height = 48;
    const first = rn + 1;
    rows.forEach((r, ri) => {
      rn++;
      ws.getRow(rn).height = 36.75;
      ws.getCell(rn, 1).value = r.nome || "";
      ws.getCell(rn, 1).font = { bold: true };
      ws.getCell(rn, 1).alignment = { vertical: "middle", wrapText: true };
      MAN_COLS.forEach((c, i) => {
        const cell = ws.getCell(rn, i + 2);
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (c.calc) cell.fill = solid("FFD9D9D9");
        if (c.text) { const tv = c.brand ? manBrand(sec.id, r) : r.cons; if (tv) cell.value = String(tv); return; }
        if (c.calc) {
          const v = manVal(r, c.k);
          if (c.k === "saldo" && v !== null) cell.value = { formula: `${colL("obi")}${rn}-${colL("sped")}${rn}`, result: v };
          if (c.k === "dins" && v !== null) cell.value = { formula: `${colL("obi")}${rn}-${colL("sped")}${rn}-${colL("insc")}${rn}`, result: v };
          if (c.k === "fin" && v !== null) cell.value = { formula: `SUM(${colL("contr")}${rn}:${colL("scf")}${rn})`, result: v };
          return;
        }
        const raw = String(r.q?.[c.k] ?? "").trim().replace(/^=/, "");
        if (!raw) return;
        cell.value = raw.includes("+") ? { formula: raw.replace(/\s+/g, ""), result: manSum(raw) } : manSum(raw);
      });
      for (let c = 1; c <= NC; c++) ws.getCell(rn, c).border = box;
      // doppia riga rossa tra un brand e il successivo
      if (ri > 0 && manBrandKey(sec.id, rows[ri - 1]) !== manBrandKey(sec.id, r)) {
        const red = { style: "double", color: { argb: "FFFF0000" } };
        for (let c = 1; c <= NC; c++) {
          ws.getCell(rn, c).border = { ...box, top: red };
          ws.getCell(rn - 1, c).border = { ...ws.getCell(rn - 1, c).border, bottom: red };
        }
      }
    });
    rn++;
    ws.getRow(rn).height = 15.75;
    ws.getCell(rn, 1).value = "TOTALI";
    for (let c = 1; c <= NC; c++) {
      const cell = ws.getCell(rn, c);
      cell.font = { bold: true };
      cell.border = box;
      cell.fill = solid("FFF2F2F2");
      if (c > 1) cell.alignment = { horizontal: "center" };
    }
    MAN_COLS.forEach((c, i) => {
      if (c.text || rows.length === 0) return;
      const L = ws.getColumn(i + 2).letter;
      ws.getCell(rn, i + 2).value = { formula: `SUM(${L}${first}:${L}${rn - 1})`, result: manColTot(rows, c.k) };
    });
    outer(hdr, rn);
    for (let c = 1; c <= NC; c++) { setB(hdr, c, "bottom", med); setB(first, c, "top", med); }
  });
  // larghezze prese dal foglio di riferimento (la colonna Brand in più è larga 16)
  const W = { brand: 16, cons: 9.3, obi: 9.1, sped: 8, saldo: 7.3, insc: 11, dins: 11.3, contr: 17.3, ingu: 17.3, scs: 19.1, scn: 19.3, scf: 11.7, fin: 11, dain: 11, dinc: 11, sfo: 15.6, suo: 11, sme: 13, cal: 12.6, mon: 12, car: 12.6, dac: 11 };
  ws.getColumn(1).width = 17.4;
  MAN_COLS.forEach((c, i) => { ws.getColumn(i + 2).width = W[c.k] || 11; });
  const buf = await wb.xlsx.writeBuffer();
  const filename = `manovia_${day}.xlsx`;
  const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const file = new File([buf], filename, { type, lastModified: Date.now() });
  const shareData = { files: [file], title: `Manovia ${dd}` };
  // Su telefono si apre il menu di condivisione (WhatsApp, mail…); su PC si scarica il file
  if (window.isSecureContext && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare(shareData)) {
    try { await navigator.share(shareData); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(new Blob([buf], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function ManoviaTab({ man, saveManDay, wide }) {
  const [day, setDay] = useState(() => todayStr());
  const [draft, setDraft] = useState({ art: [], cli: [] });
  const [dirty, setDirty] = useState(false);
  const [newName, setNewName] = useState({ art: "", cli: "" });
  const [err, setErr] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [exporting, setExporting] = useState(false);

  const node = man[day];
  const exists = node !== undefined;
  const savedAt = node?._meta?.savedAt || null;
  const savedDays = Object.keys(man).sort().reverse();
  const prevDay = savedDays.find((d) => d < day) || null;
  const prevNode = prevDay ? man[prevDay] : null;

  const toRows = (n) =>
    Object.entries(n || {})
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (a.o || 0) - (b.o || 0));
  // Giorno salvato → quello che c'è nel database. Giorno nuovo → elenco del giorno precedente
  // (con data di consegna e obiettivo), oppure l'elenco di partenza del modello.
  const buildBase = (keepQty) => {
    const out = {};
    MAN_SECS.forEach((sec) => {
      if (prevNode) {
        out[sec.id] = toRows(prevNode[sec.id]).map((r, i) => ({
          id: uid(), nome: r.nome, brand: manBrand(sec.id, r), cons: r.cons || "", o: i,
          q: keepQty ? { ...(r.q || {}) } : r.q?.obi ? { obi: r.q.obi } : {},
        }));
      } else {
        out[sec.id] = MAN_TEMPLATE[sec.id].map(([nome, brand], i) => ({ id: uid(), nome, brand, cons: "", o: i, q: {} }));
      }
    });
    return out;
  };
  const dbDraft = useMemo(
    () => (exists ? { art: toRows(node.art), cli: toRows(node.cli) } : buildBase(false)),
    [node, exists, prevNode, day]
  );

  useEffect(() => {
    if (!dirty) setDraft(dbDraft);
  }, [dbDraft, dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const touch = () => { setDirty(true); setSaveState("idle"); setErr(""); };
  const upd = (sec, id, fn) => { setDraft((p) => ({ ...p, [sec]: p[sec].map((r) => (r.id === id ? fn(r) : r)) })); touch(); };
  const setQ = (sec, id, k, v) => upd(sec, id, (r) => ({ ...r, q: { ...(r.q || {}), [k]: v } }));
  const setField = (sec, id, f, v) => upd(sec, id, (r) => ({ ...r, [f]: v }));
  const removeRow = (sec, id) => { setDraft((p) => ({ ...p, [sec]: p[sec].filter((r) => r.id !== id) })); touch(); };
  const moveRow = (sec, id, dir) => {
    setDraft((p) => {
      const a = [...p[sec]];
      const i = a.findIndex((r) => r.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= a.length) return p;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...p, [sec]: a };
    });
    touch();
  };
  // dove inserire la nuova riga: "end" (in fondo), "start" (in cima) oppure l'id della riga dopo cui metterla
  const [newPos, setNewPos] = useState({ art: "end", cli: "end" });
  const addRow = (sec) => {
    const nome = newName[sec].trim();
    if (!nome) return setErr("Scrivi il nome della nuova riga.");
    setDraft((p) => {
      const a = [...p[sec]];
      const row = { id: uid(), nome, brand: "", cons: "", o: 0, q: {} };
      const pos = newPos[sec];
      let at = a.length;
      if (pos === "start") at = 0;
      else if (pos !== "end") { const i = a.findIndex((r) => r.id === pos); if (i >= 0) { at = i + 1; row.brand = manBrand(sec, a[i]); } }
      a.splice(at, 0, row);
      return { ...p, [sec]: a };
    });
    setNewName((p) => ({ ...p, [sec]: "" }));
    setNewPos((p) => ({ ...p, [sec]: "end" }));
    touch();
  };

  const changeDay = (d) => {
    if (d === day) return;
    if (dirty && !window.confirm("Ci sono modifiche non salvate. Cambiando giorno andranno perse. Continuare?")) return;
    setDay(d); setDirty(false); setSaveState("idle"); setErr("");
  };
  const discard = () => {
    if (!window.confirm("Annullare le modifiche non salvate e tornare all'ultima versione salvata?")) return;
    setDirty(false); setDraft(dbDraft); setSaveState("idle"); setErr("");
  };
  const copyQty = () => {
    if (!prevNode) return;
    setDraft(buildBase(true));
    touch();
  };

  const doExport = async () => {
    setExporting(true);
    try { await exportManoviaXlsx(day, draft); }
    catch (e) { console.error(e); setErr("Export non riuscito: " + e.message); }
    finally { setExporting(false); }
  };
  const doSave = async () => {
    for (const sec of MAN_SECS) {
      for (const r of draft[sec.id]) {
        if (!r.nome.trim()) return setErr("C'è una riga senza nome.");
        const c = MAN_INPUTS.find((x) => Number.isNaN(manSum(r.q?.[x.k])));
        if (c) return setErr(`${r.nome} · «${c.l}»: scrivi un numero o una somma, es. 17+11.`);
      }
    }
    const clean = {};
    MAN_SECS.forEach((sec) => {
      clean[sec.id] = draft[sec.id].map((r, i) => {
        const q2 = {};
        MAN_INPUTS.forEach((c) => { const v = String(r.q?.[c.k] ?? "").trim().replace(/^=/, ""); if (v !== "") q2[c.k] = v.slice(0, 30); });
        return { ...r, brand: manBrand(sec.id, r).trim(), o: i, q: q2 };
      });
    });
    setErr(""); setSaveState("saving");
    try { await saveManDay(day, clean); setDirty(false); setSaveState("ok"); }
    catch (e) { console.error(e); setSaveState("err"); }
  };

  const label = (txt) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{txt}</div>
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
  const totalPairs = MAN_SECS[0] && draft.art.reduce((s, r) => s + manRowPairs(r), 0);
  const stickyBase = { position: "sticky", left: 0, zIndex: 1 };
  const cellB = { borderBottom: `1px solid ${BRD}`, borderRight: `1px solid ${BRD}` };
  const cellRed = { ...cellB, borderTop: `2px solid ${RED}` };

  // Frecce / Invio: ci si muove tra le caselle come in Excel (←/→ solo a inizio/fine testo)
  const navKey = (e) => {
    const t = e.target;
    const m = t.dataset && t.dataset.man;
    if (!m || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(k)) return;
    if (k === "ArrowLeft" && !(t.selectionStart === 0 && t.selectionEnd === 0)) return;
    if (k === "ArrowRight" && !(t.selectionStart === t.value.length && t.selectionEnd === t.value.length)) return;
    const [sid, ri, ci] = m.split(":");
    const r = Number(ri), c = Number(ci);
    const all = Array.from(e.currentTarget.querySelectorAll("input[data-man]")).map((el) => {
      const [, a, b] = el.dataset.man.split(":");
      return { el, r: Number(a), c: Number(b) };
    });
    let next = null;
    if (k === "ArrowUp" || k === "ArrowDown" || k === "Enter") {
      const tr = k === "ArrowUp" ? r - 1 : r + 1;
      const rowEls = all.filter((x) => x.r === tr);
      if (rowEls.length) next = rowEls.reduce((a, b) => (Math.abs(b.c - c) < Math.abs(a.c - c) ? b : a));
    } else {
      const rowEls = all.filter((x) => x.r === r).sort((a, b) => a.c - b.c);
      const i = rowEls.findIndex((x) => x.c === c);
      next = rowEls[k === "ArrowLeft" ? i - 1 : i + 1] || null;
    }
    e.preventDefault();
    if (k === "Enter") t.blur();
    if (next) { next.el.focus(); next.el.select(); }
  };

  const section = (sec) => {
    const rows = draft[sec.id] || [];
    return (
      <div key={sec.id} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{sec.title} · {rows.length} righe</div>
        <div onKeyDown={navKey} style={{ overflowX: "auto", background: S0, border: `1px solid ${BRD}`, borderRadius: 12 }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 13, minWidth: "max-content" }}>
            <thead>
              <tr>
                <th style={{ ...stickyBase, zIndex: 3, background: ML, minWidth: 150, textAlign: "left", padding: "8px 10px", fontSize: 11, color: T2, ...cellB }}>Cliente</th>
                {MAN_COLS.map((c) => (
                  <th key={c.k} style={{ background: c.calc ? S2 : ML, width: c.brand ? 132 : c.text ? (wide ? 84 : 92) : (wide ? 62 : 78), minWidth: c.brand ? 132 : c.text ? (wide ? 84 : 92) : (wide ? 62 : 78), padding: "8px 4px", fontSize: 10, lineHeight: 1.2, color: T2, textAlign: "center", ...cellB }}>{sec.variant && c.l2 ? c.l2 : c.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
              const cb = ri > 0 && manBrandKey(sec.id, rows[ri - 1]) !== manBrandKey(sec.id, r) ? cellRed : cellB;
              return (
                <tr key={r.id}>
                  <td style={{ ...stickyBase, background: S0, padding: "2px 6px 2px 4px", ...cb }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="text" data-man={`${sec.id}:${ri}:-1`} value={r.nome} maxLength={40} aria-label="Nome riga" onChange={(e) => setField(sec.id, r.id, "nome", e.target.value)}
                        style={{ flex: 1, minWidth: 0, width: 110, border: "none", background: "transparent", outline: "none", fontFamily: FONT, fontSize: 13, fontWeight: 700, color: TXT, padding: "11px 4px" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                        <button onClick={() => moveRow(sec.id, r.id, -1)} disabled={ri === 0} aria-label={`Sposta su ${r.nome}`} style={{ background: S2, color: T2, border: "none", borderRadius: 4, width: 22, height: 15, cursor: ri === 0 ? "default" : "pointer", fontSize: 9, lineHeight: 1, padding: 0, opacity: ri === 0 ? 0.35 : 1 }}>▲</button>
                        <button onClick={() => moveRow(sec.id, r.id, 1)} disabled={ri === rows.length - 1} aria-label={`Sposta giù ${r.nome}`} style={{ background: S2, color: T2, border: "none", borderRadius: 4, width: 22, height: 15, cursor: ri === rows.length - 1 ? "default" : "pointer", fontSize: 9, lineHeight: 1, padding: 0, opacity: ri === rows.length - 1 ? 0.35 : 1 }}>▼</button>
                      </div>
                      <button onClick={() => removeRow(sec.id, r.id)} aria-label={`Elimina ${r.nome}`} style={{ background: "#FEE2E2", color: RED, border: "none", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontSize: 11, flexShrink: 0 }}>🗑</button>
                    </div>
                  </td>
                  {MAN_COLS.map((c, ci) => {
                    if (c.calc) {
                      const v = manVal(r, c.k);
                      return <td key={c.k} style={{ background: S2, textAlign: "right", padding: "0 10px", fontFamily: MONO, fontSize: 14, fontWeight: 700, color: v ? TXT : T3, ...cb }}>{v === null ? "" : v}</td>;
                    }
                    if (c.text) {
                      const fld = c.brand ? "brand" : "cons";
                      return (
                        <td key={c.k} style={{ padding: 0, ...cb }}>
                          <input type="text" data-man={`${sec.id}:${ri}:${ci}`} value={c.brand ? manBrand(sec.id, r) : r.cons || ""} maxLength={c.brand ? 24 : 14} aria-label={`${r.nome} ${c.l}`} onChange={(e) => setField(sec.id, r.id, fld, e.target.value)} placeholder={c.brand ? "brand" : "gg/mm"}
                            style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", outline: "none", textAlign: "center", padding: "12px 4px", fontFamily: c.brand ? FONT : MONO, fontWeight: c.brand ? 700 : 400, fontSize: 13, color: TXT }} />
                        </td>
                      );
                    }
                    const v = r.q?.[c.k] ?? "";
                    const bad = Number.isNaN(manSum(v));
                    return (
                      <td key={c.k} style={{ padding: 0, background: bad ? "#FEE2E2" : "transparent", ...cb }}>
                        <input type="text" inputMode="text" data-man={`${sec.id}:${ri}:${ci}`} value={v} maxLength={30} aria-label={`${r.nome} ${sec.variant && c.l2 ? c.l2 : c.l}`} onChange={(e) => setQ(sec.id, r.id, c.k, e.target.value)}
                          onBlur={() => { const n = manSum(v); if (!Number.isNaN(n) && /[+=]/.test(String(v))) setQ(sec.id, r.id, c.k, n === 0 ? "" : String(n)); }}
                          style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", outline: "none", textAlign: "right", padding: "12px 8px", fontFamily: MONO, fontSize: 14, fontWeight: 700, color: bad ? RED : M }} />
                      </td>
                    );
                  })}
                </tr>
              );
              })}
              <tr>
                <td style={{ ...stickyBase, background: ML, padding: "9px 10px", fontWeight: 800, fontSize: 12, color: TXT, borderRight: `1px solid ${BRD}` }}>TOTALI</td>
                {MAN_COLS.map((c) => {
                  const tot = c.text ? "" : manColTot(rows, c.k);
                  return <td key={c.k} style={{ background: ML, textAlign: "right", padding: "9px 8px", fontFamily: MONO, fontWeight: 800, fontSize: 14, color: tot ? M : T3, borderRight: `1px solid ${BRD}` }}>{tot}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input type="text" value={newName[sec.id]} maxLength={40} onChange={(e) => setNewName((p) => ({ ...p, [sec.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addRow(sec.id); }}
            placeholder={sec.addLabel} style={{ ...inputStyle, flex: "1 1 160px", width: "auto", padding: "10px 12px" }} />
          <select value={newPos[sec.id]} onChange={(e) => setNewPos((p) => ({ ...p, [sec.id]: e.target.value }))} aria-label="Posizione nuova riga" style={{ ...inputStyle, flex: "1 1 150px", width: "auto", padding: "10px 8px", fontSize: 13 }}>
            <option value="end">In fondo</option>
            <option value="start">In cima</option>
            {rows.map((r) => <option key={r.id} value={r.id}>Dopo {r.nome}</option>)}
          </select>
          <button onClick={() => addRow(sec.id)} style={{ background: M, color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", minHeight: 44, fontFamily: FONT, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>+ Riga</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: FONT, padding: "14px 14px", paddingBottom: 32 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: TXT, marginBottom: 4 }}>Manovia · situazione ore 17:30</div>
      <div style={{ fontSize: 12, color: T2, marginBottom: 14 }}>Le righe sono già impostate come nel modello: scrivi le quantità nelle celle (puoi usare somme come 17+11), poi premi «Salva». Le colonne grigie si calcolano da sole.</div>

      <div style={{ marginBottom: 14 }}>
        {label("Giorno")}
        <input type="date" value={day} onChange={(e) => e.target.value && changeDay(e.target.value)} style={{ ...inputStyle, fontFamily: MONO, fontWeight: 700 }} />
      </div>

      {!exists && (
        <div style={{ background: ACL, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TXT }}>
            {prevDay ? `Giorno nuovo: elenco, date di consegna e obiettivi sono quelli del ${fmtD(prevDay)}.` : "Primo giorno: elenco di partenza dal modello Excel."}
          </div>
          {prevDay && <Btn color={BG} textColor={ACC} style={{ marginTop: 8 }} onClick={copyQty}>Copia anche le quantità del {fmtD(prevDay)}</Btn>}
        </div>
      )}

      {MAN_SECS.map(section)}

      <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 6 }}>Paia in lavorazione (tabella articoli): {totalPairs}</div>
      {err && <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 8 }}>{err}</div>}

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, background: status.bg, color: status.color, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color }} />
        {status.text}
      </div>
      <Btn color={canSave ? ACC : BRD} textColor={canSave ? "#fff" : T3} style={{ marginTop: 10, padding: 16, fontSize: 15, cursor: canSave ? "pointer" : "default" }} onClick={() => { if (canSave && saveState !== "saving") doSave(); }}>
        {saveState === "saving" ? "Salvataggio…" : canSave ? "Salva situazione" : "Situazione salvata"}
      </Btn>
      {dirty && <Btn color={BG} textColor={T2} style={{ marginTop: 8 }} onClick={discard}>Annulla modifiche</Btn>}
      {saveState === "err" && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: RED }}>Non salvata: controlla la connessione e riprova.</div>}
      <Btn color={GRN} style={{ marginTop: 8, padding: 15, fontSize: 15 }} onClick={() => { if (!exporting) doExport(); }}>
        {exporting ? "Preparazione file…" : `📊 Esporta Excel · ${fmtD(day)}`}
      </Btn>

      {savedDays.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Giorni già salvati</div>
          <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 12 }}>
            {savedDays.slice(0, 10).map((d, i) => {
              const n = man[d] || {};
              const rs = toRows(n.art);
              return (
                <button key={d} onClick={() => changeDay(d)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 44, padding: "0 14px", background: d === day ? ML : "none", border: "none", borderTop: i ? `1px solid ${BRD}` : "none", cursor: "pointer", fontFamily: FONT, fontSize: 14, color: TXT }}>
                  <span>{fmtD(d)}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, color: M }}>{rs.reduce((s, r) => s + manRowPairs(r), 0)} paia</span>
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
function SettingsTab({ wide, stations, goals, saveGoal }) {
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

      <div style={wide ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, alignItems: "start" } : undefined}>
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RIENTRI — produzione affidata ad altri calzaturifici
   Database: rientri/{ordineId} = { lab, brand, linea, art, col, smin, smax,
     ord:{s39:44,…}, rows:{ rid:{ ddt, data, q:{s39:17,…}, ft, ftd, ftp, o } }, ts }
   Un "ordine" è un articolo + colore di un laboratorio, con la sua curva taglie.
   ═══════════════════════════════════════════════════════════════ */
const rieKey = (s) => `s${String(s).replace(/[.#$\/\[\]\s]/g, "_")}`;
// taglie dell'ordine: elenco esplicito (o.sizes, es. XS/S/M/L o con mezze misure) oppure intervallo smin–smax (passo 1 o 0,5)
const rieSizes = (o) => {
  if (o.sizes) return Array.isArray(o.sizes) ? o.sizes : Object.values(o.sizes);
  const a = []; const st = o.half ? 0.5 : 1;
  for (let s = +o.smin; s <= +o.smax; s += st) a.push(s);
  return a;
};
const rieRows = (o) => Object.entries(o.rows || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.o || 0) - (b.o || 0));
const rieOrd = (o, s) => +(o.ord?.[rieKey(s)]) || 0;
// consegnate nette: rientri registrati meno le paia rimandate al laboratorio (i rientri dei resi rientrano come righe DDT)
const rieDel = (o, s) => rieRows(o).reduce((t, r) => t + (+(r.q?.[rieKey(s)]) || 0), 0) - rieResi(o).reduce((t, r) => t + (+(r.q?.[rieKey(s)]) || 0), 0);
// xt = paia del rientro registrate solo come totale, senza dettaglio per taglia
const rieRowTot = (o, r) => rieSizes(o).reduce((t, s) => t + (+(r.q?.[rieKey(s)]) || 0), 0) + (+r.xt || 0);
const rieOrdTot = (o) => rieSizes(o).reduce((t, s) => t + rieOrd(o, s), 0);
const rieDelTot = (o) => rieSizes(o).reduce((t, s) => t + rieDel(o, s), 0) + rieRows(o).reduce((t, r) => t + (+r.xt || 0), 0) - rieResi(o).reduce((t, r) => t + (+r.xt || 0), 0);
const rieCmp = (a, b) => [a.lab, a.brand, a.linea, a.art, a.col].join("\u0001").localeCompare([b.lab, b.brand, b.linea, b.art, b.col].join("\u0001"), "it", { numeric: true, sensitivity: "base" });
const rieFarDate = () => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); };
const rieSet = (path, v) => set(ref(db, `rientri/${path}`), v === undefined || v === "" ? null : v);

// Casella: accetta somme (+5+5, =17+11) come nella Manovia; Invio/frecce per spostarsi
function RCell({ value, onCommit, kind = "num", g, bold, warn, width, align, pad, fs, bg, fg, fmt }) {
  const [v, setV] = useState(null);
  const base = value === undefined || value === null ? "" : String(value);
  const shown = v === null ? (fmt && base !== "" ? fmt(base) : base) : v;
  const commit = () => {
    if (v === null) return;
    const raw = v; setV(null);
    if (kind === "dec") {
      const t = raw.trim().replace(",", ".");
      if (t !== "" && !/^\d+(\.\d+)?$/.test(t)) return;
      const nv = t === "" || +t === 0 ? null : +t;
      if (nv === (base === "" ? null : +base.replace(",", "."))) return;
      onCommit(nv);
    } else if (kind === "num") {
      const n = manSum(raw);
      if (Number.isNaN(n)) return;
      const nv = n === 0 ? null : n;
      if (nv === (base === "" ? null : +base)) return;
      onCommit(nv);
    } else {
      const t = raw.trim();
      if (t === base) return;
      onCommit(t === "" ? null : t);
    }
  };
  return (
    <input
      type={kind === "date" ? "date" : "text"} inputMode={kind === "num" ? "text" : undefined}
      value={shown} data-g={g} size={pad ? 1 : undefined}
      onFocus={(e) => { if (v === null) setV(base); if (kind !== "date") e.target.select(); }}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      style={{ width: width || "100%", boxSizing: "border-box", border: "none", background: bg || (warn ? ACL : "transparent"), outline: "none", fontFamily: kind === "num" || kind === "dec" ? MONO : FONT, fontSize: fs || 13, fontWeight: bold ? 800 : 600, color: fg || (warn ? ACC : kind === "num" || kind === "dec" ? M : TXT), textAlign: align || (kind === "num" || kind === "dec" ? "right" : "left"), padding: pad || "8px 6px", minWidth: 0 }}
    />
  );
}

function rieNav(e) {
  const t = e.target, m = t.dataset && t.dataset.g;
  if (!m || e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(k)) return;
  if (t.type === "date" && (k === "ArrowUp" || k === "ArrowDown")) return;
  if (k === "ArrowLeft" && t.type !== "date" && !(t.selectionStart === 0 && t.selectionEnd === 0)) return;
  if (k === "ArrowRight" && t.type !== "date" && !(t.selectionStart === t.value.length && t.selectionEnd === t.value.length)) return;
  const [r, c] = m.split(":").map(Number);
  const all = Array.from(e.currentTarget.querySelectorAll("input[data-g]")).map((el) => { const [a, b] = el.dataset.g.split(":").map(Number); return { el, r: a, c: b }; });
  let next = null;
  if (k === "ArrowLeft" || k === "ArrowRight") {
    const row = all.filter((x) => x.r === r).sort((a, b) => a.c - b.c);
    const i = row.findIndex((x) => x.c === c);
    next = row[k === "ArrowLeft" ? i - 1 : i + 1] || null;
  } else {
    const row = all.filter((x) => x.r === (k === "ArrowUp" ? r - 1 : r + 1));
    if (row.length) next = row.reduce((a, b) => (Math.abs(b.c - c) < Math.abs(a.c - c) ? b : a));
  }
  e.preventDefault();
  if (k === "Enter" || (!next && (k === "ArrowUp" || k === "ArrowDown"))) t.blur();
  if (next) { next.el.focus(); if (next.el.type !== "date") next.el.select(); }
}

// Resi: paia che Mosaicon rimanda al laboratorio (DDT Mosaicon) e che il laboratorio restituisce con il proprio DDT (rdd)
const rieResi = (o) => Object.entries(o.resi || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.o || 0) - (b.o || 0));
const rieResoTot = (o, r) => rieSizes(o).reduce((t, s) => t + (+(r.q?.[rieKey(s)]) || 0), 0) + (+r.xt || 0);
// paia già rientrate: con rdd e senza dettaglio (qr) = tutto il reso; con qr = le paia registrate
const rieResoBack = (o, r) => !String(r.rdd || "").trim() ? 0 : r.qr ? rieSizes(o).reduce((t, s) => t + (+(r.qr?.[rieKey(s)]) || 0), 0) : rieResoTot(o, r);
const rieResoOpen = (o) => rieResi(o).reduce((t, r) => t + Math.max(0, rieResoTot(o, r) - rieResoBack(o, r)), 0);
// paia ancora fuori per taglia (dopo i rientri già registrati)
const rieResoRem = (o, r) => { const m = {}; rieSizes(o).forEach((s) => { const k = rieKey(s); const sent = +(r.q?.[k]) || 0; const back = !String(r.rdd || "").trim() ? 0 : r.qr ? (+(r.qr?.[k]) || 0) : sent; m[s] = Math.max(0, sent - back); }); return m; };
// ricerca DDT / FT: uguale, oppure (da 3 caratteri) contenuto
const rieMatch = (val, q) => { const v = String(val ?? "").trim().toUpperCase(), t = q.trim().toUpperCase(); return !!t && !!v && (v === t || (t.length >= 3 && v.includes(t))); };

function RieBlock({ oid, o, edit, onEdit, onAddDdt, onAddReso, onRientra, allEntries, ddtQ, ftQ }) {
  const sizes = rieSizes(o);
  const rows = rieRows(o);
  const ordT = rieOrdTot(o), delT = rieDelTot(o), res = ordT - delT;
  const far = rieFarDate();
  const th = { padding: "7px 6px", fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.04em", textAlign: "center", borderBottom: `1px solid ${BRD}`, borderRight: `1px solid ${BRD}`, background: S1, whiteSpace: "nowrap" };
  const td = { borderBottom: `1px solid ${BRD}`, borderRight: `1px solid ${BRD}`, padding: 0 };
  const resi = rieResi(o);
  const resoOpen = rieResoOpen(o);
  const tag = res === 0 ? { t: "completo", c: GRN, b: "#E3F8EF" } : res < 0 ? { t: `in eccesso ${-res} paia`, c: RED, b: "#FDECEC" } : { t: `residuo ${res} paia`, c: ACC, b: ACL };
  const delRow = (r) => {
    if (!window.confirm(`Eliminare il rientro ${r.ddt || ""}?`)) return;
    rieSet(`${oid}/rows/${r.id}`, null);
  };
  const setField = (k, raw, required) => {
    const v = String(raw).trim().replace(/\s+/g, " ").toUpperCase();
    if (v === (o[k] || "")) return;
    if (required && !v) { window.alert("Questo campo non può restare vuoto."); return; }
    const n = { ...o, [k]: v };
    if (allEntries.some(([id, x]) => id !== oid && x.lab === n.lab && x.brand === n.brand && x.linea === n.linea && x.art === n.art && (x.col || "") === (n.col || ""))) { window.alert("Esiste già un articolo con questi dati nella stessa linea."); return; }
    rieSet(`${oid}/${k}`, v);
  };
  const delOrder = () => {
    if (rows.length) { window.alert("Ci sono già dei rientri registrati: eliminali prima di eliminare l'ordine."); return; }
    if (!window.confirm(`Eliminare l'ordine ${o.art} ${o.col}?`)) return;
    rieSet(oid, null);
  };
  return (
    <div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", background: ML, borderBottom: `2px solid ${M}` }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: TXT }}>{o.art}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: T2 }}>{o.col}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: tag.c, background: tag.b, borderRadius: 20, padding: "3px 10px" }}>{tag.t}</span>
        {resoOpen > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#B45309", background: "#FEF3C7", borderRadius: 20, padding: "3px 10px" }}>resi fuori {resoOpen} paia</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => onAddReso(oid)} style={{ background: S0, color: "#B45309", border: "1px solid #E9B949", borderRadius: 10, padding: "7px 12px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>↩ Reso</button>
        <button onClick={() => onAddDdt(oid)} style={{ background: M, color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Rientro</button>
        <button onClick={() => onEdit(edit ? null : oid)} style={{ background: edit ? ACL : S0, color: edit ? ACC : T2, border: `1px solid ${edit ? ACC : BRD2}`, borderRadius: 10, padding: "7px 12px", fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{edit ? "Fine modifica" : "✎ Ordine"}</button>
      </div>
      {edit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 14px", background: ACL, borderBottom: `1px solid ${BRD}` }}>
          {[["lab", "Laboratorio", true], ["brand", "Brand", true], ["linea", "Linea / stagione", true], ["art", "Articolo", true], ["col", "Colore", false]].map(([k, l, req]) => (
            <label key={k} style={{ flex: "1 1 130px", minWidth: 120 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
              <RCell kind="text" value={o[k] || ""} onCommit={(v) => setField(k, v ?? "", req)} bold align="left" />
            </label>
          ))}
        </div>
      )}
      <div onKeyDown={rieNav} style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", minWidth: 90 }}>DDT / riga</th>
              <th style={{ ...th, minWidth: 118 }}>DATA</th>
              {sizes.map((s) => <th key={s} style={{ ...th, minWidth: 54 }}>{s}</th>)}
              <th style={{ ...th, minWidth: 62 }}>TOT</th>
              <th style={{ ...th, minWidth: 84 }}>FT LAV</th>
              <th style={{ ...th, minWidth: 118 }}>DATA FT</th>
              <th style={{ ...th, minWidth: 66 }}>PAIA FT</th>
              <th style={{ ...th, minWidth: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: S1 }}>
              <td style={{ ...td, padding: "8px 8px", fontWeight: 900, fontSize: 12, color: TXT }}>ORDINE</td>
              <td style={td}></td>
              {sizes.map((s, i) => (
                <td key={s} style={td}>
                  {edit ? <RCell g={`0:${i}`} value={rieOrd(o, s) || ""} onCommit={(v) => rieSet(`${oid}/ord/${rieKey(s)}`, v)} bold />
                    : <div style={{ padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 800, color: T2 }}>{rieOrd(o, s) || ""}</div>}
                </td>
              ))}
              <td style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 900, color: TXT }}>{ordT}</td>
              <td style={td} colSpan={4}>{edit && <button onClick={delOrder} style={{ background: "none", border: "none", color: RED, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: "8px 10px" }}>Elimina ordine</button>}</td>
            </tr>
            {rows.map((r, ri) => {
              const tot = rieRowTot(o, r);
              const ftp = r.ftp ? +r.ftp : null;
              const hit = (ddtQ && rieMatch(r.ddt, ddtQ)) || (ftQ && rieMatch(r.ft, ftQ));
              return (
                <tr key={r.id} style={hit ? { background: "#FFF6CC" } : undefined}>
                  <td style={td}><RCell kind="text" g={`${ri + 1}:-2`} value={r.ddt} onCommit={(v) => rieSet(`${oid}/rows/${r.id}/ddt`, v)} bold /></td>
                  <td style={td}><RCell kind="date" g={`${ri + 1}:-1`} value={r.data} warn={r.data > far} onCommit={(v) => rieSet(`${oid}/rows/${r.id}/data`, v)} /></td>
                  {sizes.map((s, i) => (
                    <td key={s} style={td}><RCell g={`${ri + 1}:${i}`} value={r.q?.[rieKey(s)]} onCommit={(v) => rieSet(`${oid}/rows/${r.id}/q/${rieKey(s)}`, v)} warn={rieDel(o, s) > rieOrd(o, s)} /></td>
                  ))}
                  <td title={r.xt ? `di cui ${r.xt} paia senza dettaglio per taglia` : undefined} style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 900, color: TXT }}>{tot}{r.xt ? "*" : ""}</td>
                  <td style={td}><RCell kind="text" g={`${ri + 1}:${sizes.length}`} value={r.ft} onCommit={(v) => rieSet(`${oid}/rows/${r.id}/ft`, v)} /></td>
                  <td style={td}><RCell kind="date" g={`${ri + 1}:${sizes.length + 1}`} value={r.ftd} warn={r.ftd > far} onCommit={(v) => rieSet(`${oid}/rows/${r.id}/ftd`, v)} /></td>
                  <td style={td}><RCell g={`${ri + 1}:${sizes.length + 2}`} value={r.ftp} warn={ftp !== null && ftp !== tot} onCommit={(v) => rieSet(`${oid}/rows/${r.id}/ftp`, v)} /></td>
                  <td style={{ ...td, textAlign: "center" }}><button title="Elimina rientro" onClick={() => delRow(r)} style={{ background: "none", border: "none", color: T3, fontSize: 16, cursor: "pointer", padding: "6px 8px" }}>×</button></td>
                </tr>
              );
            })}
            {resi.length > 0 && (
              <tr style={{ background: "#FFF8E6" }}>
                <td style={{ ...td, padding: "8px 8px", fontWeight: 900, fontSize: 12, color: "#B45309" }}>− RESI AL LAB.</td>
                <td style={td}></td>
                {sizes.map((s) => { const x = resi.reduce((t, r) => t + (+(r.q?.[rieKey(s)]) || 0), 0); return <td key={s} style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 800, color: x ? "#B45309" : T3 }}>{x ? -x : ""}</td>; })}
                <td style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 900, color: "#B45309" }}>{-resi.reduce((t, r) => t + rieResoTot(o, r), 0)}</td>
                <td style={td} colSpan={4}></td>
              </tr>
            )}
            <tr style={{ background: res < 0 ? "#FDECEC" : EL }}>
              <td style={{ ...td, padding: "8px 8px", fontWeight: 900, fontSize: 12, color: res < 0 ? RED : E }}>DA CONSEGNARE</td>
              <td style={td}></td>
              {sizes.map((s) => { const x = rieOrd(o, s) - rieDel(o, s); return <td key={s} style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 800, color: x < 0 ? RED : x > 0 ? TXT : T3 }}>{x}</td>; })}
              <td style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 900, color: res < 0 ? RED : TXT }}>{res}</td>
              <td style={td} colSpan={4}></td>
            </tr>
          </tbody>
        </table>
      </div>
      {resi.length > 0 && (
        <div onKeyDown={rieNav} style={{ overflowX: "auto", borderTop: `2px solid #E9B949`, background: "#FFFDF5" }}>
          <div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 800, color: "#B45309", letterSpacing: "0.08em", textTransform: "uppercase" }}>Resi al laboratorio · {resi.length} {resi.length === 1 ? "riga" : "righe"}</div>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", minWidth: 110 }}>DDT MOSAICON</th>
                <th style={{ ...th, minWidth: 118 }}>DATA</th>
                {sizes.map((s) => <th key={s} style={{ ...th, minWidth: 54 }}>{s}</th>)}
                <th style={{ ...th, minWidth: 62 }}>TOT</th>
                <th style={{ ...th, minWidth: 110 }}>RIENTRATO CON DDT</th>
                <th style={{ ...th, minWidth: 118 }}>DATA RIENTRO</th>
                <th style={{ ...th, minWidth: 90 }}>STATO</th>
                <th style={{ ...th, minWidth: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {resi.map((r, ri) => {
                const t = rieResoTot(o, r);
                const backN = rieResoBack(o, r);
                const back = backN >= t && t > 0;
                const hit = (ddtQ && (rieMatch(r.ddt, ddtQ) || rieMatch(r.rdd, ddtQ)));
                return (
                  <tr key={r.id} style={hit ? { background: "#FFF6CC" } : undefined}>
                    <td style={td}><RCell kind="text" g={`${ri}:-2`} value={r.ddt} onCommit={(v) => rieSet(`${oid}/resi/${r.id}/ddt`, v)} bold /></td>
                    <td style={td}><RCell kind="date" g={`${ri}:-1`} value={r.data} onCommit={(v) => rieSet(`${oid}/resi/${r.id}/data`, v)} /></td>
                    {sizes.map((sz, i) => (
                      <td key={sz} style={td}><RCell g={`${ri}:${i}`} value={r.q?.[rieKey(sz)]} onCommit={(v) => rieSet(`${oid}/resi/${r.id}/q/${rieKey(sz)}`, v)} /></td>
                    ))}
                    <td title={r.xt ? `di cui ${r.xt} paia senza dettaglio per taglia` : undefined} style={{ ...td, padding: "8px 6px", textAlign: "right", fontFamily: MONO, fontWeight: 900, color: TXT }}>{t}{r.xt ? "*" : ""}</td>
                    <td style={{ ...td, padding: "8px 8px", fontWeight: 800, fontSize: 13 }}>{r.rdd || ""}</td>
                    <td style={{ ...td, padding: "8px 8px", fontFamily: MONO, fontSize: 13 }}>{r.rdata ? fmtD(r.rdata) : ""}</td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      {back
                        ? <span style={{ fontSize: 11, fontWeight: 800, color: GRN, background: "#E3F8EF", borderRadius: 20, padding: "3px 9px" }}>rientrato</span>
                        : <button onClick={() => onRientra(oid, r.id)} title="Registra il rientro di queste paia" style={{ background: "#B45309", color: "#fff", border: "none", borderRadius: 10, padding: "5px 10px", fontFamily: FONT, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>{backN > 0 ? `Rientra · mancano ${t - backN}` : "↩ Rientra"}</button>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}><button title="Elimina reso" onClick={() => { if (window.confirm(`Eliminare il reso ${r.ddt || ""}?`)) rieSet(`${oid}/resi/${r.id}`, null); }} style={{ background: "none", border: "none", color: T3, fontSize: 16, cursor: "pointer", padding: "6px 8px" }}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const RIE_INP = { width: "100%", boxSizing: "border-box", background: S0, border: `1.5px solid ${BRD2}`, borderRadius: 12, padding: "11px 12px", fontFamily: FONT, fontSize: 15, color: TXT, outline: "none" };
const rieLbl = (t) => <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase", margin: "10px 0 4px" }}>{t}</div>;

// griglia di quantità per taglia (accetta somme)
function RieQtyGrid({ sizes, vals, setVals, limit }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8 }}>
      {sizes.map((s) => {
        const n = manSum(vals[s]);
        const bad = Number.isNaN(n);
        const over = !bad && limit && n > (limit[s] ?? Infinity);
        return (
          <div key={s}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T2, textAlign: "center", marginBottom: 2 }}>{s}</div>
            <input type="text" inputMode="text" value={vals[s] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [s]: e.target.value }))}
              onBlur={() => { const x = manSum(vals[s]); if (!Number.isNaN(x)) setVals((p) => ({ ...p, [s]: x ? String(x) : "" })); }}
              style={{ ...RIE_INP, padding: "9px 4px", textAlign: "center", fontFamily: MONO, fontWeight: 700, borderColor: bad ? RED : over ? ACC : BRD2, background: over ? ACL : S0 }} />
          </div>
        );
      })}
    </div>
  );
}
const rieVals = (vals, sizes) => { const q = {}; for (const s of sizes) { const n = manSum(vals[s]); if (!Number.isNaN(n) && n > 0) q[rieKey(s)] = n; } return q; };
const rieBad = (vals, sizes) => sizes.some((s) => Number.isNaN(manSum(vals[s])));

function RieOrdModal({ list, defaults, onClose }) {
  const [f, setF] = useState({ lab: defaults.lab || "", brand: defaults.brand || "", linea: defaults.linea || "", art: "", col: "", smin: "39", smax: "46", half: false, custom: "" });
  const [vals, setVals] = useState({});
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const smin = parseInt(f.smin, 10), smax = parseInt(f.smax, 10);
  const okRange = Number.isInteger(smin) && Number.isInteger(smax) && smin >= 20 && smax <= 60 && smin <= smax && smax - smin <= 20;
  const customList = f.custom.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  const useCustom = customList.length > 0;
  const sizes = useCustom ? customList : okRange ? rieSizes({ smin, smax, half: f.half }) : [];
  const opts = (k) => Array.from(new Set(list.map((o) => o[k]))).sort();
  const norm = (s) => s.trim().replace(/\s+/g, " ");
  const save = (again) => {
    const lab = norm(f.lab).toUpperCase(), brand = norm(f.brand).toUpperCase(), linea = norm(f.linea).toUpperCase(), art = norm(f.art).toUpperCase(), col = norm(f.col).toUpperCase();
    if (!lab || !brand || !linea || !art || !col) { setErr("Compila laboratorio, brand, linea, articolo e colore."); return; }
    if (!useCustom && !okRange) { setErr("Curva taglie non valida (es. da 39 a 46)."); return; }
    if (useCustom && new Set(customList).size !== customList.length) { setErr("Nelle taglie personalizzate c'è un duplicato."); return; }
    if (rieBad(vals, sizes)) { setErr("Una quantità non è valida: usa numeri o somme come 17+11."); return; }
    const ord = rieVals(vals, sizes);
    if (!Object.keys(ord).length) { setErr("Inserisci almeno una quantità ordinata."); return; }
    if (list.some((o) => o.lab === lab && o.brand === brand && o.linea === linea && o.art === art && o.col === col)) { setErr("Questo articolo e colore esistono già in questa linea."); return; }
    set(ref(db, `rientri/${uid()}${uid()}`), useCustom ? { lab, brand, linea, art, col, sizes: customList, ord, ts: Date.now() } : { lab, brand, linea, art, col, smin, smax, ...(f.half ? { half: true } : {}), ord, ts: Date.now() });
    if (again) { setDone(`${art} ${col} salvato. Inserisci il colore successivo.`); setF((p) => ({ ...p, lab, brand, linea, art, col: "" })); setVals({}); setErr(""); }
    else onClose();
  };
  const field = (k, label, listId) => (<div style={{ flex: 1, minWidth: 150 }}>{rieLbl(label)}<input list={listId} value={f[k]} maxLength={40} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} style={RIE_INP} /></div>);
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "78vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Nuovo ordine</div>
        <div style={{ fontSize: 12, color: T2 }}>Un articolo e un colore affidati a un laboratorio. I laboratori, brand e linee nuovi si creano scrivendoli.</div>
        <datalist id="rie-lab">{opts("lab").map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="rie-brand">{opts("brand").map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="rie-linea">{opts("linea").map((x) => <option key={x} value={x} />)}</datalist>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{field("lab", "Laboratorio", "rie-lab")}{field("brand", "Brand", "rie-brand")}{field("linea", "Stagione / linea", "rie-linea")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{field("art", "Articolo")}{field("col", "Colore")}
          <div style={{ width: 80 }}>{rieLbl("Da taglia")}<input value={f.smin} inputMode="numeric" onChange={(e) => setF((p) => ({ ...p, smin: e.target.value }))} style={{ ...RIE_INP, textAlign: "center", fontFamily: MONO }} /></div>
          <div style={{ width: 80 }}>{rieLbl("A taglia")}<input value={f.smax} inputMode="numeric" onChange={(e) => setF((p) => ({ ...p, smax: e.target.value }))} style={{ ...RIE_INP, textAlign: "center", fontFamily: MONO }} /></div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T2, cursor: "pointer", marginTop: 10 }}><input type="checkbox" checked={f.half} onChange={(e) => setF((p) => ({ ...p, half: e.target.checked }))} />Con mezze misure (39,5…)</label>
          <div style={{ flex: 1, minWidth: 200 }}>{rieLbl("Oppure taglie a lettere (es. XS S M L)")}<input value={f.custom} onChange={(e) => setF((p) => ({ ...p, custom: e.target.value }))} placeholder="lascia vuoto per usare i numeri" style={RIE_INP} /></div>
        </div>
        {rieLbl("Paia ordinate per taglia")}
        <RieQtyGrid sizes={sizes} vals={vals} setVals={setVals} />
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: TXT, marginTop: 8 }}>Totale: {sizes.reduce((t, s) => t + (manSum(vals[s]) || 0), 0)}</div>
        {done && <div style={{ fontSize: 13, fontWeight: 700, color: GRN, marginTop: 8 }}>{done}</div>}
        {err && <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Btn style={{ flex: 1, minWidth: 130 }} onClick={() => save(false)}>Salva ordine</Btn>
          <Btn color={BG} textColor={M} style={{ flex: 1, minWidth: 190 }} onClick={() => save(true)}>Salva e aggiungi altro colore</Btn>
          <Btn color={BG} textColor={T2} style={{ width: "auto", padding: "13px 18px" }} onClick={onClose}>Chiudi</Btn>
        </div>
      </div>
    </Modal>
  );
}

function RieDdtModal({ entries, startId, onClose }) {
  const [oid, setOid] = useState(startId || entries[0]?.[0] || "");
  const [ddt, setDdt] = useState("");
  const [data, setData] = useState(todayStr());
  const [ft, setFt] = useState(""); const [ftd, setFtd] = useState(""); const [ftp, setFtp] = useState("");
  const [vals, setVals] = useState({});
  const [err, setErr] = useState("");
  const o = (entries.find(([id]) => id === oid) || [])[1];
  const sizes = o ? rieSizes(o) : [];
  const limit = {}; if (o) sizes.forEach((s) => { limit[s] = rieOrd(o, s) - rieDel(o, s); });
  const over = sizes.filter((s) => (manSum(vals[s]) || 0) > limit[s]);
  const save = () => {
    if (!o) { setErr("Scegli l'articolo."); return; }
    if (!ddt.trim()) { setErr("Scrivi il numero del DDT."); return; }
    if (rieBad(vals, sizes)) { setErr("Una quantità non è valida."); return; }
    const q = rieVals(vals, sizes);
    if (!Object.keys(q).length) { setErr("Inserisci almeno una quantità."); return; }
    const row = { ddt: ddt.trim().slice(0, 20), data, q, o: Date.now() };
    if (ft.trim()) row.ft = ft.trim().slice(0, 20);
    if (ftd) row.ftd = ftd;
    const p = manSum(ftp); if (!Number.isNaN(p) && p > 0) row.ftp = p;
    rieSet(`${oid}/rows/${uid()}${uid()}`, row);
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "78vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Nuovo rientro</div>
        {rieLbl("Articolo")}
        <select value={oid} onChange={(e) => { setOid(e.target.value); setVals({}); }} style={RIE_INP}>
          {entries.map(([id, x]) => <option key={id} value={id}>{x.lab} · {x.brand} · {x.linea} · {x.art} {x.col}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>{rieLbl("DDT n.")}<input value={ddt} maxLength={20} onChange={(e) => setDdt(e.target.value)} style={{ ...RIE_INP, fontFamily: MONO, fontWeight: 700 }} /></div>
          <div style={{ flex: 1, minWidth: 150 }}>{rieLbl("Data")}<input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...RIE_INP, fontFamily: MONO }} /></div>
        </div>
        {rieLbl("Paia rientrate per taglia")}
        <RieQtyGrid sizes={sizes} vals={vals} setVals={setVals} limit={limit} />
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: TXT, marginTop: 8 }}>Totale: {sizes.reduce((t, s) => t + (manSum(vals[s]) || 0), 0)}</div>
        {over.length > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: ACC, marginTop: 6 }}>Attenzione: taglia {over.join(", ")} supera le paia ancora da consegnare. Controlla il DDT (puoi salvare lo stesso).</div>}
        {rieLbl("Fattura di lavorazione (facoltativo, si può compilare dopo)")}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input placeholder="FT n." value={ft} maxLength={20} onChange={(e) => setFt(e.target.value)} style={{ ...RIE_INP, flex: 1, minWidth: 100, fontFamily: MONO }} />
          <input type="date" value={ftd} onChange={(e) => setFtd(e.target.value)} style={{ ...RIE_INP, flex: 1, minWidth: 150, fontFamily: MONO }} />
          <input placeholder="Paia" value={ftp} onChange={(e) => setFtp(e.target.value)} style={{ ...RIE_INP, width: 90, fontFamily: MONO, textAlign: "center" }} />
        </div>
        {err && <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn style={{ flex: 1 }} onClick={save}>Salva rientro</Btn>
          <Btn color={BG} textColor={T2} style={{ width: "auto", padding: "13px 18px" }} onClick={onClose}>Annulla</Btn>
        </div>
      </div>
    </Modal>
  );
}

function RieResoModal({ entries, startId, onClose }) {
  const [oid, setOid] = useState(startId || entries[0]?.[0] || "");
  const [ddt, setDdt] = useState(""); const [data, setData] = useState(todayStr());
  const [rdd, setRdd] = useState(""); const [rdata, setRdata] = useState("");
  const [vals, setVals] = useState({}); const [err, setErr] = useState("");
  const o = (entries.find(([id]) => id === oid) || [])[1];
  const sizes = o ? rieSizes(o) : [];
  const save = () => {
    if (!o) { setErr("Scegli l'articolo."); return; }
    if (!ddt.trim()) { setErr("Scrivi il numero del DDT Mosaicon del reso."); return; }
    if (rieBad(vals, sizes)) { setErr("Una quantità non è valida."); return; }
    const q = rieVals(vals, sizes);
    if (!Object.keys(q).length) { setErr("Inserisci almeno una quantità."); return; }
    const row = { ddt: ddt.trim().slice(0, 24), data, q, o: Date.now() };
    if (rdd.trim()) row.rdd = rdd.trim().slice(0, 24);
    if (rdata) row.rdata = rdata;
    const rid = uid() + uid();
    if (row.rdd) { row.qr = q; rieSet(`${oid}/rows/${uid()}${uid()}`, { ddt: row.rdd, data: row.rdata || row.data, q, o: Date.now() + 1, fromReso: rid }); }
    rieSet(`${oid}/resi/${rid}`, row);
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "78vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Nuovo reso al laboratorio</div>
        <div style={{ fontSize: 12, color: T2 }}>Paia che Mosaicon rimanda al laboratorio (da rifare o riparare): vengono tolte dalle consegnate dell'articolo. Quando tornano, premi «Rientra» e rientrano da sole nella tabella con il DDT del laboratorio.</div>
        {rieLbl("Articolo")}
        <select value={oid} onChange={(e) => { setOid(e.target.value); setVals({}); }} style={RIE_INP}>
          {entries.map(([id, x]) => <option key={id} value={id}>{x.lab} · {x.brand} · {x.linea} · {x.art} {x.col}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>{rieLbl("DDT Mosaicon n.")}<input value={ddt} maxLength={24} placeholder="es. 3/3970" onChange={(e) => setDdt(e.target.value)} style={{ ...RIE_INP, fontFamily: MONO, fontWeight: 700 }} /></div>
          <div style={{ flex: 1, minWidth: 150 }}>{rieLbl("Data")}<input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...RIE_INP, fontFamily: MONO }} /></div>
        </div>
        {rieLbl("Paia rese per taglia")}
        <RieQtyGrid sizes={sizes} vals={vals} setVals={setVals} />
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: TXT, marginTop: 8 }}>Totale: {sizes.reduce((t, x) => t + (manSum(vals[x]) || 0), 0)}</div>
        {rieLbl("Già rientrate? (facoltativo, si compila anche dopo)")}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input placeholder="DDT del laboratorio" value={rdd} maxLength={24} onChange={(e) => setRdd(e.target.value)} style={{ ...RIE_INP, flex: 1, minWidth: 150, fontFamily: MONO }} />
          <input type="date" value={rdata} onChange={(e) => setRdata(e.target.value)} style={{ ...RIE_INP, flex: 1, minWidth: 150, fontFamily: MONO }} />
        </div>
        {err && <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn style={{ flex: 1 }} onClick={save}>Salva reso</Btn>
          <Btn color={BG} textColor={T2} style={{ width: "auto", padding: "13px 18px" }} onClick={onClose}>Annulla</Btn>
        </div>
      </div>
    </Modal>
  );
}

// Rientro (anche parziale) di un reso: il laboratorio riconsegna le paia con il proprio DDT
function RieRientraModal({ oid, o, rid, onClose }) {
  const r = o && o.resi && o.resi[rid] ? { id: rid, ...o.resi[rid] } : null;
  const sizes = o ? rieSizes(o) : [];
  const rem = r ? rieResoRem(o, r) : {};
  const [vals, setVals] = useState(() => { const v = {}; sizes.forEach((s) => { if (rem[s]) v[s] = String(rem[s]); }); return v; });
  const [rdd, setRdd] = useState(""); const [rdata, setRdata] = useState(todayStr()); const [err, setErr] = useState("");
  if (!r) return null;
  const over = sizes.filter((s) => (manSum(vals[s]) || 0) > rem[s]);
  const save = () => {
    if (!rdd.trim()) { setErr("Scrivi il DDT con cui il laboratorio ha riconsegnato."); return; }
    if (rieBad(vals, sizes)) { setErr("Una quantità non è valida."); return; }
    const add = rieVals(vals, sizes);
    if (!Object.keys(add).length) { setErr("Inserisci almeno una quantità rientrata."); return; }
    const had = String(r.rdd || "").trim();
    const prev = {}; sizes.forEach((s) => { const k = rieKey(s); prev[k] = had ? (r.qr ? (+(r.qr[k]) || 0) : (+(r.q?.[k]) || 0)) : 0; });
    const qr = {}; sizes.forEach((s) => { const k = rieKey(s); const n = prev[k] + (add[k] || 0); if (n) qr[k] = n; });
    const nd = rdd.trim().slice(0, 24);
    rieSet(`${oid}/rows/${uid()}${uid()}`, { ddt: nd, data: rdata || todayStr(), q: add, o: Date.now(), fromReso: rid });
    rieSet(`${oid}/resi/${rid}/qr`, qr);
    rieSet(`${oid}/resi/${rid}/rdd`, had && !had.split(",").map((x) => x.trim()).includes(nd) ? `${had}, ${nd}` : had || nd);
    if (rdata) rieSet(`${oid}/resi/${rid}/rdata`, rdata);
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "78vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Rientro del reso</div>
        <div style={{ fontSize: 13, color: T2 }}>{o.art} {o.col} · reso DDT Mosaicon <b>{r.ddt}</b>{r.data ? ` del ${fmtD(r.data)}` : ""}</div>
        {rieLbl("Paia rientrate per taglia (già compilate con quelle ancora fuori)")}
        <RieQtyGrid sizes={sizes} vals={vals} setVals={setVals} limit={rem} />
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: TXT, marginTop: 8 }}>Rientrate ora: {sizes.reduce((t, x) => t + (manSum(vals[x]) || 0), 0)} · ancora fuori prima del rientro: {sizes.reduce((t, x) => t + rem[x], 0)}</div>
        {over.length > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: ACC, marginTop: 6 }}>Attenzione: taglia {over.join(", ")} supera le paia ancora fuori (puoi salvare lo stesso).</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150 }}>{rieLbl("DDT del laboratorio")}<input value={rdd} maxLength={24} onChange={(e) => setRdd(e.target.value)} style={{ ...RIE_INP, fontFamily: MONO, fontWeight: 700 }} /></div>
          <div style={{ flex: 1, minWidth: 150 }}>{rieLbl("Data rientro")}<input type="date" value={rdata} onChange={(e) => setRdata(e.target.value)} style={{ ...RIE_INP, fontFamily: MONO }} /></div>
        </div>
        {err && <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn color={GRN} style={{ flex: 1 }} onClick={save}>Registra il rientro</Btn>
          <Btn color={BG} textColor={T2} style={{ width: "auto", padding: "13px 18px" }} onClick={onClose}>Annulla</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* Incolla da DDT: testo preparato da Claude a partire dalla scansione.
   Formato:  DDT 951 27/10/2026
             MS261-1503 | 126 TAN | 39=0 40=1 41=1 43=5 44=4 */
function rieParse(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = { ddt: "", data: "", items: [], errors: [] };
  for (const l of lines) {
    const h = l.match(/^DDT\s*[:n.°]*\s*(\S+)\s+(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/i);
    if (h) { const y = h[4].length === 2 ? "20" + h[4] : h[4]; out.ddt = h[1]; out.data = `${y}-${h[3].padStart(2, "0")}-${h[2].padStart(2, "0")}`; continue; }
    const p = l.split("|").map((x) => x.trim());
    if (p.length >= 3) {
      const q = {}; let m; const re = /([A-Za-z0-9][A-Za-z0-9.,]*)\s*=\s*(\d+)/g;
      while ((m = re.exec(p[2]))) q[m[1].replace(",", ".").toUpperCase()] = +m[2];
      if (Object.keys(q).length) { out.items.push({ art: p[0].toUpperCase(), col: p[1].toUpperCase(), q }); continue; }
    }
    out.errors.push(l);
  }
  return out;
}
function RiePasteModal({ entries, onClose }) {
  const [txt, setTxt] = useState("");
  const [res, setRes] = useState(null);
  const [lab, setLab] = useState("");
  const labs = Array.from(new Set(entries.map(([, o]) => o.lab))).sort();
  const read = () => {
    const p = rieParse(txt);
    const pool = entries.filter(([, o]) => !lab || o.lab === lab);
    p.items = p.items.map((it) => {
      const hit = pool.filter(([, o]) => o.art === it.art && o.col === it.col);
      const found = hit.length === 1 ? hit[0] : null;
      const over = found ? Object.entries(it.q).filter(([s, n]) => { const x = rieSizes(found[1]).find((z) => String(z).toUpperCase() === s); return x !== undefined && n > rieOrd(found[1], x) - rieDel(found[1], x); }).map(([s]) => s) : [];
      const outside = found ? Object.keys(it.q).filter((s) => !rieSizes(found[1]).some((x) => String(x).toUpperCase() === s)) : [];
      return { ...it, found, amb: hit.length > 1, over, outside };
    });
    setRes(p);
  };
  const ok = res && res.ddt && res.data && res.items.some((i) => i.found && !i.outside.length);
  const confirm = () => {
    res.items.forEach((it) => {
      if (!it.found || it.outside.length) return;
      const q = {}; Object.entries(it.q).forEach(([s, n]) => { const x = rieSizes(it.found[1]).find((z) => String(z).toUpperCase() === s); if (n > 0 && x !== undefined) q[rieKey(x)] = n; });
      rieSet(`${it.found[0]}/rows/${uid()}${uid()}`, { ddt: res.ddt, data: res.data, q, o: Date.now() });
    });
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "78vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Incolla da DDT</div>
        <div style={{ fontSize: 12, color: T2, marginBottom: 6 }}>Incolla il testo ricevuto da Claude dopo la scansione del DDT. Prima di salvare vedi cosa è stato riconosciuto.</div>
        {rieLbl("Laboratorio del DDT (aiuta a trovare l'articolo giusto)")}
        <select value={lab} onChange={(e) => setLab(e.target.value)} style={RIE_INP}><option value="">Tutti</option>{labs.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setRes(null); }} rows={6} placeholder={"DDT 951 27/10/2026\nMS261-1503 | 126 TAN | 39=0 40=1 41=1 43=5 44=4"} style={{ ...RIE_INP, marginTop: 10, fontFamily: MONO, fontSize: 13, resize: "vertical" }} />
        {!res && <Btn style={{ marginTop: 10 }} onClick={read}>Leggi</Btn>}
        {res && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: res.ddt && res.data ? TXT : RED }}>{res.ddt && res.data ? `DDT ${res.ddt} del ${fmtD(res.data)}` : "Manca la riga «DDT numero data»."}</div>
            {res.items.map((it, i) => (
              <div key={i} style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: it.found && !it.outside.length ? EL : "#FDECEC", fontSize: 13 }}>
                <b>{it.art} {it.col}</b> · {Object.values(it.q).reduce((a, b) => a + b, 0)} paia
                {it.found ? <span style={{ color: T2 }}> → {it.found[1].lab} · {it.found[1].linea}</span> : <span style={{ color: RED, fontWeight: 700 }}> — {it.amb ? "più ordini corrispondono: scegli il laboratorio" : "ordine non trovato: crea prima l'ordine"}</span>}
                {it.outside.length > 0 && <div style={{ color: RED, fontWeight: 700 }}>Taglie fuori curva: {it.outside.join(", ")}</div>}
                {it.over.length > 0 && <div style={{ color: ACC, fontWeight: 700 }}>Taglie oltre il residuo: {it.over.join(", ")}</div>}
              </div>
            ))}
            {res.errors.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>Righe non lette: {res.errors.join(" · ")}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn color={ok ? GRN : BRD} textColor={ok ? "#fff" : T3} style={{ flex: 1 }} onClick={() => ok && confirm()}>Conferma e aggiungi ai rientri</Btn>
              <Btn color={BG} textColor={T2} style={{ width: "auto", padding: "13px 18px" }} onClick={() => setRes(null)}>Modifica testo</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Excel con lo stesso schema dei file del collega: un foglio per linea, blocchi Articolo/Colore/DDT/DATA/taglie/ORDINE/CONSEGNATE/FT LAV
async function exportRientriXlsx(entries, title) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const groups = {};
  entries.forEach(([, o]) => { (groups[`${o.brand} ${o.linea}`] ||= []).push(o); });
  const colL = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const thin = { style: "thin", color: { argb: "FFBBBBBB" } };
  const used = new Set();
  Object.keys(groups).sort().forEach((gname) => {
    let nm = gname.replace(/[\\/?*[\]:]/g, " ").slice(0, 31); let k = 2;
    while (used.has(nm)) nm = nm.slice(0, 28) + " " + k++;
    used.add(nm);
    const ws = wb.addWorksheet(nm);
    let r = 1;
    groups[gname].sort(rieCmp).forEach((o) => {
      const sizes = rieSizes(o), n = sizes.length;
      const cOrd = 5 + n, cCons = cOrd + 1, cFt = cCons + 1;
      const head = ["Articolo", "Colore", "DDT", "DATA", ...sizes, "ORDINE", "CONSEGNATE", "FT LAV", "DATA", "PAIA"];
      head.forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = { bold: true }; c.alignment = { horizontal: "center" }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF0FF" } }; c.border = { top: thin, bottom: thin, left: thin, right: thin }; });
      const ordRow = r + 1;
      ws.getCell(ordRow, 1).value = o.art; ws.getCell(ordRow, 2).value = o.col;
      sizes.forEach((s, i) => { ws.getCell(ordRow, 5 + i).value = rieOrd(o, s) || null; });
      ws.getCell(ordRow, cOrd).value = { formula: `SUM(${colL(5)}${ordRow}:${colL(4 + n)}${ordRow})`, result: rieOrdTot(o) };
      ws.getRow(ordRow).font = { bold: true };
      const rows = rieRows(o);
      rows.forEach((x, i) => {
        const rr = ordRow + 1 + i;
        ws.getCell(rr, 3).value = isNaN(+x.ddt) ? x.ddt : +x.ddt;
        if (x.data) { ws.getCell(rr, 4).value = new Date(x.data + "T12:00:00"); ws.getCell(rr, 4).numFmt = "dd/mm/yy"; }
        sizes.forEach((s, j) => { ws.getCell(rr, 5 + j).value = +(x.q?.[rieKey(s)]) || null; });
        ws.getCell(rr, cCons).value = { formula: `SUM(${colL(5)}${rr}:${colL(4 + n)}${rr})${x.xt ? `+${+x.xt}` : ""}`, result: rieRowTot(o, x) };
        if (x.ft) ws.getCell(rr, cFt).value = isNaN(+x.ft) ? x.ft : +x.ft;
        if (x.ftd) { ws.getCell(rr, cFt + 1).value = new Date(x.ftd + "T12:00:00"); ws.getCell(rr, cFt + 1).numFmt = "dd/mm/yy"; }
        if (x.ftp) ws.getCell(rr, cFt + 2).value = +x.ftp;
      });
      const last = ordRow + rows.length, resRow = last + 1;
      ws.getCell(resRow, 3).value = "DA CONSEGNARE";
      sizes.forEach((s, j) => { const L = colL(5 + j); const rs = rieResi(o).reduce((t, x) => t + (+(x.q?.[rieKey(s)]) || 0), 0); ws.getCell(resRow, 5 + j).value = { formula: `${L}${ordRow}-SUM(${L}${ordRow + 1}:${L}${Math.max(last, ordRow + 1)})${rs ? `+${rs}` : ""}`, result: rieOrd(o, s) - rieDel(o, s) }; });
      { const rt = rieResi(o).reduce((t, x) => t + rieResoTot(o, x), 0); ws.getCell(resRow, cOrd).value = { formula: `${colL(cOrd)}${ordRow}-SUM(${colL(cCons)}${ordRow + 1}:${colL(cCons)}${Math.max(last, ordRow + 1)})${rt ? `+${rt}` : ""}`, result: rieOrdTot(o) - rieDelTot(o) }; }
      ws.getRow(resRow).font = { bold: true, color: { argb: "FF00796B" } };
      for (let rr = ordRow; rr <= resRow; rr++) for (let c = 1; c <= cFt + 2; c++) ws.getCell(rr, c).border = { top: thin, bottom: thin, left: thin, right: thin };
      r = resRow + 2;
      const resiR = rieResi(o);
      if (resiR.length) {
        const rh = ["RESI", "Colore", "DDT MOSAICON", "DATA", ...sizes, "TOTALE", "RIENTRATO CON DDT", "DATA RIENTRO"];
        rh.forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFB45309" } }; c.alignment = { horizontal: "center" }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } }; c.border = { top: thin, bottom: thin, left: thin, right: thin }; });
        resiR.forEach((x, i) => {
          const rr = r + 1 + i;
          ws.getCell(rr, 1).value = o.art; ws.getCell(rr, 2).value = o.col;
          ws.getCell(rr, 3).value = isNaN(+x.ddt) ? x.ddt : +x.ddt;
          if (x.data) { ws.getCell(rr, 4).value = new Date(x.data + "T12:00:00"); ws.getCell(rr, 4).numFmt = "dd/mm/yy"; }
          sizes.forEach((s, j) => { ws.getCell(rr, 5 + j).value = +(x.q?.[rieKey(s)]) || null; });
          ws.getCell(rr, 5 + n).value = { formula: `SUM(${colL(5)}${rr}:${colL(4 + n)}${rr})${x.xt ? `+${+x.xt}` : ""}`, result: rieResoTot(o, x) };
          if (x.rdd) ws.getCell(rr, 6 + n).value = isNaN(+x.rdd) ? x.rdd : +x.rdd;
          if (x.rdata) { ws.getCell(rr, 7 + n).value = new Date(x.rdata + "T12:00:00"); ws.getCell(rr, 7 + n).numFmt = "dd/mm/yy"; }
          for (let c = 1; c <= 7 + n; c++) ws.getCell(rr, c).border = { top: thin, bottom: thin, left: thin, right: thin };
        });
        r = r + resiR.length + 2;
      }
    });
    ws.getColumn(1).width = 16; ws.getColumn(2).width = 18; ws.getColumn(3).width = 14; ws.getColumn(4).width = 11;
    for (let c = 5; c <= 20; c++) ws.getColumn(c).width = 9;
  });
  const buf = await wb.xlsx.writeBuffer();
  const filename = `rientri_${title.replace(/[^A-Za-z0-9]+/g, "_")}_${todayStr()}.xlsx`;
  const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const url = URL.createObjectURL(new Blob([buf], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function RientriTab({ rie, wide }) {
  const [view, setView] = useState("ord");
  const [fLab, setFLab] = useState(""); const [fBrand, setFBrand] = useState(""); const [fLinea, setFLinea] = useState("");
  const [fArt, setFArt] = useState(""); const [fQ, setFQ] = useState("");
  const [ddtQ, setDdtQ] = useState(""); const [ftQ, setFtQ] = useState("");
  const [onlyRes, setOnlyRes] = useState(false);
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const all = useMemo(() => Object.entries(rie || {}).filter(([, o]) => o && o.art).sort((a, b) => rieCmp(a[1], b[1])), [rie]);
  const uniq = (arr) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b, "it"));
  const labs = uniq(all.map(([, o]) => o.lab));
  const brands = uniq(all.filter(([, o]) => !fLab || o.lab === fLab).map(([, o]) => o.brand));
  const lines = uniq(all.filter(([, o]) => (!fLab || o.lab === fLab) && (!fBrand || o.brand === fBrand)).map(([, o]) => o.linea));
  const inScope = (o) => (!fLab || o.lab === fLab) && (!fBrand || o.brand === fBrand) && (!fLinea || o.linea === fLinea);
  const arts = uniq(all.filter(([, o]) => inScope(o)).map(([, o]) => o.art));
  const q = fQ.trim().toUpperCase();
  const shown = all.filter(([, o]) => inScope(o) && (!fArt || o.art === fArt) && (!q || `${o.art} ${o.col}`.toUpperCase().includes(q)) && (!ddtQ.trim() || rieRows(o).some((r) => rieMatch(r.ddt, ddtQ)) || rieResi(o).some((r) => rieMatch(r.ddt, ddtQ) || rieMatch(r.rdd, ddtQ))) && (!ftQ.trim() || rieRows(o).some((r) => rieMatch(r.ft, ftQ))) && (!onlyRes || rieOrdTot(o) !== rieDelTot(o)));
  const ordT = shown.reduce((t, [, o]) => t + rieOrdTot(o), 0), delT = shown.reduce((t, [, o]) => t + rieDelTot(o), 0);
  const pct = ordT ? Math.round((delT / ordT) * 100) : 0;
  const sel = { ...RIE_INP, width: "auto", minWidth: 140, padding: "9px 12px", fontWeight: 700, fontSize: 14 };
  const kpi = (l, v, c) => (<div style={{ background: S0, border: `1px solid ${BRD}`, borderRadius: 14, padding: "10px 14px" }}><div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.1em", textTransform: "uppercase" }}>{l}</div><div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: c || TXT }}>{v}</div></div>);
  const tabBtn = (id, l) => (<button onClick={() => setView(id)} style={{ background: view === id ? M : S0, color: view === id ? "#fff" : M, border: `1.5px solid ${M}`, borderRadius: 12, padding: "9px 14px", fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{l}</button>);
  const actBtn = (l, c, tc, fn, bd) => (<button onClick={fn} style={{ background: c, color: tc, border: bd ? `1.5px solid ${M}` : "none", borderRadius: 12, padding: "10px 14px", fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{l}</button>);
  const renameLinea = () => {
    const nuova = (window.prompt(`Nuovo nome per la linea «${fLinea}»${fLab ? ` (${fLab}${fBrand ? " · " + fBrand : ""})` : ""}:`, fLinea) || "").trim().replace(/\s+/g, " ").toUpperCase();
    if (!nuova || nuova === fLinea) return;
    const target = all.filter(([, o]) => o.linea === fLinea && (!fLab || o.lab === fLab) && (!fBrand || o.brand === fBrand));
    const clash = target.find(([id, o]) => all.some(([id2, x]) => !target.some(([t]) => t === id2) && x.lab === o.lab && x.brand === o.brand && x.linea === nuova && x.art === o.art && (x.col || "") === (o.col || "")));
    if (clash) { window.alert(`Non posso rinominare: ${clash[1].art} ${clash[1].col} esiste già nella linea «${nuova}».`); return; }
    if (!window.confirm(`Rinominare la linea in «${nuova}» per ${target.length} articoli?`)) return;
    target.forEach(([id]) => rieSet(`${id}/linea`, nuova));
    setFLinea(nuova);
  };
  const doExport = async () => { setBusy(true); try { await exportRientriXlsx(shown, [fLab || "tutti", fBrand].filter(Boolean).join("_")); } catch (e) { console.error(e); window.alert("Export non riuscito: " + e.message); } finally { setBusy(false); } };

  // riepilogo per laboratorio / brand / linea
  const groups = {};
  all.forEach(([, o]) => {
    const k = [o.lab, o.brand, o.linea].join("|");
    const g = (groups[k] ||= { lab: o.lab, brand: o.brand, linea: o.linea, ord: 0, del: 0, last: "", far: false, neg: false, resi: 0 });
    g.resi += rieResoOpen(o); g.ord += rieOrdTot(o); g.del += rieDelTot(o);
    if (rieOrdTot(o) < rieDelTot(o)) g.neg = true;
    rieRows(o).forEach((r) => { if (r.data && r.data > g.last && r.data <= rieFarDate()) g.last = r.data; if ((r.data && r.data > rieFarDate()) || (r.ftd && r.ftd > rieFarDate())) g.far = true; });
  });
  const gl = Object.values(groups).sort((a, b) => [a.lab, a.brand, a.linea].join().localeCompare([b.lab, b.brand, b.linea].join(), "it"));
  const alerts = [];
  gl.forEach((g) => { if (g.far) alerts.push(`${g.lab} · ${g.brand} · ${g.linea}: c'è una data molto avanti nel tempo (probabile errore di battitura).`); if (g.neg) alerts.push(`${g.lab} · ${g.brand} · ${g.linea}: consegnate più paia di quelle ordinate su almeno un articolo.`); });

  let prevHead = "";
  return (
    <div style={{ fontFamily: FONT, padding: "14px 14px", paddingBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Rientri dai laboratori</div>
          <div style={{ fontSize: 12, color: T2 }}>Ordini affidati ai calzaturifici esterni, DDT di rientro e fatture di lavorazione. Le caselle accettano somme (17+11) e ci si muove con le frecce.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>{tabBtn("ord", "Ordini e rientri")}{tabBtn("riep", "Riepilogo")}</div>
      </div>

      {view === "ord" && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <select value={fLab} onChange={(e) => { setFLab(e.target.value); setFBrand(""); setFLinea(""); setFArt(""); }} style={sel}><option value="">Tutti i laboratori</option>{labs.map((x) => <option key={x}>{x}</option>)}</select>
            <select value={fBrand} onChange={(e) => { setFBrand(e.target.value); setFLinea(""); setFArt(""); }} style={sel}><option value="">Tutti i brand</option>{brands.map((x) => <option key={x}>{x}</option>)}</select>
            <select value={fLinea} onChange={(e) => { setFLinea(e.target.value); setFArt(""); }} style={sel}><option value="">Tutte le linee</option>{lines.map((x) => <option key={x}>{x}</option>)}</select>
            <select value={fArt} onChange={(e) => setFArt(e.target.value)} style={sel}><option value="">Tutti gli articoli</option>{arts.map((x) => <option key={x}>{x}</option>)}</select>
            <input type="search" value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="Cerca articolo o colore…" style={{ ...sel, minWidth: 190, fontWeight: 600 }} />
            <input type="search" value={ddtQ} onChange={(e) => setDdtQ(e.target.value)} placeholder="Cerca DDT…" style={{ ...sel, minWidth: 130, width: 130, fontWeight: 600 }} />
            <input type="search" value={ftQ} onChange={(e) => setFtQ(e.target.value)} placeholder="Cerca FT LAV…" style={{ ...sel, minWidth: 160, width: 160, fontWeight: 600 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T2, cursor: "pointer" }}><input type="checkbox" checked={onlyRes} onChange={(e) => setOnlyRes(e.target.checked)} />Solo da consegnare</label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {actBtn("＋ Nuovo ordine", M, "#fff", () => setModal({ k: "ord" }))}
            {actBtn("＋ Nuovo rientro", S0, M, () => all.length ? setModal({ k: "ddt" }) : window.alert("Crea prima un ordine."), true)}
            {actBtn("↩ Nuovo reso", S0, "#B45309", () => all.length ? setModal({ k: "reso" }) : window.alert("Crea prima un ordine."), true)}
            {actBtn("📋 Incolla da DDT", S0, M, () => all.length ? setModal({ k: "paste" }) : window.alert("Crea prima un ordine."), true)}
            {fLinea && actBtn("✎ Rinomina linea", S0, T2, renameLinea, true)}
            {actBtn(busy ? "Preparo…" : "📊 Esporta Excel", GRN, "#fff", () => shown.length && !busy && doExport())}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
            {kpi("Ordinate", ordT)}{kpi("Consegnate", delT)}{kpi("Residuo", ordT - delT, ordT - delT > 0 ? ACC : ordT - delT < 0 ? RED : GRN)}{kpi("Evasione", pct + "%")}
          </div>
          {shown.length === 0 && (
            <div style={{ background: S0, border: `1px dashed ${BRD2}`, borderRadius: 14, padding: 24, textAlign: "center", color: T2, fontSize: 14 }}>
              {all.length ? "Nessun articolo con questi filtri." : "Ancora nessun ordine. Premi «＋ Nuovo ordine» per inserire il primo."}
            </div>
          )}
          {shown.map(([id, o]) => {
            const head = `${o.lab} · ${o.brand} · ${o.linea}`;
            const showHead = head !== prevHead; prevHead = head;
            return (
              <Fragment key={id}>
                {showHead && <div style={{ fontSize: 11, fontWeight: 800, color: T2, letterSpacing: "0.1em", textTransform: "uppercase", margin: "6px 2px 8px" }}>{head}</div>}
                <RieBlock oid={id} o={o} edit={editId === id} onEdit={setEditId} allEntries={all} ddtQ={ddtQ} ftQ={ftQ} onAddDdt={(x) => setModal({ k: "ddt", id: x })} onAddReso={(x) => setModal({ k: "reso", id: x })} onRientra={(x, rid) => setModal({ k: "rientra", id: x, rid })} />
              </Fragment>
            );
          })}
        </>
      )}

      {view === "riep" && (
        <>
          <div style={{ overflowX: "auto", background: S0, border: `1px solid ${BRD}`, borderRadius: 14 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720, fontSize: 13 }}>
              <thead><tr style={{ background: ML }}>{["Laboratorio", "Brand", "Linea", "Ordinate", "Consegnate", "Residuo", "Evasione", "Resi fuori", "Ultimo rientro"].map((h, i) => <th key={h} style={{ padding: "9px 10px", fontSize: 11, color: T2, textAlign: i > 2 ? "right" : "left", borderBottom: `2px solid ${M}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {gl.map((g) => { const res = g.ord - g.del, p = g.ord ? Math.round((g.del / g.ord) * 100) : 0; return (
                  <tr key={[g.lab, g.brand, g.linea].join("|")} style={{ borderBottom: `1px solid ${BRD}` }}>
                    <td style={{ padding: "9px 10px", fontWeight: 800 }}>{g.lab}</td><td style={{ padding: "9px 10px" }}>{g.brand}</td><td style={{ padding: "9px 10px" }}>{g.linea}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO }}>{g.ord}</td><td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO }}>{g.del}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO, fontWeight: 800, color: res > 0 ? ACC : res < 0 ? RED : GRN }}>{res}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO }}>{p}%</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO, fontWeight: g.resi ? 800 : 400, color: g.resi ? "#B45309" : T3 }}>{g.resi || "—"}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO }}>{g.last ? fmtD(g.last) : "—"}</td>
                  </tr>); })}
                {gl.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: T2 }}>Nessun dato.</td></tr>}
              </tbody>
            </table>
          </div>
          {alerts.length > 0 && <div style={{ marginTop: 12, background: ACL, border: `1px solid ${ACC}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: TXT }}>{alerts.map((a, i) => <div key={i}>⚠ {a}</div>)}</div>}
        </>
      )}

      {modal?.k === "ord" && <RieOrdModal list={all.map(([, o]) => o)} defaults={{ lab: fLab, brand: fBrand, linea: fLinea }} onClose={() => setModal(null)} />}
      {modal?.k === "ddt" && <RieDdtModal entries={all} startId={modal.id} onClose={() => setModal(null)} />}
      {modal?.k === "rientra" && <RieRientraModal oid={modal.id} o={rie[modal.id]} rid={modal.rid} onClose={() => setModal(null)} />}
      {modal?.k === "reso" && <RieResoModal entries={all} startId={modal.id} onClose={() => setModal(null)} />}
      {modal?.k === "paste" && <RiePasteModal entries={all} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PIANO — pianificazione settimanale della produzione (tutti i calzaturifici)
   Nodi: piano/righe/{id}, piano/meta, piano/cfg, pianoVers/{vid} (indice), pianoVersRighe/{vid} (righe della versione)
   ═══════════════════════════════════════════════════════════════ */
const PI_ORD = ["MOS", "EMOS", "STIL3", "MACB", "MICM", "CINA"];
const PI_NAMES = { MOS: "MOS · Mosaicon", EMOS: "EMOS", STIL3: "STIL3", MACB: "MACB · Macbarens", MICM: "MICM · Micmar", CINA: "CINA" };
const PI_DAYS = { "2026-42": 4, "2026-50": 4, "2026-52": 3, "2026-53": 3, "2027-01": 4 }; // giorni lavorativi diversi da 5 (come nel foglio)
const PI_MESI = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
const PI_MAT = [["pe", "PE"], ["fo", "FO"], ["so", "SO"], ["su", "SU"], ["ta", "TA"], ["fm", "Tot. forme"]];
const piMonday = (key) => {
  const [y, w] = key.split("-").map(Number);
  const j4 = new Date(Date.UTC(y, 0, 4)), dow = j4.getUTCDay() || 7;
  const m = new Date(j4); m.setUTCDate(j4.getUTCDate() - dow + 1 + (w - 1) * 7);
  return m;
};
const piKey = (d) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-${String(w).padStart(2, "0")}`;
};
const piToday = () => { const n = new Date(); return piKey(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))); };
const piAdd = (key, n) => { const m = piMonday(key); m.setUTCDate(m.getUTCDate() + 7 * n); return piKey(m); };
const piIdx = (key) => Math.round(piMonday(key).getTime() / (7 * 864e5));
const piWeek = (key) => {
  const m = piMonday(key), f = new Date(m); f.setUTCDate(m.getUTCDate() + 4);
  const p2 = (n) => String(n).padStart(2, "0");
  return { k: key, n: "S" + key.slice(5), cal: `${p2(m.getUTCDate())}-${p2(f.getUTCDate())}`, month: PI_MESI[new Date(m.getTime() + 3 * 864e5).getUTCMonth()], days: PI_DAYS[key] || 5 };
};
const piPn = (r, k) => +(r.w && r.w[k]) || 0;
const piPlanTot = (r) => Object.values(r.w || {}).reduce((a, b) => a + (+b || 0), 0);
const piSaldo = (r) => (+r.q || 0) - (+r.sp || 0) - (+r.g || 0);
const piFmtN = (n) => String(n).replace(".", ",");
const piEur = (x) => "€ " + Math.round(x).toLocaleString("it-IT");
const piK = (x) => (x ? (Math.round(x / 100) / 10).toLocaleString("it-IT") + "k" : "");
const piRowKey = (r) => [r.b, r.c, r.a, r.k, r.bl, r.r].map((x) => String(x || "").trim().toUpperCase()).join("|");
// settimana media (pesata sulle paia) del piano di una riga
const piMass = (r) => { const e = Object.entries(r.w || {}).filter(([, v]) => +v > 0); const t = e.reduce((s, [, v]) => s + +v, 0); return t ? e.reduce((s, [k, v]) => s + piIdx(k) * +v, 0) / t : null; };
// stato di un materiale: ok / na / soon (atteso prima dell'inizio del piano) / late (dopo) / miss (manca)
function piMatStat(v, j, firstKey) {
  const t = String(v ?? "").trim().toUpperCase();
  if (j === 5) return t === "" ? "miss" : "ok";
  if (t === "") return "miss";
  if (t === "OK") return "ok";
  if (t === "/") return "na";
  const nn = (t.match(/\d+/g) || []).map(Number);
  if (/AGG/.test(t) || !nn.length) return "miss";
  const wk = (n) => (n <= 9 ? n + 52 : n);
  const arr = Math.max(...nn.map(wk));
  const start = firstKey ? wk(+firstKey.slice(5)) : 99;
  return arr > start ? "late" : "soon";
}
const PI_MATCOL = { ok: [GRN + "22", "#166534"], na: [S2, T3], soon: ["#E0F2FE", "#075985"], late: ["#FFD9B8", "#9A3412"], miss: ["#FFF1E6", "#9A3412"] };
function piSort(a, b) {
  const ia = PI_ORD.indexOf(a), ib = PI_ORD.indexOf(b);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return a.localeCompare(b);
}
const piSlug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const piWrite = (path, v) => set(ref(db, `piano/${path}`), v === undefined || v === "" ? null : v);
// materiale/data in forma da salvare: tolgo i vuoti
const piCleanRow = (r) => {
  const o = { ...r }; delete o.id;
  const m = {}; Object.entries(o.m || {}).forEach(([k, v]) => { if (String(v ?? "").trim() !== "") m[k] = String(v).trim(); });
  o.m = Object.keys(m).length ? m : null;
  const w = {}; Object.entries(o.w || {}).forEach(([k, v]) => { if (+v > 0) w[k] = +v; });
  o.w = Object.keys(w).length ? w : null;
  Object.keys(o).forEach((k) => { if (o[k] === "" || o[k] === undefined) o[k] = null; });
  return o;
};

function PianoTab({ pia, vers, wide }) {
  const righe = pia.righe || {};
  const meta = pia.meta || {};
  const cfg = pia.cfg || {};
  const [q, setQ] = useState("");
  const [onlyMiss, setOnlyMiss] = useState(false);
  const [sel, setSel] = useState({});
  const [edit, setEdit] = useState(null);      // riga in modifica / nuova ({} = nuova)
  const [showVers, setShowVers] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [busy, setBusy] = useState("");

  const rows = useMemo(() => Object.entries(righe).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.o || 0) - (b.o || 0)), [righe]);
  const baseKey = meta.week || piToday();
  const hideMap = cfg.hide || {};
  const ext = +cfg.ext || 0;
  const allWeeks = useMemo(() => {
    let last = piAdd(baseKey, 20 + ext);
    rows.forEach((r) => Object.keys(r.w || {}).forEach((k) => { if (piIdx(k) > piIdx(last)) last = k; }));
    const first = piAdd(baseKey, -3);
    const n = Math.min(80, piIdx(last) - piIdx(first) + 1);
    return Array.from({ length: n }, (_, i) => piWeek(piAdd(first, i)));
  }, [baseKey, rows, ext]);
  const usedW = useMemo(() => { const u = {}; rows.forEach((r) => Object.entries(r.w || {}).forEach(([k, v]) => { if (+v) u[k] = true; })); return u; }, [rows]);
  const weeks = useMemo(() => allWeeks.filter((w) => !hideMap[w.k] || usedW[w.k]), [allWeeks, cfg.hide, usedW]);
  const nHidden = allWeeks.filter((w) => hideMap[w.k] && !usedW[w.k]).length;
  const nEmpty = weeks.filter((w) => !usedW[w.k]).length;
  const [zm, setZm] = useState(() => { try { const v = parseFloat(localStorage.getItem("piano_zoom")); return v > 0.4 && v <= 1 ? v : 0.7; } catch (e) { return 0.7; } });
  const setZoom = (v) => { setZm(v); try { localStorage.setItem("piano_zoom", String(v)); } catch (e) {} };
  const hideWeek = (k) => set(ref(db, `piano/cfg/hide/${k}`), true).catch((e) => window.alert("Operazione non riuscita: " + e.message));
  const hideEmptyPast = () => {
    const o = { ...hideMap };
    allWeeks.forEach((w) => { if (piIdx(w.k) < piIdx(baseKey) && !usedW[w.k]) o[w.k] = true; });
    set(ref(db, "piano/cfg/hide"), o).catch((e) => window.alert("Operazione non riuscita: " + e.message));
  };
  const showAllWeeks = () => set(ref(db, "piano/cfg/hide"), null).catch((e) => window.alert("Operazione non riuscita: " + e.message));
  const nextKey = piAdd(baseKey, 1);
  const wName = (k) => "W" + String(parseInt(k.split("-")[1], 10));
  const newWeek = async () => {
    const cur = meta.name || wName(baseKey), nxt = wName(nextKey);
    if (!window.confirm(`Salvo il piano attuale come versione «${cur}» e apro ${nxt} con le stesse righe (poi lo modifichi). Procedo?`)) return;
    setBusy("w");
    try {
      const vid = piSlug(cur);
      const clean = {}; rows.forEach((r) => { const { id, ...rest } = r; clean[id] = rest; });
      await set(ref(db, `pianoVersRighe/${vid}`), clean);
      await set(ref(db, `pianoVers/${vid}`), { name: cur, week: baseKey, weekStart: piMonday(baseKey).toISOString().slice(0, 10), savedAt: Date.now(), n: rows.length });
      await set(ref(db, "piano/meta"), { name: nxt, week: nextKey, savedName: cur });
    } catch (e) { window.alert("Operazione non riuscita: " + e.message); }
    finally { setBusy(""); }
  };
  const addWeeks = () => set(ref(db, "piano/cfg/ext"), ext + 4).catch((e) => window.alert("Operazione non riuscita: " + e.message));
  const NW = weeks.length;
  const COLS_L = 19; // colonne prima delle settimane: sel, brand, articolo, cons, blocco, R, 6 materiali, mat, qnt, sped, giac, prezzo, saldo, check
  const capOf = (c) => +(cfg.cap && cfg.cap[c]) || 0;
  const daysOf = (w) => (cfg.days && +cfg.days[w.k]) || w.days;

  const info = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const ks = Object.keys(r.w || {}).filter((k) => +r.w[k] > 0).sort();
      const first = ks[0] || null;
      const plan = piPlanTot(r);
      const ms = PI_MAT.map(([k], j) => (plan > 0 ? piMatStat(r.m?.[k], j, first) : "none"));
      const miss = ms.filter((x) => x === "miss" || x === "late").length;
      m.set(r.id, { plan, ms, miss, diff: piSaldo(r) - plan });
    });
    return m;
  }, [rows]);
  const matRows = rows.filter((r) => info.get(r.id).plan > 0).length;
  const matBad = rows.filter((r) => info.get(r.id).plan > 0 && info.get(r.id).miss > 0).length;

  const ql = q.trim().toUpperCase();
  const shown = rows.filter((r) => {
    if (onlyMiss && !(info.get(r.id).plan > 0 && info.get(r.id).miss > 0)) return false;
    if (ql && ![r.b, r.c, r.a, r.k, r.bl].some((x) => String(x || "").toUpperCase().includes(ql))) return false;
    return true;
  });
  const calzs = [...new Set(rows.map((r) => r.c))].sort(piSort);

  // totali per settimana: tutti i calzaturifici (anche con filtro attivo: i totali sono del piano intero)
  const totBy = {}, fatBy = {};
  const grand = new Array(NW).fill(0), grandF = new Array(NW).fill(0);
  rows.forEach((r) => {
    const c = r.c;
    totBy[c] = totBy[c] || new Array(NW).fill(0); fatBy[c] = fatBy[c] || new Array(NW).fill(0);
    weeks.forEach((w, i) => { const v = piPn(r, w.k); if (v) { totBy[c][i] += v; fatBy[c][i] += v * (+r.p || 0); grand[i] += v; grandF[i] += v * (+r.p || 0); } });
  });
  const wlOf = (i) => {
    if (i <= 0) return {};
    if (weeks[i].k.slice(0, 4) !== weeks[i - 1].k.slice(0, 4)) return { borderLeft: `4px solid ${RED}` };
    if (weeks[i].month !== weeks[i - 1].month) return { borderLeft: "2px solid #5A7494" };
    return {};
  };
  const months = [];
  weeks.forEach((w, i) => {
    const last = months[months.length - 1];
    if (last && last.name === w.month) { last.span++; last.eur += grandF[i]; } else months.push({ name: w.month, span: 1, eur: grandF[i], first: i });
  });

  const selIds = Object.keys(sel).filter((id) => sel[id] && righe[id]);
  const shiftIds = async (ids, d) => {
    setBusy("shift");
    try {
      for (const id of ids) {
        const r = righe[id]; if (!r) continue;
        const nw = {}; Object.entries(r.w || {}).forEach(([k, v]) => { nw[piAdd(k, d)] = v; });
        await piWrite(`righe/${id}/w`, Object.keys(nw).length ? nw : null);
      }
    } catch (e) { console.error(e); window.alert("Spostamento non riuscito: " + e.message); }
    finally { setBusy(""); }
  };

  // ── salvataggio riga (nuova o modificata)
  const saveRow = async (id, f) => {
    const cur = id ? righe[id] : null;
    const row = { ...(cur || {}), b: f.b.trim().toUpperCase(), c: f.c.trim().toUpperCase(), s: f.s.trim(), a: f.a.trim(), k: f.k.trim(), bl: f.bl.trim(), r: f.r.trim(), d: f.d.trim() };
    if (!row.b || !row.c || !row.a) return window.alert("Servono almeno marchio, calzaturificio e articolo.");
    let nid = id;
    if (!id) {
      nid = uid() + uid();
      const same = rows.filter((x) => x.c === row.c && x.b === row.b);
      const lastO = same.length ? Math.max(...same.map((x) => x.o || 0)) : null;
      const all = rows.map((x) => x.o || 0).sort((a, b) => a - b);
      if (lastO === null) row.o = (all.length ? all[all.length - 1] : 0) + 1;
      else { const nx = all.find((v) => v > lastO); row.o = nx === undefined ? lastO + 1 : (lastO + nx) / 2; }
      row.ts = Date.now();
    }
    try { await set(ref(db, `piano/righe/${nid}`), piCleanRow(row)); setEdit(null); }
    catch (e) { console.error(e); window.alert("Salvataggio non riuscito: " + e.message); }
  };
  const delRow = async (id) => {
    if (!window.confirm("Eliminare questa riga dal piano?")) return;
    try { await set(ref(db, `piano/righe/${id}`), null); setEdit(null); } catch (e) { window.alert("Eliminazione non riuscita: " + e.message); }
  };

  const th = { background: ML, padding: "6px 4px", fontSize: 10, color: T2, fontWeight: 800, borderBottom: `2px solid ${BRD2}`, borderRight: `1px solid ${BRD}`, whiteSpace: "nowrap", textAlign: "center", lineHeight: 1.15 };
  const thWrap = { ...th, whiteSpace: "normal" };
  const grid = `1px solid ${BRD}`;
  const empty = rows.length === 0 && Object.keys(vers || {}).length === 0;

  return (
    <div style={{ fontFamily: FONT, padding: "14px 14px", paddingBottom: 40 }} onKeyDown={rieNav}>
      <div style={{ zoom: zm }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", marginBottom: 10 }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>Piano settimanale <span style={{ color: M }}>{meta.name || ""}</span></div>
          <div style={{ fontSize: 12, color: T2 }}>{rows.length} righe · tutti i calzaturifici{meta.savedName ? ` · ultima versione salvata: ${meta.savedName}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Dimensione della tabella">
          <span style={{ fontSize: 11, color: T2, fontWeight: 700 }}>Zoom</span>
          {[0.6, 0.7, 0.85, 1].map((v) => <button key={v} onClick={() => setZoom(v)} style={{ background: zm === v ? M : S0, color: zm === v ? "#fff" : M, border: `1.5px solid ${BRD2}`, borderRadius: 8, padding: "0 8px", minHeight: 32, fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{Math.round(v * 100)}%</button>)}
        </div>
        <Btn color={S0} textColor={M} style={{ width: "auto", padding: "0 14px", minHeight: 44, border: `1.5px solid ${BRD2}` }} onClick={() => setShowCfg(true)}>Limiti e giorni</Btn>
        <Btn color={S0} textColor={M} style={{ width: "auto", padding: "0 14px", minHeight: 44, border: `1.5px solid ${BRD2}` }} onClick={() => setShowVers(true)}>Versioni e confronto</Btn>
        <Btn color={S0} textColor={M} style={{ width: "auto", padding: "0 14px", minHeight: 44, border: `1.5px solid ${BRD2}` }} onClick={newWeek}>{`Salva ${meta.name || wName(baseKey)} e apri ${wName(nextKey)}`}</Btn>
        <Btn style={{ width: "auto", padding: "0 16px", minHeight: 44 }} onClick={() => setShowVers("save")}>Salva versione</Btn>
      </div>

      {empty && <PianoImport />}

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", marginBottom: 10 }}>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca marchio, articolo, colore o blocco" aria-label="Cerca nel piano"
              style={{ flex: "1 1 220px", maxWidth: 360, boxSizing: "border-box", background: S0, border: `1.5px solid ${BRD2}`, borderRadius: 12, padding: "0 12px", minHeight: 44, fontFamily: FONT, fontSize: 14, color: TXT, outline: "none" }} />
            <button onClick={() => setOnlyMiss((v) => !v)} style={{ background: onlyMiss ? ACC : "#FFF7E0", color: onlyMiss ? "#fff" : "#854D0E", border: "1.5px solid #E8D9A8", borderRadius: 12, padding: "0 14px", minHeight: 44, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              {onlyMiss ? "Mostra tutte le righe" : "Solo righe con materiali mancanti"}
            </button>
            <button onClick={() => setEdit({})} style={{ background: S0, color: M, border: `1.5px dashed ${BRD2}`, borderRadius: 12, padding: "0 14px", minHeight: 44, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>+ Nuova riga</button>
            <button onClick={hideEmptyPast} style={{ background: S0, color: M, border: `1.5px solid ${BRD2}`, borderRadius: 12, padding: "0 14px", minHeight: 44, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Nascondi settimane passate vuote</button>
            <button onClick={addWeeks} style={{ background: S0, color: M, border: `1.5px solid ${BRD2}`, borderRadius: 12, padding: "0 14px", minHeight: 44, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>+ 4 settimane future</button>
            {nHidden > 0 && <button onClick={showAllWeeks} style={{ background: S0, color: T2, border: `1.5px solid ${BRD2}`, borderRadius: 12, padding: "0 14px", minHeight: 44, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Mostra {nHidden} settimane nascoste</button>}
            <span style={{ fontSize: 12, color: "#854D0E", fontWeight: 600 }}>Materiali: {matRows - matBad} righe in piano complete, {matBad} con materiali mancanti o in ritardo</span>
            <span style={{ fontSize: 12, color: T2 }}>{shown.length !== rows.length ? `${shown.length} righe mostrate · ` : ""}frecce e Invio per muoversi · somme tipo 100+50</span>
          </div>

          {selIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 10px", background: M, color: "#fff", borderRadius: 14, padding: "8px 12px", marginBottom: 10 }}>
              <b style={{ fontSize: 13 }}>{selIds.length} righe selezionate</b>
              <span style={{ fontSize: 12, opacity: 0.9 }}>Sposta tutte di</span>
              {[[-1, "− 1 sett."], [1, "+ 1 sett."], [2, "+ 2 sett."]].map(([d, l]) => (
                <button key={d} disabled={!!busy} onClick={() => shiftIds(selIds, d)} style={{ background: d === 1 ? "#fff" : "rgba(255,255,255,0.18)", color: d === 1 ? M : "#fff", border: d === 1 ? "none" : "1px solid rgba(255,255,255,0.5)", borderRadius: 10, padding: "0 12px", minHeight: 40, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{l}</button>
              ))}
              <button onClick={() => setSel({})} style={{ marginLeft: "auto", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 10, padding: "0 12px", minHeight: 40, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Deseleziona</button>
            </div>
          )}

          <div style={{ overflow: "auto", maxHeight: `calc((100vh - 150px) / ${zm})`, background: S0, border: `1px solid ${BRD2}`, borderRadius: 14 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12, minWidth: "max-content", width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
                <tr>
                  <td colSpan={COLS_L} style={{ background: "#EEF2F8", borderRight: grid, borderBottom: grid, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: TXT, letterSpacing: "0.06em" }}>PAIA SETTIMANALI</td>
                  {grand.map((v, i) => <td key={i} style={{ ...wlOf(i), background: "#EEF2F8", borderRight: grid, borderBottom: grid, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TXT }}>{v || ""}</td>)}
                  <td style={{ background: "#EEF2F8", borderBottom: grid }} />
                </tr>
                <tr>
                  <td colSpan={COLS_L} style={{ background: "#EEF2F8", borderRight: grid, borderBottom: grid, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: TXT, letterSpacing: "0.06em" }}>PAIA GIORNALIERE <span style={{ fontWeight: 600, color: T2, letterSpacing: 0 }}>(paia ÷ giorni lavorativi della settimana)</span></td>
                  {grand.map((v, i) => <td key={i} style={{ ...wlOf(i), background: "#EEF2F8", borderRight: grid, borderBottom: grid, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 800, color: M }}>{v ? Math.round(v / daysOf(weeks[i])) : ""}</td>)}
                  <td style={{ background: "#EEF2F8", borderBottom: grid }} />
                </tr>
                <tr>
                  <td colSpan={COLS_L} rowSpan={2} style={{ background: "#FFF7E0", borderBottom: `2px solid ${BRD2}`, borderRight: grid, padding: "6px 12px", verticalAlign: "middle" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#854D0E" }}>FATTURATO PREVISTO PER MESE</div>
                    <div style={{ fontSize: 11, color: "#854D0E" }}>paia pianificate × prezzo medio; si aggiorna mentre scrivi</div>
                  </td>
                  {months.map((m, i) => <td key={i} colSpan={m.span} style={{ background: "#FFF7E0", borderRight: grid, ...wlOf(m.first), textAlign: "center", padding: "6px 4px 0", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "#854D0E" }}>{m.name}</td>)}
                  <td rowSpan={2} style={{ background: "#FFF7E0", borderBottom: `2px solid ${BRD2}` }} />
                </tr>
                <tr>
                  {months.map((m, i) => <td key={i} colSpan={m.span} style={{ background: "#FFF7E0", borderRight: grid, ...wlOf(m.first), borderBottom: `2px solid ${BRD2}`, textAlign: "center", padding: "0 4px 6px", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TXT }}>{piEur(m.eur)}</td>)}
                </tr>
                <tr>
                  <th style={{ ...th, width: 26 }} />
                  <th style={{ ...th, textAlign: "left", minWidth: 62 }}>Marchio</th>
                  <th style={{ ...th, textAlign: "left", minWidth: 160 }}>Articolo · colore</th>
                  <th style={{ ...th, minWidth: 48 }}>Consegna</th>
                  <th style={{ ...th, minWidth: 64 }}>Blocco ordine</th>
                  <th style={{ ...th, minWidth: 24 }}>R</th>
                  {PI_MAT.map(([k, l]) => <th key={k} style={{ ...thWrap, background: "#FFF7E0", color: "#854D0E", minWidth: k === "fm" ? 46 : 48 }}>{l}</th>)}
                  <th style={{ ...thWrap, background: "#FFF7E0", color: "#854D0E", minWidth: 52 }}>Materiali</th>
                  <th style={{ ...th, minWidth: 44 }}>Qnt</th>
                  <th style={{ ...th, minWidth: 44 }}>Sped.</th>
                  <th style={{ ...th, minWidth: 44, background: "#C9CED6", color: "#4B5563" }}>Giac.</th>
                  <th style={{ ...thWrap, minWidth: 54 }}>Prezzo medio (€)</th>
                  <th style={{ ...th, minWidth: 46, background: "#DCE5F3" }}>Saldo</th>
                  <th style={{ ...th, minWidth: 44 }}>Check</th>
                  {weeks.map((w, i) => (
                    <th key={w.k} style={{ ...th, minWidth: 44, ...wlOf(i), ...(w.k === baseKey ? { background: "#D7E3FF", color: M } : {}) }}>{w.n}<div style={{ fontWeight: 400, fontSize: 9 }}>{w.cal}</div>{!usedW[w.k] && <button onClick={() => hideWeek(w.k)} title="Nascondi questa settimana (vuota)" aria-label={`Nascondi settimana ${w.n}`} style={{ border: "none", background: "transparent", color: T3, cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "2px 4px" }}>×</button>}</th>
                  ))}
                  <th style={{ ...thWrap, minWidth: 62 }}>Slitta riga</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let gi = 0;
                  return calzs.map((c) => {
                    const list = shown.filter((r) => r.c === c);
                    if (!list.length && (q || onlyMiss)) return null;
                    const tot = totBy[c] || new Array(NW).fill(0), fat = fatBy[c] || new Array(NW).fill(0);
                    const cap = capOf(c);
                    const sumCell = { textAlign: "center", padding: "5px 2px", fontFamily: MONO, fontWeight: 700, fontSize: 12, borderRight: grid };
                    return (
                      <Fragment key={c}>
                        <tr><td colSpan={COLS_L + NW + 1} style={{ background: M, color: "#fff", padding: "9px 12px", fontWeight: 800, fontSize: 13, letterSpacing: "0.04em" }}>{PI_NAMES[c] || c} · {rows.filter((r) => r.c === c).length} righe</td></tr>
                        {list.map((r, zi) => {
                          const nf = info.get(r.id);
                          const rg = gi++;
                          const newB = zi > 0 && list[zi - 1].b !== r.b;
                          const isSel = !!sel[r.id];
                          const bg = isSel ? "#C9DBFF" : zi % 2 === 0 ? "#EAF1FF" : "#FFFFFF";
                          const bt = { background: bg, borderBottom: `1px solid ${BRD}`, borderRight: grid, ...(newB ? { borderTop: `3px double ${RED}` } : {}) };
                          const cell = (n) => ({ ...bt, padding: 0, textAlign: "center" });
                          const nums = [["q", r.q, "num"], ["sp", r.sp, "num"], ["g", r.g, "num"], ["p", r.p, "dec"]];
                          return (
                            <tr key={r.id}>
                              <td style={{ ...bt, textAlign: "center", padding: "0 4px" }}><input type="checkbox" checked={isSel} onChange={(e) => setSel((p) => ({ ...p, [r.id]: e.target.checked }))} aria-label={`Seleziona ${r.a} ${r.k}`} style={{ width: 16, height: 16, accentColor: M }} /></td>
                              <td style={{ ...bt, padding: "2px 6px", fontWeight: 800, fontSize: 12, color: TXT }}>{r.b}</td>
                              <td style={{ ...bt, padding: "2px 6px", lineHeight: 1.15, cursor: "pointer" }} onClick={() => setEdit({ id: r.id, ...r })} title="Modifica la riga">
                                <div style={{ fontWeight: 800, fontSize: 12, color: TXT }}>{r.a}</div>
                                <div style={{ fontSize: 10, color: T2 }}>{r.k}</div>
                              </td>
                              <td style={{ ...bt, textAlign: "center", fontFamily: MONO, fontSize: 11, padding: "2px 4px" }}>{r.d && /^\d{4}-\d\d-\d\d$/.test(r.d) ? r.d.slice(8) + "/" + r.d.slice(5, 7) : r.d || ""}</td>
                              <td style={{ ...bt, textAlign: "center", fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: "2px 4px" }}>{r.bl}</td>
                              <td style={{ ...bt, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, padding: "2px 2px" }}>{r.r}</td>
                              {PI_MAT.map(([k], j) => {
                                const st = nf.ms[j];
                                const col = PI_MATCOL[st];
                                return (
                                  <td key={k} style={cell()}>
                                    <RCell kind="txt" align="center" g={`${rg}:${j}`} value={r.m?.[k]} onCommit={(v) => piWrite(`righe/${r.id}/m/${k}`, v)} pad="3px 1px" fs={11} bg={col ? col[0] : undefined} fg={col ? col[1] : undefined} bold />
                                  </td>
                                );
                              })}
                              <td style={{ ...bt, textAlign: "center", padding: "2px 3px" }}>
                                {nf.plan > 0 && <span style={{ background: nf.miss ? "#FFE4D6" : "#DCFCE7", color: nf.miss ? "#9A3412" : "#166534", fontWeight: 800, fontSize: 10, padding: "2px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>{nf.miss ? `manca ${nf.miss}` : "ok"}</span>}
                              </td>
                              {nums.map(([f, v, kd], j) => (
                                <td key={f} style={f === "g" ? { ...cell(), background: "#E4E7EC" } : cell()}>
                                  <RCell kind={kd} align="center" g={`${rg}:${6 + j}`} bg={f === "g" ? "#E4E7EC" : undefined} fg={f === "g" ? "#4B5563" : undefined} value={kd === "dec" && v ? piFmtN(v) : v} fmt={kd === "dec" ? (x) => "€ " + x : undefined} onCommit={(nv) => piWrite(`righe/${r.id}/${f}`, nv)} pad="3px 1px" fs={12} bold />
                                </td>
                              ))}
                              <td style={{ ...bt, background: "#DCE5F3", textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{piSaldo(r)}</td>
                              <td style={{ ...bt, textAlign: "center", padding: "2px 3px" }}>
                                <span style={{ background: nf.diff === 0 ? "#DCFCE7" : "#FFF0EA", color: nf.diff === 0 ? "#166534" : "#C2410C", fontWeight: 800, fontSize: 11, padding: "2px 7px", borderRadius: 8, fontFamily: MONO }}>{nf.diff === 0 ? "ok" : nf.diff > 0 ? "−" + nf.diff : "+" + Math.abs(nf.diff)}</span>
                              </td>
                              {weeks.map((w, i) => {
                                const v = piPn(r, w.k);
                                return (
                                  <td key={w.k} style={{ ...cell(), ...wlOf(i) }}>
                                    <RCell kind="num" align="center" g={`${rg}:${10 + i}`} value={v || ""} onCommit={(nv) => piWrite(`righe/${r.id}/w/${w.k}`, nv)} pad="3px 0" fs={12} bold bg={v ? "#BBD0FF" : undefined} fg={v ? "#1A3FA0" : undefined} />
                                  </td>
                                );
                              })}
                              <td style={{ ...bt, textAlign: "center", padding: "0 2px" }}>
                                <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                                  <button aria-label={`Anticipa ${r.a} di una settimana`} disabled={!!busy} onClick={() => shiftIds([r.id], -1)} style={{ background: S0, border: `1px solid ${BRD2}`, borderRadius: 7, width: 26, height: 26, fontSize: 10, color: M, cursor: "pointer" }}>◀</button>
                                  <button aria-label={`Posticipa ${r.a} di una settimana`} disabled={!!busy} onClick={() => shiftIds([r.id], 1)} style={{ background: S0, border: `1px solid ${BRD2}`, borderRadius: 7, width: 26, height: 26, fontSize: 10, color: M, cursor: "pointer" }}>▶</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td colSpan={COLS_L} style={{ ...sumCell, background: "#DCE5F3", textAlign: "left", padding: "6px 12px", fontFamily: FONT, borderTop: `2px solid ${BRD2}` }}>Totale paia pianificate {c}</td>
                          {tot.map((v, i) => <td key={i} style={{ ...sumCell, ...wlOf(i), background: "#DCE5F3", borderTop: `2px solid ${BRD2}` }}>{v || ""}</td>)}
                          <td style={{ background: "#DCE5F3", borderTop: `2px solid ${BRD2}` }} />
                        </tr>
                        <tr>
                          <td colSpan={COLS_L} style={{ background: S0, padding: "5px 12px", fontWeight: 600, fontSize: 11, color: T2, borderRight: grid, borderBottom: grid }}>Paia al giorno{cap ? ` · limite ${cap}` : " · limite non impostato"}</td>
                          {tot.map((v, i) => {
                            const dl = Math.round(v / daysOf(weeks[i]));
                            const over = cap && dl > cap, near = cap && dl >= cap - 2 && !over;
                            return <td key={i} style={{ ...sumCell, borderBottom: grid, background: over ? "#FFE4D6" : near ? "#FFF6D6" : S0, color: over ? "#9A3412" : near ? "#854D0E" : TXT }}>{v ? dl : ""}</td>;
                          })}
                          <td style={{ background: S0, borderBottom: grid }} />
                        </tr>
                        <tr>
                          <td colSpan={COLS_L} style={{ background: "#FFF7E0", padding: "5px 12px", fontWeight: 600, fontSize: 11, color: "#854D0E", borderRight: grid, borderBottom: `2px solid ${BRD2}` }}>Fatturato previsto {c} (€)</td>
                          {fat.map((v, i) => <td key={i} style={{ ...sumCell, ...wlOf(i), background: "#FFF7E0", color: "#854D0E", borderBottom: `2px solid ${BRD2}` }}>{piK(v)}</td>)}
                          <td style={{ background: "#FFF7E0", borderBottom: `2px solid ${BRD2}` }} />
                        </tr>
                      </Fragment>
                    );
                  });
                })()}
                <tr>
                  <td colSpan={COLS_L} style={{ background: M, color: "#fff", padding: "8px 12px", fontWeight: 800, fontSize: 12 }}>TOTALE GENERALE · paia</td>
                  {grand.map((v, i) => <td key={i} style={{ ...wlOf(i), background: M, color: "#fff", textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 12 }}>{v || ""}</td>)}
                  <td style={{ background: M }} />
                </tr>
                <tr>
                  <td colSpan={COLS_L} style={{ background: M, color: "#fff", padding: "8px 12px", fontWeight: 800, fontSize: 12 }}>TOTALE GENERALE · fatturato (€)</td>
                  {grandF.map((v, i) => <td key={i} style={{ ...wlOf(i), background: M, color: "#fff", textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 12 }}>{piK(v)}</td>)}
                  <td style={{ background: M }} />
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: T2, marginTop: 8, lineHeight: 1.5, maxWidth: 900 }}>
            Saldo = Qnt − Sped. − Giac.; il Check è verde quando le paia pianificate coincidono con il saldo. Materiali (PE · FO · SO · SU · TA · Tot. forme, li compila Luca): «OK» arrivato, «WK40» atteso in quella settimana, «/» non serve; vuoto, «DA AGG» o un arrivo dopo la prima settimana di piano della riga sono segnalati in arancio. Clicca sul nome di una riga per modificarne marchio, articolo, colore, blocco, R e consegna.
          </div>
        </>
      )}

      </div>
      {edit && <PianoRowModal row={edit} calzs={calzs} onSave={saveRow} onDelete={delRow} onClose={() => setEdit(null)} />}
      {showCfg && <PianoCfgModal cfg={cfg} calzs={calzs} weeks={weeks} onClose={() => setShowCfg(false)} />}
      {showVers && <PianoVersModal vers={vers || {}} rows={rows} righe={righe} meta={meta} weeks={weeks} mode={showVers} onClose={() => setShowVers(false)} />}
    </div>
  );
}

function PianoRowModal({ row, calzs, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ b: row.b || "", c: row.c || (calzs[0] || "MOS"), s: row.s || "", a: row.a || "", k: row.k || "", bl: row.bl || "", r: row.r || "", d: row.d || "" });
  const set1 = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = { width: "100%", boxSizing: "border-box", background: S0, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "10px 12px", fontFamily: FONT, fontSize: 14, color: TXT, outline: "none" };
  const lab = (t) => <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{t}</div>;
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: TXT, marginBottom: 12 }}>{row.id ? "Modifica riga" : "Nuova riga"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div>{lab("Marchio")}<input style={inp} value={f.b} onChange={set1("b")} /></div>
          <div>{lab("Calzaturificio")}<input style={inp} list="pi-calz" value={f.c} onChange={set1("c")} /><datalist id="pi-calz">{PI_ORD.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div>{lab("Stagione")}<input style={inp} value={f.s} onChange={set1("s")} /></div>
          <div>{lab("Articolo")}<input style={inp} value={f.a} onChange={set1("a")} /></div>
          <div>{lab("Colore")}<input style={inp} value={f.k} onChange={set1("k")} /></div>
          <div>{lab("Blocco ordine")}<input style={inp} value={f.bl} onChange={set1("bl")} /></div>
          <div>{lab("R (riga d'ordine)")}<input style={inp} value={f.r} onChange={set1("r")} /></div>
          <div>{lab("Consegna")}<input style={inp} type="date" value={/^\d{4}-\d\d-\d\d$/.test(f.d) ? f.d : ""} onChange={set1("d")} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {row.id && <Btn color="#FEE2E2" textColor={RED} style={{ width: "auto", padding: "0 16px", minHeight: 46 }} onClick={() => onDelete(row.id)}>Elimina</Btn>}
          <Btn color={S2} textColor={T2} style={{ flex: 1, minHeight: 46 }} onClick={onClose}>Annulla</Btn>
          <Btn style={{ flex: 2, minHeight: 46 }} onClick={() => onSave(row.id || null, f)}>Salva</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PianoCfgModal({ cfg, calzs, weeks, onClose }) {
  const [cap, setCap] = useState(() => { const o = {}; calzs.forEach((c) => { o[c] = cfg.cap?.[c] ? String(cfg.cap[c]) : ""; }); return o; });
  const [days, setDays] = useState(() => { const o = {}; weeks.forEach((w) => { o[w.k] = cfg.days?.[w.k] ? String(cfg.days[w.k]) : ""; }); return o; });
  const inp = { width: 70, boxSizing: "border-box", background: S0, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "8px 8px", fontFamily: MONO, fontSize: 14, color: TXT, outline: "none", textAlign: "center" };
  const save = async () => {
    const c = {}, d = {};
    calzs.forEach((k) => { const n = parseInt(cap[k], 10); if (n > 0) c[k] = n; });
    weeks.forEach((w) => { const n = parseInt(days[w.k], 10); if (n >= 0 && days[w.k] !== "" && n !== w.days) d[w.k] = n; });
    // le settimane fuori dalla finestra mostrata restano come erano
    Object.entries(cfg.days || {}).forEach(([k, v]) => { if (!weeks.some((w) => w.k === k)) d[k] = v; });
    try { await update(ref(db, "piano/cfg"), { cap: Object.keys(c).length ? c : null, days: Object.keys(d).length ? d : null }); onClose(); }
    catch (e) { window.alert("Salvataggio non riuscito: " + e.message); }
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: TXT, marginBottom: 4 }}>Limiti e giorni lavorativi</div>
        <div style={{ fontSize: 12, color: T2, marginBottom: 12 }}>Il limite di paia al giorno per calzaturificio evidenzia in arancio le settimane troppo cariche. I giorni lavorativi di ogni settimana sono 5 salvo ponti e festività (quelli già indicati nel vostro foglio sono precompilati).</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Limite paia al giorno</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {calzs.map((c) => (
            <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: TXT }}>{c}
              <input style={inp} inputMode="numeric" value={cap[c]} placeholder="—" onChange={(e) => setCap((p) => ({ ...p, [c]: e.target.value.replace(/\D/g, "") }))} />
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Giorni lavorativi per settimana</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {weeks.map((w) => (
            <label key={w.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, color: T2, fontWeight: 700 }}>{w.n}
              <input style={{ ...inp, width: 46 }} inputMode="numeric" value={days[w.k]} placeholder={String(w.days)} onChange={(e) => setDays((p) => ({ ...p, [w.k]: e.target.value.replace(/\D/g, "").slice(0, 1) }))} />
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn color={S2} textColor={T2} style={{ flex: 1, minHeight: 46 }} onClick={onClose}>Annulla</Btn>
        <Btn style={{ flex: 2, minHeight: 46 }} onClick={save}>Salva</Btn>
      </div>
    </Modal>
  );
}

// Versioni settimanali: salva, elenco, confronto con il piano attuale, ripartenza da una versione
function PianoVersModal({ vers, rows, righe, meta, weeks, mode, onClose }) {
  const list = Object.entries(vers).map(([id, v]) => ({ id, ...v })).sort((a, b) => String(b.weekStart || "").localeCompare(String(a.weekStart || "")) || (b.savedAt || 0) - (a.savedAt || 0));
  const [name, setName] = useState(() => "W" + piToday().slice(5));
  const [busy, setBusy] = useState(false);
  const [cmp, setCmp] = useState(null);
  const save = async () => {
    const nm = name.trim();
    if (!nm) return;
    const vid = piSlug(nm);
    if (vers[vid] && !window.confirm(`Esiste già una versione «${nm}». Sostituirla con il piano attuale?`)) return;
    setBusy(true);
    try {
      const clean = {}; rows.forEach((r) => { const { id, ...rest } = r; clean[id] = rest; });
      await set(ref(db, `pianoVersRighe/${vid}`), clean);
      await set(ref(db, `pianoVers/${vid}`), { name: nm, week: meta.week || piToday(), weekStart: piMonday(meta.week || piToday()).toISOString().slice(0, 10), savedAt: Date.now(), n: rows.length });
      await set(ref(db, "piano/meta/savedName"), nm);
      onClose();
    } catch (e) { console.error(e); window.alert("Salvataggio non riuscito: " + e.message); }
    finally { setBusy(false); }
  };
  const loadRows = async (vid) => { const snap = await get(ref(db, `pianoVersRighe/${vid}`)); return snap.exists() ? snap.val() : {}; };
  const compare = async (v) => {
    setBusy(true);
    try {
      const old = Object.values(await loadRows(v.id));
      const a = new Map(old.map((r) => [piRowKey(r), r])), b = new Map(rows.map((r) => [piRowKey(r), r]));
      const moved = [], qty = [], added = [], removed = [];
      b.forEach((r, k) => {
        const o = a.get(k);
        if (!o) { added.push(r); return; }
        const m0 = piMass(o), m1 = piMass(r);
        if (m0 !== null && m1 !== null && Math.abs(m1 - m0) >= 0.5) moved.push({ r, from: m0, to: m1, d: m1 - m0 });
        if ((+o.q || 0) !== (+r.q || 0)) qty.push({ r, from: +o.q || 0, to: +r.q || 0 });
      });
      a.forEach((o, k) => { if (!b.has(k)) removed.push(o); });
      moved.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
      setCmp({ v, moved, qty, added, removed, common: [...b.keys()].filter((k) => a.has(k)).length });
    } catch (e) { console.error(e); window.alert("Confronto non riuscito: " + e.message); }
    finally { setBusy(false); }
  };
  const useAsWork = async (v) => {
    if (!window.confirm(`Usare «${v.name}» come piano di lavoro? Il piano attuale verrà sostituito (salvane prima una versione se ti serve).`)) return;
    setBusy(true);
    try {
      const rr = await loadRows(v.id);
      await set(ref(db, "piano/righe"), rr);
      await set(ref(db, "piano/meta"), { ...(meta || {}), name: v.name, week: v.week || meta.week || null, savedName: meta.savedName || null });
      onClose();
    } catch (e) { console.error(e); window.alert("Operazione non riuscita: " + e.message); }
    finally { setBusy(false); }
  };
  const wl = (m) => { const idx = Math.round(m); const mon = new Date(idx * 7 * 864e5); return "S" + piKey(mon).slice(5); };
  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: FONT, maxHeight: "72vh", overflowY: "auto" }}>
        {mode === "save" ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 900, color: TXT, marginBottom: 4 }}>Salva la versione della settimana</div>
            <div style={{ fontSize: 12, color: T2, marginBottom: 12 }}>Una fotografia del piano attuale (righe, quantità, materiali, settimane). Il piano di lavoro resta quello che stai modificando.</div>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Nome della versione" style={{ width: "100%", boxSizing: "border-box", background: S0, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "12px 14px", fontFamily: FONT, fontSize: 15, color: TXT, outline: "none", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn color={S2} textColor={T2} style={{ flex: 1, minHeight: 46 }} onClick={onClose}>Annulla</Btn>
              <Btn style={{ flex: 2, minHeight: 46 }} onClick={save}>{busy ? "Salvo…" : "Salva versione"}</Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 900, color: TXT, marginBottom: 4 }}>Versioni salvate</div>
            <div style={{ fontSize: 12, color: T2, marginBottom: 10 }}>{list.length} versioni. «Confronta» le mette a fianco del piano attuale; «Usa come piano» ripartire da quella versione.</div>
            {list.length === 0 && <div style={{ fontSize: 13, color: T2 }}>Nessuna versione salvata.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {list.map((v) => (
                <div key={v.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, background: S1, border: `1px solid ${BRD}`, borderRadius: 12, padding: "8px 12px" }}>
                  <div style={{ flex: "1 1 160px" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: TXT }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: T2 }}>{v.n} righe{v.savedAt ? ` · salvata il ${new Date(v.savedAt).toLocaleDateString("it-IT")}` : ""}</div>
                  </div>
                  <button disabled={busy} onClick={() => compare(v)} style={{ background: S0, color: M, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "0 12px", minHeight: 40, fontFamily: FONT, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Confronta</button>
                  <button disabled={busy} onClick={() => useAsWork(v)} style={{ background: S0, color: T2, border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "0 12px", minHeight: 40, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Usa come piano</button>
                </div>
              ))}
            </div>
            {cmp && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${BRD}`, paddingTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: TXT, marginBottom: 4 }}>{cmp.v.name} → piano attuale</div>
                <div style={{ fontSize: 13, color: TXT, lineHeight: 1.5, marginBottom: 8 }}>
                  Su {cmp.common} righe presenti in entrambi, <b>{cmp.moved.length}</b> sono state spostate di mezza settimana o più
                  {cmp.qty.length ? <>, <b>{cmp.qty.length}</b> hanno cambiato quantità</> : null}
                  {cmp.added.length ? <>; <b>{cmp.added.length}</b> righe nuove</> : null}
                  {cmp.removed.length ? <>; <b>{cmp.removed.length}</b> righe tolte</> : null}.
                </div>
                {cmp.moved.slice(0, 15).map((m, i) => (
                  <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "center", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${BRD}` }}>
                    <b style={{ flex: "1 1 180px", color: TXT }}>{m.r.a} <span style={{ fontWeight: 400, color: T2 }}>{m.r.k}</span></b>
                    <span style={{ fontFamily: MONO, color: T2 }}>{wl(m.from)} → {wl(m.to)}</span>
                    <span style={{ fontWeight: 800, color: m.d > 0 ? "#9A3412" : "#166534" }}>{m.d > 0 ? "posticipata" : "anticipata"} di {Math.abs(m.d).toFixed(1).replace(".", ",")} sett.</span>
                  </div>
                ))}
                {cmp.moved.length > 15 && <div style={{ fontSize: 11, color: T2, marginTop: 4 }}>… e altre {cmp.moved.length - 15} righe spostate.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// Primo avvio: carica il file con il piano attuale e lo storico dei fogli settimanali
function PianoImport() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setBusy(true); setMsg("Leggo il file…");
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.versions) || !data.versions.length) throw new Error("File non riconosciuto");
      const conv = (rows) => {
        const out = {};
        rows.forEach((x, i) => {
          const m = {}; (x.m || []).forEach((v, j) => { const t = String(v ?? "").trim(); if (t) m[PI_MAT[j][0]] = t; });
          const row = { b: x.b, c: x.c, s: x.s || null, a: x.a, k: x.k || null, bl: x.bl || null, r: x.r || null, d: x.d || null, m: Object.keys(m).length ? m : null, q: x.q || null, sp: x.sp || null, g: x.g || null, p: x.p || null, w: x.w && Object.keys(x.w).length ? x.w : null, o: i + 1 };
          out[uid() + uid()] = row;
        });
        return out;
      };
      let k = 0;
      for (const v of data.versions) {
        k++; setMsg(`Importo ${v.name} (${k} di ${data.versions.length})…`);
        const vid = piSlug(v.name);
        await set(ref(db, `pianoVersRighe/${vid}`), conv(v.rows));
        await set(ref(db, `pianoVers/${vid}`), { name: v.name, week: v.week, weekStart: v.weekStart, savedAt: new Date(v.weekStart + "T12:00:00").getTime(), n: v.rows.length, imported: true });
      }
      const cur = data.versions.find((v) => v.name === data.current) || data.versions[data.versions.length - 1];
      setMsg("Imposto il piano di lavoro…");
      await set(ref(db, "piano/righe"), conv(cur.rows));
      await set(ref(db, "piano/meta"), { name: cur.name, week: cur.week, savedName: cur.name });
      setMsg("Fatto.");
    } catch (err) { console.error(err); setMsg("Import non riuscito: " + err.message); }
    finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <div style={{ background: ACL, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: TXT, marginBottom: 4 }}>Il piano è vuoto</div>
      <div style={{ fontSize: 13, color: T2, marginBottom: 10, lineHeight: 1.5 }}>Carica il file «piano_storico.json» preparato dal vostro Mosaicon_1: diventa il piano di lavoro (W44) e i fogli precedenti diventano le versioni da confrontare.</div>
      <input type="file" accept=".json,application/json" onChange={onFile} disabled={busy} aria-label="File del piano da importare" />
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: T2, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

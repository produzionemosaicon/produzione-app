import { useMemo, useState } from "react";
import { calcolaAlert } from "./alerts.js";

/* ═══ PER CLAUDE: estrae gli avanzamenti dell'app in un unico testo da incollare a Claude ═══
   L'utente sceglie i blocchi, controlla l'anteprima, preme «Copia» (o «Scarica») e lo incolla in chat.
   Claude elabora il piano e lo restituisce. Nessuna scrittura sul database. */
const M = "#2F5BFF", BRD = "#E2E8F0", BRD2 = "#CBD5E1", TXT = "#0B1220", T2 = "#475569", T3 = "#64748B", S0 = "#fff", S2 = "#F1F5F9", GRN = "#00B87A";
const FONT = "'Inter', sans-serif", MONO = "'JetBrains Mono', monospace";

const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const csv = (rows) => rows.map((r) => r.map((x) => String(x ?? "").replace(/[;\n\r]+/g, " ").trim()).join(";")).join("\n");
const n = (v) => { const s = String(v ?? "").replace(/^[=+\s]+/, ""); return /^\d+(\s*\+\s*\d+)*$/.test(s) ? s.split("+").reduce((a, x) => a + parseInt(x, 10), 0) : 0; };

export default function ExportTab({ pia, sbl, man, tg, giac, manCols }) {
  const manDays = useMemo(() => Object.keys(man || {}).sort(), [man]);
  const fridays = manDays.filter((d) => new Date(d + "T12:00:00").getDay() === 5);
  const [sel, setSel] = useState({ piano: true, alert: true, sblocchi: true, manovia: true, giacenza: true, taglio: true });
  const [mDays, setMDays] = useState(() => {
    const f = fridays.slice(-2), last = manDays.slice(-1);
    return [...new Set([...f, ...last])];
  });
  const [tgDays, setTgDays] = useState(30);
  const [richiesta, setRichiesta] = useState("Elabora la proposta di piano per le prossime settimane: riparti dal piano attuale, tieni conto di quanto già prodotto (Manovia, Giacenza, Taglio e giunteria), degli sblocchi mancanti e degli ordini scaduti. Segnala i conflitti di capacità e le righe a rischio, e restituiscimi il piano nello stesso formato.");
  const [msg, setMsg] = useState("");

  const testo = useMemo(() => {
    const oggi = new Date();
    const out = [];
    out.push(`# ESTRAZIONE AVANZAMENTI — app produzione Mosaicon\nGenerata il ${iso(oggi)} alle ${p2(oggi.getHours())}:${p2(oggi.getMinutes())}\n\n## RICHIESTA\n${richiesta.trim()}\n`);
    const righe = pia?.righe || {};
    if (sel.piano) {
      const rows = Object.values(righe).sort((a, b) => (a.o || 0) - (b.o || 0));
      const wk = [...new Set(rows.flatMap((r) => Object.keys(r.w || {})))].sort();
      out.push(`## PIANO — versione di lavoro ${pia?.meta?.name || ""} (${rows.length} righe)\nUna riga per riga d'ordine. Saldo = qnt − spedite − giacenza. Colonne settimanali = paia pianificate (formato AAAA-WW). Materiali: PE FO SO SU TA (OK = arrivato, WKnn = atteso, / = non serve), FM = tot. forme.\n` +
        csv([["calz", "marchio", "stag", "articolo", "colore", "blocco", "riga", "consegna", "qnt", "spedite", "giacenza", "saldo", "pe", "fo", "so", "su", "ta", "fm", ...wk],
          ...rows.map((r) => [r.c, r.b, r.s, r.a, r.k, r.bl, r.r, r.d, r.q, r.sp, r.g, (+r.q || 0) - (+r.sp || 0) - (+r.g || 0), r.m?.pe, r.m?.fo, r.m?.so, r.m?.su, r.m?.ta, r.m?.fm, ...wk.map((k) => (r.w || {})[k] || "")])]) + "\n");
    }
    if (sel.alert) {
      const al = calcolaAlert({ righe, sblocchi: sbl || {} });
      out.push(`## ALLARMI ATTUALI\nOrdini scaduti (consegna passata e paia non spedite): ${al.scaduti.length}\n` +
        al.scaduti.map((x) => `- ${x.marchio} ${x.art} ${x.col || ""} [${x.calz}] consegna ${x.consegna} (+${x.giorni} gg) da spedire ${x.daSpedire} (di cui in giacenza ${x.giacenza})`).join("\n") +
        `\n\nSblocchi in ritardo / in scadenza (taglio 6–8 sett. e componenti 8 sett. prima dell'inizio piano): ${al.sblocchi.length}\n` +
        al.sblocchi.map((x) => `- [${x.livello}] ${x.cliente} ${x.modello} — piano da S${x.inizio.slice(5)} (${x.settimane} sett.), ${x.paia} paia — mancano: ${x.voci.map((v) => v.tipo).join(", ")}`).join("\n") +
        `\n\nArticoli in piano senza riga nel foglio Sblocchi: ${al.senzaSblocco.length}\n` + al.senzaSblocco.map((x) => `- ${x.marchio} ${x.art} (piano da S${x.inizio.slice(5)})`).join("\n") + "\n");
    }
    if (sel.sblocchi) {
      const att = Object.values(sbl || {}).filter((s) => s && !s.sb);
      out.push(`## SBLOCCHI ATTIVI (${att.length} righe non ancora totalmente sbloccate)\n` +
        csv([["cliente", "stag", "calz", "modello", "forma", "paia", "taglio", "conformita", "prova_calzata", "prova_modello", "prova_struttura", "FORMA", "SPERONE", "SOTTOPIEDE", "SCASSO", "FUSSBETT", "TACCO", "SUOLA", "note"],
          ...att.map((s) => [s.cliente, s.stag, s.calz, s.modello, s.forma, s.paia, s.taglio, s.conf, s.pc, s.pm, s.ps, ...["FORMA", "SPERONE", "SOTTOPIEDE", "SCASSO", "FUSSBETT", "TACCO", "SUOLA"].map((c) => (s.c?.[c]?.s || "") + (s.c?.[c]?.k && s.c[c].k !== "—" ? ` (${s.c[c].k})` : "")), s.note])]) + "\n");
    }
    if (sel.manovia) {
      mDays.slice().sort().forEach((d) => {
        const day = (man || {})[d]; if (!day) return;
        const cols = manCols.filter((c) => !c.calc && !c.text);
        ["art", "cli"].forEach((sec) => {
          const rr = Object.values(day[sec] || {}).sort((a, b) => (a.o || 0) - (b.o || 0));
          if (!rr.length) return;
          out.push(`## MANOVIA ${d} (${sec === "art" ? "per articolo" : "per cliente"}) — situazione ore 17\nColonne: ${cols.map((c) => `${c.k}=${c.l}`).join(", ")}\n` +
            csv([["nome", "brand", "consegna", ...cols.map((c) => c.k)], ...rr.map((r) => [r.nome, r.brand, r.cons, ...cols.map((c) => n(r.q?.[c.k]) || "")])]) + "\n");
        });
      });
    }
    if (sel.giacenza) {
      const g = Object.keys(giac || {}).sort().slice(-1)[0];
      if (g) out.push(`## GIACENZA DEL VENERDÌ ${g}\n` + csv([["articolo", "ordine", "paia"], ...Object.entries(giac[g]).filter(([k]) => k !== "_meta").map(([, r]) => [r.articolo, r.ordine, r.paia])]) + "\n");
    }
    if (sel.taglio) {
      const from = new Date(); from.setDate(from.getDate() - tgDays);
      const days = Object.keys(tg || {}).filter((d) => d >= iso(from)).sort();
      out.push(`## TAGLIO E GIUNTERIA — ultimi ${tgDays} giorni (paia al giorno)\n` + csv([["data", "taglio", "giunteria", "note"], ...days.map((d) => [d, tg[d].taglio, tg[d].giunteria, tg[d].note])]) + "\n");
    }
    return out.join("\n");
  }, [sel, mDays, tgDays, richiesta, pia, sbl, man, tg, giac, manCols]);

  const copia = async () => {
    try { await navigator.clipboard.writeText(testo); setMsg("Copiato: incollalo nella chat con Claude."); }
    catch { setMsg("Copia non riuscita: usa «Scarica» oppure seleziona il testo qui sotto."); }
  };
  const scarica = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([testo], { type: "text/plain;charset=utf-8" }));
    a.download = `avanzamenti_${iso(new Date())}.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const card = { background: S0, borderRadius: 16, border: `1px solid ${BRD}`, padding: "14px 16px", marginBottom: 14 };
  const chk = (k, label) => (
    <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: TXT, cursor: "pointer", padding: "4px 0" }}>
      <input type="checkbox" checked={!!sel[k]} onChange={(e) => setSel((s) => ({ ...s, [k]: e.target.checked }))} /> {label}
    </label>
  );
  const btn = (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 12, padding: "12px 18px", fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: "pointer" });

  return (
    <div style={{ padding: "18px 14px 24px", fontFamily: FONT, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: TXT, marginBottom: 4 }}>Per Claude</div>
      <div style={{ fontSize: 13, color: T2, marginBottom: 14, lineHeight: 1.5 }}>
        Scegli cosa includere, controlla l'anteprima e premi «Copia»: incolla il testo nella chat con Claude, che elabora il piano e te lo restituisce. Questa pagina legge soltanto, non modifica nulla.
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T2, marginBottom: 6 }}>Cosa includere</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
          {chk("piano", "Piano attuale (righe, saldi, settimane)")}
          {chk("alert", "Allarmi: ordini scaduti e sblocchi")}
          {chk("sblocchi", "Sblocchi attivi (dettaglio componenti)")}
          {chk("manovia", "Manovia (giorni scelti sotto)")}
          {chk("giacenza", "Giacenza dell'ultimo venerdì")}
          {chk("taglio", "Taglio e giunteria")}
        </div>
        {sel.manovia && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T2 }}>Giorni Manovia:</span>
            {manDays.slice(-10).map((d) => {
              const on = mDays.includes(d);
              return <button key={d} onClick={() => setMDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))} style={{ background: on ? M : S2, color: on ? "#fff" : T2, border: "none", borderRadius: 8, padding: "5px 9px", fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{d.slice(8)}/{d.slice(5, 7)}</button>;
            })}
          </div>
        )}
        {sel.taglio && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: T2 }}>
            Taglio e giunteria, ultimi{" "}
            <select value={tgDays} onChange={(e) => setTgDays(+e.target.value)} style={{ fontFamily: FONT, fontSize: 12, padding: "3px 6px", border: `1px solid ${BRD2}`, borderRadius: 6 }}>
              {[7, 14, 30, 60, 90].map((x) => <option key={x} value={x}>{x}</option>)}
            </select> giorni
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T2, marginBottom: 6 }}>Cosa chiedi a Claude</div>
        <textarea value={richiesta} onChange={(e) => setRichiesta(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${BRD2}`, borderRadius: 10, padding: "10px 12px", fontFamily: FONT, fontSize: 14, color: TXT, resize: "vertical" }} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <button onClick={copia} style={btn(M, "#fff")}>Copia per Claude</button>
        <button onClick={scarica} style={btn(S2, TXT)}>Scarica .txt</button>
        <span style={{ fontSize: 12, color: T3 }}>{testo.length.toLocaleString("it-IT")} caratteri</span>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: GRN }}>{msg}</span>}
      </div>
      <textarea readOnly value={testo} style={{ width: "100%", boxSizing: "border-box", height: 360, border: `1px solid ${BRD}`, borderRadius: 12, padding: 12, fontFamily: MONO, fontSize: 11, color: T2, background: "#F8FAFC" }} />
    </div>
  );
}

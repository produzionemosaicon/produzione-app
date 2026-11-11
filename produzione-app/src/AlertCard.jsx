import { useMemo, useState } from "react";
import { calcolaAlert } from "./alerts.js";

/* Riquadro «Allarmi del piano» della Home: ordini scaduti + sblocchi in ritardo (regole in alerts.js). */
const BRD = "#E2E8F0", TXT = "#0B1220", T2 = "#475569", T3 = "#64748B", S0 = "#fff", S2 = "#F1F5F9";
const RED = "#E53E3E", RL = "#FEE2E2", AMB = "#B45309", AL = "#FEF3C7", GRN = "#00B87A";
const FONT = "'Inter', sans-serif";
const N = 5;

export default function AlertCard({ pia, sbl, onGoPiano, onGoSblocchi }) {
  const [more, setMore] = useState({});
  const [open, setOpen] = useState(true);
  const al = useMemo(() => calcolaAlert({ righe: pia?.righe || {}, sblocchi: sbl || {} }), [pia, sbl]);
  const fmt = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  const paiaScad = al.scaduti.reduce((s, x) => s + x.daSpedire, 0);
  const rossi = al.sblocchi.filter((x) => x.livello === "rosso").length;
  const tot = al.scaduti.length + al.sblocchi.length;
  const card = { background: S0, borderRadius: 16, border: `1px solid ${BRD}`, marginBottom: 14, fontFamily: FONT, overflow: "hidden" };
  const pill = (bg, fg, t) => <span style={{ background: bg, color: fg, borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{t}</span>;
  const show = (k, list) => (more[k] ? list : list.slice(0, N));
  const moreBtn = (k, list) => list.length > N && (
    <button onClick={() => setMore((m) => ({ ...m, [k]: !m[k] }))} style={{ background: "none", border: "none", color: T3, fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}>
      {more[k] ? "mostra meno" : `mostra tutti (${list.length})`}
    </button>
  );
  const head = (t, sub, onGo, goLabel) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
      <div><span style={{ fontSize: 13, fontWeight: 800, color: TXT }}>{t}</span> <span style={{ fontSize: 12, color: T3 }}>{sub}</span></div>
      <button onClick={onGo} style={{ background: "none", border: "none", color: "#2F5BFF", fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{goLabel} ›</button>
    </div>
  );

  return (
    <div style={card}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: tot ? "#FFF7F5" : S0, border: "none", padding: "12px 16px", cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: TXT }}>Allarmi del piano</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {al.scaduti.length > 0 && pill(RL, RED, `${al.scaduti.length} ordini scaduti`)}
          {rossi > 0 && pill(RL, RED, `${rossi} sblocchi in ritardo`)}
          {al.sblocchi.length - rossi > 0 && pill(AL, AMB, `${al.sblocchi.length - rossi} in scadenza`)}
          {tot === 0 && pill("#DCFCE7", GRN, "tutto in regola")}
          <span style={{ color: T3, fontSize: 14 }}>{open ? "▾" : "▸"}</span>
        </span>
      </button>

      {open && tot > 0 && (
        <div style={{ padding: "4px 16px 14px", display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div>
            {head("Ordini scaduti", `· ${paiaScad.toLocaleString("it-IT")} paia ancora da spedire`, onGoPiano, "Piano")}
            {al.scaduti.length === 0 && <div style={{ fontSize: 12, color: T3 }}>Nessun ordine scaduto.</div>}
            {show("sc", al.scaduti).map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${S2}`, fontSize: 12.5, color: TXT }}>
                <span><b>{x.marchio}</b> · {x.art}{x.col ? ` · ${x.col}` : ""} <span style={{ color: T3 }}>({x.calz}{x.blocco ? `, ${x.blocco}` : ""}{x.riga ? ` r.${x.riga}` : ""})</span></span>
                <span style={{ whiteSpace: "nowrap", textAlign: "right" }}><b>{x.daSpedire}</b> paia · <span style={{ color: RED, fontWeight: 700 }}>{fmt(x.consegna)} (+{x.giorni} gg)</span></span>
              </div>
            ))}
            {moreBtn("sc", al.scaduti)}
          </div>

          <div>
            {head("Sblocchi in ritardo", "· taglio 6–8 sett., componenti 8 sett. prima del piano", onGoSblocchi, "Sblocchi")}
            {al.sblocchi.length === 0 && <div style={{ fontSize: 12, color: T3 }}>Nessuno sblocco in ritardo.</div>}
            {show("sb", al.sblocchi).map((x) => (
              <div key={x.sid} style={{ padding: "6px 0", borderTop: `1px solid ${S2}`, fontSize: 12.5, color: TXT }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span><b>{x.cliente}</b> · {x.modello}</span>
                  <span style={{ whiteSpace: "nowrap", color: T3 }}>piano da S{x.inizio.slice(5)} · {x.settimane < 0 ? "già iniziato" : `tra ${x.settimane.toLocaleString("it-IT")} sett.`} · {x.paia} paia</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {x.voci.map((v) => <span key={v.tipo}>{v.livello === "rosso" ? pill(RL, RED, v.tipo) : pill(AL, AMB, v.tipo)}</span>)}
                </div>
              </div>
            ))}
            {moreBtn("sb", al.sblocchi)}
            {al.senzaSblocco.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: T2 }}>
                <b>{al.senzaSblocco.length}</b> articoli in piano non hanno una riga nel foglio Sblocchi:{" "}
                {al.senzaSblocco.slice(0, 6).map((x) => x.art).join(", ")}{al.senzaSblocco.length > 6 ? "…" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

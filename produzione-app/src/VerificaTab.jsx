import { useMemo, useState } from "react";
import { verificaPiano } from "./verifica.js";
import AvanzamentoPdf from "./AvanzamentoPdf.jsx";

/* ═══ VERIFICA PIANO: si possono fare le paia pianificate nelle prossime settimane? (regole in verifica.js) ═══ */
const M = "#2F5BFF", BRD = "#E2E8F0", TXT = "#0B1220", T2 = "#475569", T3 = "#64748B", S0 = "#fff", S2 = "#F1F5F9";
const RED = "#991B1B", RL = "#FEE2E2", AMB = "#92400E", AL = "#FEF3C7", GRN = "#166534", GL = "#DCFCE7";
const FONT = "'Inter', sans-serif";
const fmt = (n) => Math.round(n).toLocaleString("it-IT");
const LIM = 30;

export default function VerificaTab({ pia, sbl, tg }) {
  const [nSett, setNSett] = useState(4);
  const [calz, setCalz] = useState("");
  const [liv, setLiv] = useState("problemi");      // problemi | rosso | tutte
  const [tutte, setTutte] = useState(false);
  const v = useMemo(() => verificaPiano({ righe: pia?.righe || {}, sblocchi: sbl || {}, tg: tg || {}, settimane: nSett }), [pia, sbl, tg, nSett]);
  const calzList = useMemo(() => [...new Set(v.righe.map((r) => r.calz).filter(Boolean))].sort(), [v]);
  const righe = v.righe.filter((r) => (!calz || r.calz === calz) && (liv === "tutte" || (liv === "rosso" ? r.livello === "rosso" : r.livello !== "ok")));
  const mostra = tutte ? righe : righe.slice(0, LIM);
  const card = { background: S0, borderRadius: 16, border: `1px solid ${BRD}`, padding: "14px 16px", marginBottom: 14 };
  const pill = (bg, fg, t, k) => <span key={k} style={{ background: bg, color: fg, borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 700 }}>{t}</span>;
  const kpi = (lab, val, bg, fg) => (
    <div style={{ background: bg, borderRadius: 12, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: fg }}>{lab}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: fg, lineHeight: 1.15 }}>{fmt(val)} <span style={{ fontSize: 12, fontWeight: 600 }}>paia</span></div>
    </div>
  );
  const sel = { fontFamily: FONT, fontSize: 13, padding: "6px 8px", border: `1px solid #CBD5E1`, borderRadius: 8, background: S0 };

  return (
    <div style={{ padding: "18px 14px 28px", fontFamily: FONT, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: TXT, marginBottom: 4 }}>Verifica piano</div>
      <div style={{ fontSize: 13, color: T2, lineHeight: 1.5, marginBottom: 14 }}>
        Per le paia pianificate nelle prossime settimane controlla materiali, sblocchi e consegne, e confronta il piano con il ritmo di taglio e giunteria. Si aggiorna da solo con i dati dell'app.
      </div>

      <AvanzamentoPdf righe={pia?.righe} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 14 }}>
        {kpi(`Pianificate (W${v.finestra[0].slice(5)}–W${v.finestra[v.finestra.length - 1].slice(5)})`, v.paiaTot, S2, TXT)}
        {kpi("Con problemi gravi", v.paiaRosso, RL, RED)}
        {kpi("Da chiarire", v.paiaGiallo, AL, AMB)}
        {kpi("Nessun problema rilevato", v.paiaOk, GL, GRN)}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T2, marginBottom: 8 }}>Piano contro ritmo di taglio e giunteria</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {v.sett.map((s) => {
            const capMin = Math.min(s.capTaglio || Infinity, s.capGiunteria || Infinity);
            const pct = capMin && isFinite(capMin) ? Math.min(100, (capMin / s.paia) * 100) : 0;
            return (
              <div key={s.key} style={{ border: `1px solid ${BRD}`, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>Settimana {s.key.slice(5)}</span><span>{fmt(s.paia)} paia</span></div>
                <div style={{ height: 8, background: RL, borderRadius: 4, overflow: "hidden", margin: "8px 0 6px" }}><div style={{ width: `${pct}%`, height: "100%", background: "#16A34A" }} /></div>
                <div style={{ fontSize: 11.5, color: s.sopra ? RED : T2, fontWeight: s.sopra ? 700 : 500 }}>
                  {s.sopra ? "Sopra il ritmo: " : "Nel ritmo: "}taglio {fmt(s.capTaglio)} · giunteria {fmt(s.capGiunteria)} a settimana
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: T3, marginTop: 8, lineHeight: 1.5 }}>
          Il ritmo è la media dei giorni inseriti nel foglio Taglio e giunteria (ultimi 30 giorni, {v.cap.giorni} giorni con dati) per 5 giorni. Se i colleghi non inseriscono tutti i giorni o tutti gli stabilimenti, il ritmo risulta più basso del reale.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <select value={nSett} onChange={(e) => setNSett(+e.target.value)} style={sel} aria-label="Settimane da controllare">
          {[2, 3, 4, 6, 8].map((x) => <option key={x} value={x}>Prossime {x} settimane</option>)}
        </select>
        <select value={calz} onChange={(e) => setCalz(e.target.value)} style={sel} aria-label="Calzaturificio">
          <option value="">Tutti i calzaturifici</option>
          {calzList.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={liv} onChange={(e) => setLiv(e.target.value)} style={sel} aria-label="Cosa mostrare">
          <option value="problemi">Solo righe con problemi</option>
          <option value="rosso">Solo problemi gravi</option>
          <option value="tutte">Tutte le righe</option>
        </select>
        <span style={{ fontSize: 12, color: T3 }}>{righe.length} righe</span>
      </div>

      {mostra.map((r) => (
        <div key={r.id} style={{ background: S0, border: `1px solid ${BRD}`, borderLeft: `4px solid ${r.livello === "rosso" ? "#E53E3E" : r.livello === "giallo" ? "#D97706" : "#16A34A"}`, borderRadius: 4, padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13.5 }}>
            <span><b>{r.marchio}</b> · {r.art}{r.col ? ` · ${r.col}` : ""} <span style={{ color: T3 }}>({r.calz}{r.bl ? `, ${r.bl}` : ""}{r.riga ? ` r.${r.riga}` : ""})</span></span>
            <span style={{ whiteSpace: "nowrap", color: T2 }}><b>{fmt(r.paia)}</b> paia · da W{r.inizio.slice(5)}{r.consegna ? ` · consegna ${r.consegna.slice(8)}/${r.consegna.slice(5, 7)}` : ""}</span>
          </div>
          {r.prob.length > 0 ? (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
              {r.prob.map((p, i) => (p.livello === "rosso" ? pill(RL, RED, p.testo, i) : pill(AL, AMB, p.testo, i)))}
            </div>
          ) : <div style={{ fontSize: 12, color: GRN, marginTop: 4, fontWeight: 600 }}>Nessun problema rilevato</div>}
        </div>
      ))}
      {righe.length > LIM && (
        <button onClick={() => setTutte((t) => !t)} style={{ background: "none", border: "none", color: M, fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}>
          {tutte ? "mostra meno" : `mostra tutte (${righe.length})`}
        </button>
      )}
      <div style={{ fontSize: 11.5, color: T3, marginTop: 10, lineHeight: 1.5 }}>
        «Nessun problema rilevato» significa che i controlli sopra non trovano ostacoli. Se per una riga i materiali non sono compilati nel Piano, non possono essere controllati.
      </div>
    </div>
  );
}

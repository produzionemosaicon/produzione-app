import { useEffect, useMemo, useState } from "react";
import { db, ref, onValue } from "./firebase.js";
import { analizzaGea } from "./gea.js";

/* ═══ AVANZAMENTO DA PDF: legge i PDF Gea trascinati in «Per Claude» e segnala i problemi (regole in gea.js) ═══ */
const BRD = "#E2E8F0", TXT = "#0B1220", T2 = "#475569", T3 = "#64748B", S0 = "#fff", S2 = "#F1F5F9";
const RED = "#991B1B", RL = "#FEE2E2", AMB = "#92400E", AL = "#FEF3C7", GRN = "#166534", GL = "#DCFCE7";
const PRIO = { 1: ["Sbloccare subito", RL, RED], 2: ["Giunteria e verifiche", AL, AMB], 3: ["Taglio da recuperare", S2, T2] };
const fd = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—");

export default function AvanzamentoPdf({ righe }) {
  const [db_, setDb] = useState(null);
  useEffect(() => onValue(ref(db, "avanzamentiPdf"), (s) => setDb(s.exists() ? s.val() : {})), []);
  const analisi = useMemo(() => {
    const out = new Map();
    Object.entries(db_ || {}).forEach(([k, v]) => {
      if (!v?.posizioni) return;
      let pos; try { pos = JSON.parse(v.posizioni); } catch { return; }
      const a = analizzaGea(pos, righe || {});
      if (!a || !a.bolle.length) return;
      const prev = out.get(a.ordine);
      if (!prev || (v.savedAt || 0) > prev.savedAt) out.set(a.ordine, { key: k, nome: v.nome, savedAt: v.savedAt || 0, a });
    });
    return [...out.values()].sort((x, y) => y.savedAt - x.savedAt);
  }, [db_, righe]);

  const card = { background: S0, borderRadius: 16, border: `1px solid ${BRD}`, padding: "14px 16px", marginBottom: 14 };
  const kpi = (lab, v, bg, fg) => <div style={{ background: bg, borderRadius: 12, padding: "10px 12px" }}><div style={{ fontSize: 12, fontWeight: 600, color: fg }}>{lab}</div><div style={{ fontSize: 22, fontWeight: 800, color: fg }}>{v ?? "—"}</div></div>;

  if (db_ === null) return null;
  if (!analisi.length) return (
    <div style={{ ...card, background: S2 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T2 }}>Avanzamento da PDF</div>
      <div style={{ fontSize: 12.5, color: T3, marginTop: 4, lineHeight: 1.5 }}>Nessun PDF di Gea con le posizioni salvate. Trascina il PDF «Situazione ordini» nella pagina Per Claude: qui comparirà l'analisi.</div>
    </div>
  );
  return analisi.map(({ key, a, savedAt }) => (
    <div key={key} style={card}>
      <div style={{ fontSize: 16, fontWeight: 800, color: TXT }}>Avanzamento ordine {a.ordine} <span style={{ fontWeight: 600, color: T2 }}>· {a.cliente}</span></div>
      <div style={{ fontSize: 12, color: T3, margin: "2px 0 10px" }}>PDF del {a.oggi.toLocaleDateString("it-IT")}, caricato {new Date(savedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 10 }}>
        {kpi("Ordinate", a.tot.ord, S2, TXT)}{kpi("Montate", a.pMont, GL, GRN)}{kpi("Da montare", a.pNon, a.pNon ? AL : GL, a.pNon ? AMB : GRN)}
        {kpi("Pronte (manca solo montaggio/registrazione)", a.pronte, RL, RED)}{kpi("Spedite", a.tot.sped, S2, TXT)}
      </div>
      {a.avvisi.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {a.avvisi.map((v, i) => <div key={i} style={{ background: v.liv === "rosso" ? RL : AL, color: v.liv === "rosso" ? RED : AMB, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{v.t}</div>)}
        </div>
      )}
      {[1, 2, 3].map((p) => {
        const bs = a.non.filter((b) => b.prio === p);
        if (!bs.length) return null;
        const [tit, bg, fg] = PRIO[p];
        return (
          <div key={p} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: fg, background: bg, borderRadius: 8, padding: "5px 10px", marginBottom: 4 }}>{tit} · {bs.length} bolle · {bs.reduce((s, b) => s + b.qta, 0)} paia</div>
            {bs.map((b) => (
              <div key={b.bolla} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", borderBottom: `1px solid ${S2}`, padding: "5px 4px", fontSize: 12.5, color: TXT }}>
                <b style={{ minWidth: 62 }}>{b.bolla}</b><span style={{ minWidth: 52 }}>{b.qta} paia</span>
                <span style={{ flex: "1 1 260px" }}>{b.azione}</span>
                <span style={{ color: T2 }}>{b.fornitore}</span>
                <span style={{ color: b.urg === "Critica" ? RED : T3, fontWeight: b.urg === "Critica" ? 800 : 500 }}>ultimo avanz. {fd(b.ultima)} ({b.fermo} gg)</span>
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.5 }}>
        Lettura a regole fisse del PDF. La data accanto a ogni fase è l'ultimo avanzamento registrato. Il confronto col piano usa le righe con lo stesso numero ordine ({a.ordine}).
      </div>
    </div>
  ));
}

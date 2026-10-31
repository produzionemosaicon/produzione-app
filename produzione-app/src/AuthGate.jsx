import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase.js";

/* Blocca l'app finché l'utente non ha fatto l'accesso.
   L'app vera (e quindi tutte le letture/scritture sul database) parte solo dopo il login.
   La sessione resta salvata sul dispositivo: da telefono si inserisce la password una volta sola. */

const MESSAGGI = {
  "auth/invalid-credential": "Email o password non corrette.",
  "auth/invalid-email": "Email non valida.",
  "auth/user-disabled": "Utente disattivato.",
  "auth/too-many-requests": "Troppi tentativi. Riprova tra qualche minuto.",
  "auth/network-request-failed": "Nessuna connessione. Riprova.",
};

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = sto controllando, null = non connesso
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [invio, setInvio] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  const accedi = async (e) => {
    e.preventDefault();
    setErrore("");
    setInvio(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
    } catch (err) {
      setErrore(MESSAGGI[err.code] || "Accesso non riuscito. Riprova.");
    } finally {
      setInvio(false);
    }
  };

  if (user === undefined) {
    return (
      <div style={stile.pagina}>
        <div style={{ color: "#5B6B82", fontSize: 15 }}>Caricamento…</div>
      </div>
    );
  }

  if (user) {
    return (
      <>
        {children}
        <button
          onClick={() => signOut(auth)}
          title={user.email || "Esci"}
          style={stile.esci}
        >
          Esci
        </button>
      </>
    );
  }

  return (
    <div style={stile.pagina}>
      <form onSubmit={accedi} style={stile.scheda}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1F2A3C", marginBottom: 4 }}>Produzione</div>
        <div style={{ fontSize: 14, color: "#5B6B82", marginBottom: 18 }}>Accedi per continuare</div>
        <input
          type="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={stile.campo}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={stile.campo}
        />
        {errore && <div style={{ color: "#B42318", fontSize: 14, marginBottom: 10 }}>{errore}</div>}
        <button type="submit" disabled={invio} style={stile.bottone}>
          {invio ? "Accesso…" : "Accedi"}
        </button>
      </form>
    </div>
  );
}

const stile = {
  pagina: {
    minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#EDF1F7", padding: 16, fontFamily: "'Outfit', sans-serif",
  },
  scheda: {
    width: "100%", maxWidth: 340, background: "#fff", borderRadius: 14, padding: 24,
    boxShadow: "0 4px 18px rgba(31,42,60,0.10)",
  },
  campo: {
    width: "100%", padding: "12px 12px", marginBottom: 10, borderRadius: 8,
    border: "1px solid #CBD5E1", fontSize: 16, fontFamily: "inherit", outline: "none",
  },
  bottone: {
    width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
    background: "#1F4E8C", color: "#fff", fontSize: 16, fontWeight: 700,
    fontFamily: "inherit", cursor: "pointer",
  },
  esci: {
    position: "fixed", right: 8, bottom: 8, zIndex: 9999, padding: "4px 10px",
    borderRadius: 6, border: "1px solid #CBD5E1", background: "rgba(255,255,255,0.9)",
    color: "#5B6B82", fontSize: 12, fontFamily: "'Outfit', sans-serif", cursor: "pointer",
  },
};

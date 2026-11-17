import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";

// Dopo una pubblicazione la pagina già aperta cerca file vecchi che non esistono più
// ("Failed to fetch dynamically imported module"): ricarico una volta per prendere la versione nuova.
window.addEventListener("vite:preloadError", (e) => {
  try {
    const last = +sessionStorage.getItem("reloadNuovaVersione") || 0;
    if (Date.now() - last < 30000) return;   // già ricaricato da poco: lascio vedere l'errore
    sessionStorage.setItem("reloadNuovaVersione", String(Date.now()));
  } catch (er) { /* sessionStorage non disponibile: ricarico lo stesso */ }
  e.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
);

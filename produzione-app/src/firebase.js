import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, update } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyDxHBcPmJ1o0OKHmoqobQfDbhrweU3ZZt4",
  authDomain:        "ril-produzione.firebaseapp.com",
  databaseURL:       "https://ril-produzione-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "ril-produzione",
  storageBucket:     "ril-produzione.firebasestorage.app",
  messagingSenderId: "635460045150",
  appId:             "1:635460045150:web:8b691e8c0d652031c6e7cf",
  measurementId:     "G-91H8HQXB2K"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

export { db, ref, set, get, onValue, update };

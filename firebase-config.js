import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPwLwlUpR9lcwFVraPGBIiDA-x36E1lY4",
  authDomain: "bachelor-room-manager.firebaseapp.com",
  projectId: "bachelor-room-manager",
  storageBucket: "bachelor-room-manager.firebasestorage.app",
  messagingSenderId: "629784680046",
  appId: "1:629784680046:web:6e1ecebdc4d1febcc9f87f",
  measurementId: "G-GPFKY962XL"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDRyF--c5HdL4XyTqxjCui81jdtzre9CFI",
  authDomain: "apprendre-saas.firebaseapp.com",
  projectId: "apprendre-saas",
  storageBucket: "apprendre-saas.firebasestorage.app",
  messagingSenderId: "1061046280151",
  appId: "1:1061046280151:web:89e5331935d3ce8f29b592"
};

const app = initializeApp(FIREBASE_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);

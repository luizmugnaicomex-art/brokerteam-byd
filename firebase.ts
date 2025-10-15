// src/firebase.ts

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// 1. Configuração do Firebase que lê as variáveis de ambiente da Vercel
export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Inicialização do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 3. Exportação dos serviços que serão usados em outros arquivos
export const auth = firebase.auth();
export const firestore = firebase.firestore();
export const FieldValue = firebase.firestore.FieldValue;

export default firebase;

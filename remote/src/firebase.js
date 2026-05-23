import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBkg__6ueuUWRGYZRF8-iqWmzb3OfKn8Mw",
  authDomain: "biblevoicetoverse.firebaseapp.com",
  databaseURL: "https://biblevoicetoverse-default-rtdb.firebaseio.com",
  projectId: "biblevoicetoverse",
  storageBucket: "biblevoicetoverse.firebasestorage.app",
  messagingSenderId: "817133011749",
  appId: "1:817133011749:web:efc22d1c1ebc54a42790cc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const DB_URL = 'https://biblevoicetoverse-default-rtdb.firebaseio.com';

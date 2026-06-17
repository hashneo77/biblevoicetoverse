import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyBkg__6ueuUWRGYZRF8-iqWmzb3OfKn8Mw',
  authDomain: 'biblevoicetoverse.firebaseapp.com',
  databaseURL: 'https://biblevoicetoverse-default-rtdb.firebaseio.com',
  projectId: 'biblevoicetoverse',
  storageBucket: 'biblevoicetoverse.firebasestorage.app',
  messagingSenderId: '817133011749',
  appId: '1:817133011749:web:efc22d1c1ebc54a42790cc',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)
export const DB_URL = 'https://biblevoicetoverse-default-rtdb.firebaseio.com'

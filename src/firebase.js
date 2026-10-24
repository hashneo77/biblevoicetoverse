import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
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
export const auth = getAuth(app)
export const db = getDatabase(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

// Access: Google sign-in for the owner + emails listed under config/access (see database.rules.json).
// Each user has a private session: the owner keeps 'remote', others get 'u_<emailKey>'.
export const OWNER_EMAIL = 'josephgeorge7797@gmail.com'
export const emailKey = email => email.trim().toLowerCase().replace(/\./g, ',')
export const sessionForEmail = email =>
  email.trim().toLowerCase() === OWNER_EMAIL ? 'remote' : `u_${emailKey(email)}`

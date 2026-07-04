import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import dotenv from 'dotenv';
import {
  ADMIN_USERS_COLLECTION,
  AdminUserRecord,
  hashPassword,
  normalizeUsername,
} from '../src/adminAuth';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log("Config Check:", {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    hasApiKey: !!firebaseConfig.apiKey
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const username = "comelec_2026_admin";
const password = "c0m3l3c_2o2G";

async function createAdminUser() {
  const normalizedUsername = normalizeUsername(username);
  const accountRef = doc(db, ADMIN_USERS_COLLECTION, normalizedUsername);
  const existingAccount = await getDoc(accountRef);
  const passwordHash = await hashPassword(password);

  const account: AdminUserRecord = {
    username: normalizedUsername,
    role: 'admin',
    passwordHash,
    createdAt: existingAccount.exists()
      ? (existingAccount.data() as AdminUserRecord).createdAt
      : new Date().toISOString(),
  };

  await setDoc(accountRef, account);
  console.log(`Success: admin account ${existingAccount.exists() ? 'updated' : 'created'} for ${normalizedUsername}`);
}

createAdminUser().catch((error) => {
  console.error("Error creating user:", error.message);
  process.exit(1);
});

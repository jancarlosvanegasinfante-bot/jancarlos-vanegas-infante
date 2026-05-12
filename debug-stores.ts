import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function debugStore() {
  const storesSnap = await getDocs(collection(db, "stores"));
  console.log("--- STORES ---");
  for (const d of storesSnap.docs) {
    console.log(`ID: ${d.id}`, JSON.stringify(d.data(), null, 2));
  }
}

debugStore();

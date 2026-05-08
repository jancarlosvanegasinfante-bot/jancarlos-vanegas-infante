import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const productsColl = collection(db, "products");
  const snap = await getDocs(productsColl);
  
  const products = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  console.log(`Found ${products.length} total products in DB.`);
  for (const p of products) {
    console.log(p.docId, p.id, p.name);
  }
}

check().catch(console.error);

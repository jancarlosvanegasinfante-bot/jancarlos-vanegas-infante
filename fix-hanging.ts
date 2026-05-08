import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixHanging() {
  const q = query(collection(db, "activities"), where("status", "==", "procesando"));
  const snap = await getDocs(q);
  console.log(`Found ${snap.docs.length} activities stuck in procesando.`);
  
  for (const d of snap.docs) {
    await updateDoc(doc(db, "activities", d.id), {
      status: "error",
      response: "Interrumpido o timeout del servidor",
      errorAt: new Date()
    });
    console.log("Fixed:", d.id);
  }
  process.exit(0);
}

fixHanging().catch(e => {
  console.error(e);
  process.exit(1);
});

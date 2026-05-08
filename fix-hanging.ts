import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function fixHanging() {
  console.log("Revisando actividades...");
  const snap = await getDocs(collection(db, "activities"));
  let count = 0;
  
  for (const d of snap.docs) {
    const data = d.data();
    if (data.status === "procesando") {
      await updateDoc(doc(db, "activities", d.id), {
        status: "error",
        response: "Interrumpido por seguridad (exceso de carga)",
        errorAt: new Date()
      });
      console.log("Liberado:", d.id);
      count++;
    }
  }
  console.log(`Se liberaron ${count} actividades.`);
  process.exit(0);
}

fixHanging().catch(e => {
  console.error(e);
  process.exit(1);
});

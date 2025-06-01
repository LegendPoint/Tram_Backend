import { createRequire } from 'module';
import admin from 'firebase-admin';
import 'dotenv/config'; // Loads .env variables

const require = createRequire(import.meta.url);
const serviceAccount = require('../service-account.json'); // Adjusted path for project root

const databaseURL = process.env.FIREBASE_DATABASE_URL;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});

const db = admin.database();
const eventsRef = db.ref('events');

async function expireEvents() {
  const snapshot = await eventsRef.once('value');
  const now = Date.now();

  const updates = {};
  snapshot.forEach(child => {
    const event = child.val();
    const endDate = new Date(event.endDate).getTime();
    if (event.status === 'active' && now > endDate) {
      updates[`${child.key}/status`] = 'expired';
    }
  });

  if (Object.keys(updates).length > 0) {
    await eventsRef.update(updates);
    console.log('Expired events updated:', updates);
  } else {
    console.log('No events to expire.');
  }
}

async function loopExpireEvents() {
  while (true) {
    await expireEvents();
    await new Promise(resolve => setTimeout(resolve, 60 * 1000)); // wait 1 minute
  }
}

loopExpireEvents().catch(err => {
  console.error('Error in loop:', err);
  process.exit(1);
}); 
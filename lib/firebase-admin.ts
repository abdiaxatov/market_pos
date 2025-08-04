import * as admin from "firebase-admin"

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
    console.log("Firebase Admin initialized successfully")
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error)
  }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()
export { admin }

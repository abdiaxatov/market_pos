import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, adminUid } = await req.json()

    console.log("Create user request received:", { name, email, role, adminUid })

    if (!name || !email || !password || !role || !adminUid) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Import Firebase Admin SDK dynamically
    const admin = await import("firebase-admin")

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }

    const adminAuth = admin.auth()
    const adminDb = admin.firestore()

    // Verify if the requesting user is an admin
    try {
      const adminUserRecord = await adminAuth.getUser(adminUid)
      const adminDoc = await adminDb.collection("users").doc(adminUid).get()
      const adminData = adminDoc.data()

      if (!adminData || adminData.role !== "admin") {
        return NextResponse.json({ message: "Unauthorized: Only admins can create users" }, { status: 403 })
      }
    } catch (error) {
      console.error("Error verifying admin:", error)
      return NextResponse.json({ message: "Admin verification failed" }, { status: 401 })
    }

    // Check if email already exists
    try {
      await adminAuth.getUserByEmail(email)
      return NextResponse.json({ message: "Bu email allaqachon ro'yxatdan o'tgan" }, { status: 409 })
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        console.error("Error checking existing user:", error)
        return NextResponse.json({ message: "Foydalanuvchini tekshirishda xatolik yuz berdi" }, { status: 500 })
      }
    }

    // Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    })

    console.log("User created in Auth:", userRecord.uid)

    // Set custom claims for the role
    await adminAuth.setCustomUserClaims(userRecord.uid, { role })

    // Add user data to Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      email,
      role,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log("User data saved to Firestore")

    return NextResponse.json({ message: "User created successfully", uid: userRecord.uid }, { status: 200 })
  } catch (error: any) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: error.message || "Failed to create user" }, { status: 500 })
  }
}

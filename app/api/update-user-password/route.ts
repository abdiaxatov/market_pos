import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { uid, newPassword, adminUid } = await req.json()

    console.log("Update password request received:", { uid, adminUid })

    if (!uid || !newPassword || !adminUid) {
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
        return NextResponse.json({ message: "Unauthorized: Only admins can update user passwords" }, { status: 403 })
      }
    } catch (error) {
      console.error("Error verifying admin:", error)
      return NextResponse.json({ message: "Admin verification failed" }, { status: 401 })
    }

    // Update the user's password
    await adminAuth.updateUser(uid, {
      password: newPassword,
    })

    console.log("Password updated for user:", uid)

    return NextResponse.json({ message: "User password updated successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("Error updating user password:", error)
    return NextResponse.json({ message: error.message || "Failed to update user password" }, { status: 500 })
  }
}

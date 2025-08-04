import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { uid, adminUid } = await req.json()

    console.log("Delete user request received:", { uid, adminUid })

    if (!uid || !adminUid) {
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
        return NextResponse.json({ message: "Unauthorized: Only admins can delete users" }, { status: 403 })
      }
    } catch (error) {
      console.error("Error verifying admin:", error)
      return NextResponse.json({ message: "Admin verification failed" }, { status: 401 })
    }

    // Prevent admin from deleting themselves
    if (uid === adminUid) {
      return NextResponse.json({ message: "You cannot delete your own admin account." }, { status: 403 })
    }

    // Get user data before deletion for logging
    let userEmail = "unknown"
    try {
      const userDoc = await adminDb.collection("users").doc(uid).get()
      const userData = userDoc.data()
      userEmail = userData?.email || "unknown"
    } catch (error) {
      console.log("Could not get user data before deletion")
    }

    // Delete user from Firebase Authentication
    try {
      await adminAuth.deleteUser(uid)
      console.log("User deleted from Auth:", uid, userEmail)
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        console.log("User not found in Auth, continuing with Firestore deletion")
      } else {
        console.error("Error deleting from Auth:", error)
        // Continue with Firestore deletion even if Auth deletion fails
      }
    }

    // Delete user data from Firestore
    try {
      await adminDb.collection("users").doc(uid).delete()
      console.log("User deleted from Firestore:", uid, userEmail)
    } catch (error) {
      console.error("Error deleting from Firestore:", error)
      return NextResponse.json({ message: "Failed to delete user from database" }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: "User deleted successfully",
        deletedUser: { uid, email: userEmail },
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ message: error.message || "Failed to delete user" }, { status: 500 })
  }
}

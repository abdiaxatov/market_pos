// Device fingerprinting utility
export function getDeviceId(): string {
  if (typeof window === "undefined") return ""

  try {
    // Check if we already have a device ID stored
    let deviceId = localStorage.getItem("deviceId")

    if (!deviceId) {
      // Generate a new device ID based on browser characteristics
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      ctx!.textBaseline = "top"
      ctx!.font = "14px Arial"
      ctx!.fillText("Device fingerprint", 2, 2)

      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        navigator.hardwareConcurrency || 0,
        navigator.deviceMemory || 0,
      ].join("|")

      // Create a simple hash
      let hash = 0
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32-bit integer
      }

      deviceId = Math.abs(hash).toString(36) + Date.now().toString(36)
      localStorage.setItem("deviceId", deviceId)
    }

    return deviceId
  } catch (error) {
    console.error("Error generating device ID:", error)
    // Fallback to timestamp-based ID
    const fallbackId = "fallback_" + Date.now().toString(36) + Math.random().toString(36).substr(2)
    localStorage.setItem("deviceId", fallbackId)
    return fallbackId
  }
}

// Get user signature (combination of device ID and other identifiers)
export function getUserSignature(): string {
  const deviceId = getDeviceId()
  const userPhone = localStorage.getItem("userPhone") || ""
  const sessionId = sessionStorage.getItem("sessionId") || Date.now().toString()

  return `${deviceId}_${userPhone}_${sessionId}`.replace(/[^a-zA-Z0-9_]/g, "")
}

// Check if device is blocked
export async function isDeviceBlocked(deviceId: string): Promise<boolean> {
  try {
    const { collection, query, where, getDocs } = await import("firebase/firestore")
    const { db } = await import("@/lib/firebase")

    const blockedQuery = query(
      collection(db, "blockedDevices"),
      where("deviceId", "==", deviceId),
      where("unblocked", "==", false),
    )

    const snapshot = await getDocs(blockedQuery)
    return !snapshot.empty
  } catch (error) {
    console.error("Error checking device block status:", error)
    return false
  }
}

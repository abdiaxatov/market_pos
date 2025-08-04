// Global stream reference for camera
export const streamRef = { current: null as MediaStream | null }

// Set stream function
export const setStream = (stream: MediaStream | null) => {
  streamRef.current = stream
}

// Stop camera stream function
export const stopCameraStream = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }
}

// Check if we're in browser environment
export const isBrowser = () => {
  return typeof window !== "undefined" && typeof navigator !== "undefined"
}

// Check camera support with better mobile detection
export const checkCameraSupport = (): { supported: boolean; error?: string } => {
  if (!isBrowser()) {
    return { supported: false, error: "Server side rendering" }
  }

  // Check if navigator exists
  if (!navigator) {
    return { supported: false, error: "Navigator mavjud emas" }
  }

  // Check if mediaDevices exists
  if (!navigator.mediaDevices) {
    return { supported: false, error: "MediaDevices API qo'llab-quvvatlanmaydi" }
  }

  // Check if getUserMedia exists
  if (!navigator.mediaDevices.getUserMedia) {
    return { supported: false, error: "getUserMedia qo'llab-quvvatlanmaydi" }
  }

  // Check HTTPS requirement (except localhost)
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    return { supported: false, error: "Kamera uchun HTTPS kerak" }
  }

  return { supported: true }
}

// Get available cameras
export const getAvailableCameras = async (): Promise<MediaDeviceInfo[]> => {
  if (!isBrowser() || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return []
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === "videoinput")
  } catch (error) {
    console.error("Error getting cameras:", error)
    return []
  }
}

// Check if device has multiple cameras
export const hasMultipleCameras = async (): Promise<boolean> => {
  const cameras = await getAvailableCameras()
  return cameras.length > 1
}

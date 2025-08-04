"use client"

import { Suspense, useRef, useState, useEffect, useCallback, memo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, ContactShadows, Html, PerspectiveCamera } from "@react-three/drei"
import { Button } from "@/components/ui/button"
import { Camera, Square, Loader2, Download, RotateCcw, AlertCircle, Layers, SwitchCamera, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { streamRef, checkCameraSupport, stopCameraStream } from "./streamRef"
import Image from "next/image"
import type * as THREE from "three"

interface ThreeDViewerProps {
  modelUrl?: string
  itemName: string
  fallbackImage?: string
}

/* ---------- 3D MODEL WITH ERROR HANDLING ---------- */
function Model({ modelUrl, autoRotate, scale }: { modelUrl?: string; autoRotate: boolean; scale: number }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const ref = useRef<THREE.Object3D>(null)
  const gltf = useGLTF(modelUrl || "")

  useEffect(() => {
    if (!modelUrl || modelUrl.trim() === "") {
      setError("Model URL mavjud emas")
      setLoading(false)
      return
    }

    if (gltf && gltf.scene) {
      setLoading(false)
      setError(null)
    } else {
      // Set a timeout to handle loading failures
      const timer = setTimeout(() => {
        setError("3D model yuklanmadi")
        setLoading(false)
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [modelUrl, gltf])

  useFrame(() => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += 0.005
    }
  })

  if (loading && modelUrl) {
    return (
      <Html center>
        <div className="bg-white/95 rounded-xl p-4 flex items-center gap-3 shadow-lg">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Model yuklanmoqda...</span>
        </div>
      </Html>
    )
  }

  if (error || !modelUrl || !gltf || !gltf.scene) {
    return <FallbackShape autoRotate={autoRotate} scale={scale} />
  }

  return <primitive ref={ref} object={gltf.scene.clone()} scale={[scale, scale, scale]} position={[0, 0, 0]} />
}

/* ---------- FALLBACK 3D SHAPE ---------- */
function FallbackShape({ autoRotate, scale }: { autoRotate: boolean; scale: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += 0.005
      ref.current.rotation.x += 0.002
    }
  })

  return (
    <mesh ref={ref} scale={[scale, scale, scale]} position={[0, 0, 0]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ff6b6b" roughness={0.3} metalness={0.1} />
    </mesh>
  )
}

/* ---------- SCREENSHOT HANDLER ---------- */
function ScreenshotHandler({ onComplete }: { onComplete: () => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    try {
      // Render current frame
      gl.render(scene, camera)

      // Get canvas and create download link
      const canvas = gl.domElement
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.download = `3d-model-${Date.now()}.png`
            link.href = url
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }
        },
        "image/png",
        1.0,
      )
    } catch (error) {
      console.error("Screenshot error:", error)
    } finally {
      onComplete()
    }
  }, [gl, scene, camera, onComplete])

  return null
}

/* ---------- OPTIMIZED CAMERA BACKGROUND ---------- */
const CameraBackground = memo(function CameraBackground({
  isActive,
  onPermissionChange,
  onError,
  facingMode,
}: {
  isActive: boolean
  onPermissionChange: (status: "granted" | "denied") => void
  onError: (error: string) => void
  facingMode: "user" | "environment"
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsReady(false)
    setIsLoading(false)
  }, [])

  const startCamera = useCallback(async () => {
    if (!isActive) return

    // Check camera support first
    const cameraSupport = checkCameraSupport()
    if (!cameraSupport.supported) {
      onError(cameraSupport.error || "Kamera qo'llab-quvvatlanmaydi")
      onPermissionChange("denied")
      return
    }

    // Stop existing stream
    stopCamera()

    setIsLoading(true)
    setIsReady(false)

    try {
      const constraints = {
        video: {
          width: { ideal: window.innerWidth > 768 ? 1920 : 1280 },
          height: { ideal: window.innerWidth > 768 ? 1080 : 720 },
          facingMode: facingMode,
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream

        const handleLoadedMetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                setIsReady(true)
                setIsLoading(false)
                onPermissionChange("granted")
              })
              .catch((error) => {
                console.error("Video play error:", error)
                onError("Video ijro etishda xatolik")
                setIsLoading(false)
              })
          }
        }

        const handleError = (error: Event) => {
          console.error("Video error:", error)
          onError("Video xatoligi yuz berdi")
          setIsLoading(false)
        }

        videoRef.current.onloadedmetadata = handleLoadedMetadata
        videoRef.current.onerror = handleError
      }
    } catch (error: any) {
      console.error("Camera error:", error)
      setIsLoading(false)

      let errorMessage = "Kamera xatoligi"
      if (error.name === "NotAllowedError") {
        errorMessage = "Kamera ruxsati berilmadi"
      } else if (error.name === "NotFoundError") {
        errorMessage = "Kamera topilmadi"
      } else if (error.name === "NotSupportedError") {
        errorMessage = "Kamera qo'llab-quvvatlanmaydi"
      } else if (error.name === "NotReadableError") {
        errorMessage = "Kamera band yoki ishlamayapti"
      } else if (error.name === "OverconstrainedError") {
        errorMessage = "Kamera talablari qo'llab-quvvatlanmaydi"
      }

      onError(errorMessage)
      onPermissionChange("denied")
    }
  }, [isActive, onPermissionChange, onError, facingMode, stopCamera])

  useEffect(() => {
    if (isActive) {
      startCamera()
    } else {
      stopCamera()
    }

    // Cleanup on unmount
    return () => stopCamera()
  }, [isActive, facingMode, startCamera, stopCamera])

  if (!isActive) return null

  return (
    <>
      <div className="fixed inset-0 -z-10 bg-black">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isReady ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          playsInline
          muted
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "scaleX(1)" }}
        />
      </div>

      {isLoading && (
        <div className="fixed inset-0 -z-5 bg-black/50 flex items-center justify-center">
          <div className="bg-white/95 rounded-xl p-4 flex items-center gap-3 mx-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm font-medium">
              {facingMode === "user" ? "Old" : "Orqa"} kamera ishga tushmoqda...
            </span>
          </div>
        </div>
      )}
    </>
  )
})

/* ---------- MAIN COMPONENT ---------- */
export function ThreeDViewer({ modelUrl, itemName, fallbackImage }: ThreeDViewerProps) {
  const [showCamera, setShowCamera] = useState(false)
  const [cameraPermission, setCameraPermission] = useState<"prompt" | "granted" | "denied">("prompt")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [showShadows, setShowShadows] = useState(true)
  const [takeScreenshot, setTakeScreenshot] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [modelError, setModelError] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [cameraSupported, setCameraSupported] = useState(true)
  const { toast } = useToast()

  // Check camera support on mount
  useEffect(() => {
    const support = checkCameraSupport()
    setCameraSupported(support.supported)
    if (!support.supported && support.error) {
      setCameraError(support.error)
    }
  }, [])

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Auto-hide controls on mobile after 5 seconds
  useEffect(() => {
    if (!isMobile || !showControls) return
    const timer = setTimeout(() => setShowControls(false), 5000)
    return () => clearTimeout(timer)
  }, [isMobile, showControls])

  // Show controls when camera mode changes
  useEffect(() => {
    setShowControls(true)
  }, [showCamera])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  const handleCameraToggle = useCallback(async () => {
    if (!cameraSupported) {
      toast({
        title: "Kamera mavjud emas",
        description: cameraError || "Kamera qo'llab-quvvatlanmaydi",
        variant: "destructive",
      })
      return
    }

    if (cameraPermission === "denied") {
      toast({
        title: "Kamera ruxsati yo'q",
        description: "Brauzer sozlamalarida kamera ruxsatini yoqing",
        variant: "destructive",
      })
      return
    }

    setIsTransitioning(true)
    setCameraError(null)

    setTimeout(() => {
      setShowCamera((prev) => !prev)
      setIsTransitioning(false)
    }, 200)
  }, [cameraSupported, cameraPermission, cameraError, toast])

  const handlePermissionChange = useCallback((status: "granted" | "denied") => {
    setCameraPermission(status)
  }, [])

  const handleCameraError = useCallback(
    (error: string) => {
      setCameraError(error)
      setShowCamera(false)
      toast({
        title: "Kamera xatoligi",
        description: error,
        variant: "destructive",
      })
    },
    [toast],
  )

  const handleScreenshot = useCallback(() => {
    setTakeScreenshot(true)
    toast({
      title: "Rasm saqlandi",
      description: "3D model rasmi yuklab olindi",
    })
  }, [toast])

  const handleScreenshotComplete = useCallback(() => {
    setTakeScreenshot(false)
  }, [])

  const resetView = useCallback(() => {
    setAutoRotate(true)
    toast({
      title: "Ko'rinish tiklandi",
      description: "Avtomatik aylanish yoqildi",
    })
  }, [toast])

  const handleCameraSwitch = useCallback(() => {
    const newMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(newMode)
    toast({
      title: "Kamera almashtirildi",
      description: newMode === "user" ? "Old kamera" : "Orqa kamera",
    })
  }, [facingMode, toast])

  const exitCameraMode = useCallback(() => {
    setShowCamera(false)
    setCameraError(null)
    stopCameraStream()
    toast({
      title: "AR rejimi o'chirildi",
      description: "Oddiy ko'rinishga qaytildi",
    })
  }, [toast])

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev)
  }, [])

  useEffect(() => {
    if (!modelUrl || modelUrl.trim() === "") {
      setModelError(true)
    } else {
      setModelError(false)
    }
  }, [modelUrl])

  // Show fallback image if no 3D model
  if (!modelUrl || modelUrl.trim() === "") {
    return (
      <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            {fallbackImage && (
              <Image
                src={fallbackImage || "/placeholder.svg"}
                alt={itemName}
                width={400}
                height={400}
                className="mx-auto mb-4 rounded-lg shadow-lg"
              />
            )}
            <h2 className="text-2xl font-bold mb-2">{itemName}</h2>
            <p className="text-muted-foreground">3D model mavjud emas</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-100">
      {/* Camera Background */}
      <CameraBackground
        isActive={showCamera && cameraSupported}
        onPermissionChange={handlePermissionChange}
        onError={handleCameraError}
        facingMode={facingMode}
      />

      {/* 3D Canvas */}
      <div
        className={`w-full h-full transition-all duration-500 ${
          !showCamera ? "bg-gradient-to-br from-gray-50 via-white to-blue-50" : ""
        }`}
        onClick={() => isMobile && toggleControls()}
      >
        <Canvas
          shadows
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
          }}
          dpr={[1, isMobile ? 1.5 : 2]}
          onError={() => setModelError(true)}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={isMobile ? 65 : 50} />

          {/* Dynamic Lighting */}
          <ambientLight intensity={showCamera ? 0.7 : 0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={showCamera ? 1.2 : 1}
            castShadow
            shadow-mapSize-width={isMobile ? 1024 : 2048}
            shadow-mapSize-height={isMobile ? 1024 : 2048}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          <spotLight position={[0, 10, 0]} angle={0.3} penumbra={1} intensity={showCamera ? 0.8 : 0.5} castShadow />

          <Suspense
            fallback={
              <Html center>
                <div className="bg-white/95 rounded-xl p-4 flex items-center gap-3 shadow-lg backdrop-blur-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-sm md:text-base font-medium">3D model yuklanmoqda...</span>
                </div>
              </Html>
            }
          >
            <Model modelUrl={modelUrl} autoRotate={autoRotate} scale={isMobile ? 1.8 : 2} />
            {showShadows && (
              <ContactShadows position={[0, -1.5, 0]} opacity={showCamera ? 0.6 : 0.4} scale={10} blur={2} far={4} />
            )}
            <Environment preset="studio" intensity={showCamera ? 0.8 : 1} />
          </Suspense>

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1.5}
            maxDistance={12}
            maxPolarAngle={Math.PI / 1.8}
            minPolarAngle={Math.PI / 6}
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={isMobile ? 0.8 : 1}
            zoomSpeed={isMobile ? 0.8 : 1}
            panSpeed={isMobile ? 0.8 : 1}
          />

          {takeScreenshot && <ScreenshotHandler onComplete={handleScreenshotComplete} />}
        </Canvas>
      </div>

      {/* Camera Exit Button - Top Left */}
      {showCamera && (
        <div className="absolute top-4 left-4 z-30">
          <Button
            onClick={exitCameraMode}
            variant="outline"
            size="sm"
            className="bg-red-500/80 hover:bg-red-600/80 text-white border-2 border-red-400/40 backdrop-blur-sm rounded-xl w-12 h-12 p-0 flex items-center justify-center shadow-lg"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Camera Switch Button - Top Right */}
      {showCamera && cameraPermission === "granted" && (
        <div className="absolute top-4 right-4 z-30">
          <Button
            onClick={handleCameraSwitch}
            variant="outline"
            size="sm"
            className="bg-blue-500/80 hover:bg-blue-600/80 text-white border-2 border-blue-400/40 backdrop-blur-sm rounded-xl w-12 h-12 p-0 flex items-center justify-center shadow-lg"
          >
            <SwitchCamera className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Error Notifications */}
      {modelError && (
        <div className="absolute top-20 left-4 right-4 z-30">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-xl shadow-lg max-w-md mx-auto backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <div>
                <div className="font-medium">3D model yuklanmadi</div>
                <div className="text-sm">Fallback shakl ko'rsatilmoqda</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {cameraError && !showCamera && (
        <div className="absolute top-20 left-4 right-4 z-30">
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl shadow-lg max-w-md mx-auto backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <div>
                <div className="font-medium">Kamera xatoligi</div>
                <div className="text-sm">{cameraError}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Indicator */}
      {isMobile && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-black/40 text-white px-6 py-3 rounded-2xl text-sm animate-pulse backdrop-blur-sm border border-white/20">
            Ekranga teging - boshqaruv
          </div>
        </div>
      )}

      {/* Mobile-Optimized Bottom Controls */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div
          className={`${
            showCamera
              ? "bg-white/20 backdrop-blur-md border border-white/30"
              : "bg-white/95 backdrop-blur-sm border border-gray-200"
          } rounded-2xl p-4 shadow-2xl transition-all duration-300 max-w-sm mx-auto`}
        >
          {/* Main Controls Row */}
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={handleCameraToggle}
              variant={showCamera ? "default" : "outline"}
              size="default"
              disabled={!cameraSupported || isTransitioning}
              className={`
                w-14 h-14 rounded-xl transition-all duration-200 font-medium flex flex-col items-center justify-center gap-1
                ${
                  showCamera
                    ? "bg-red-500/80 hover:bg-red-600/80 text-white border-red-500/50 backdrop-blur-sm"
                    : cameraSupported
                      ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
                      : "bg-gray-400 text-gray-200 cursor-not-allowed"
                }
                ${isTransitioning ? "opacity-50" : ""}
              `}
            >
              {isTransitioning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : showCamera ? (
                <>
                  <Square className="w-5 h-5" />
                  <span className="text-xs">Stop</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span className="text-xs">AR</span>
                </>
              )}
            </Button>

            <Button
              onClick={handleScreenshot}
              variant="outline"
              size="default"
              className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 ${
                showCamera
                  ? "bg-white/20 hover:bg-white/30 text-white border-2 border-white/40 backdrop-blur-sm"
                  : "bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
              }`}
            >
              <Download className="w-5 h-5" />
              <span className="text-xs">Rasm</span>
            </Button>

            <Button
              onClick={() => setAutoRotate(!autoRotate)}
              variant={autoRotate ? "default" : "outline"}
              size="default"
              className={`
                w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1
                ${
                  showCamera
                    ? autoRotate
                      ? "bg-blue-500/80 text-white backdrop-blur-sm"
                      : "bg-white/20 text-white border-2 border-white/40 backdrop-blur-sm"
                    : autoRotate
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-800 border-2 border-gray-300"
                }
              `}
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs">Auto</span>
            </Button>

            <Button
              onClick={() => setShowShadows(!showShadows)}
              variant={showShadows ? "default" : "outline"}
              size="default"
              className={`
                w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1
                ${
                  showCamera
                    ? showShadows
                      ? "bg-green-500/80 text-white backdrop-blur-sm"
                      : "bg-white/20 text-white border-2 border-white/40 backdrop-blur-sm"
                    : showShadows
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 text-gray-800 border-2 border-gray-300"
                }
              `}
            >
              <Layers className="w-5 h-5" />
              <span className="text-xs">Soya</span>
            </Button>

            <Button
              onClick={resetView}
              variant="outline"
              size="default"
              className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 ${
                showCamera
                  ? "bg-white/20 text-white border-2 border-white/40 backdrop-blur-sm hover:bg-white/30"
                  : "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs">Reset</span>
            </Button>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-opacity-20 border-gray-400">
            {showCamera && cameraPermission === "granted" && (
              <div className="bg-green-500/20 text-green-100 px-3 py-1 rounded-full text-xs flex items-center gap-1 backdrop-blur-sm border border-green-400/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                AR faol ({facingMode === "user" ? "Old" : "Orqa"})
              </div>
            )}
            {!cameraSupported && (
              <div
                className={`px-3 py-1 rounded-full text-xs ${
                  showCamera
                    ? "bg-red-500/20 text-red-100 backdrop-blur-sm border border-red-400/30"
                    : "bg-red-100 text-red-800 border border-red-200"
                }`}
              >
                Kamera yo'q
              </div>
            )}
            {modelError && (
              <div
                className={`px-3 py-1 rounded-full text-xs ${
                  showCamera
                    ? "bg-yellow-500/20 text-yellow-100 backdrop-blur-sm border border-yellow-400/30"
                    : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                }`}
              >
                Fallback
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

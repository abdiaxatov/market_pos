"use client"

import { Suspense, useRef, useState, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from "@react-three/drei"
import { Loader2 } from "lucide-react"
import type * as THREE from "three"

interface EmbeddedModelViewerProps {
  modelUrl?: string
  className?: string
  autoRotate?: boolean
  showShadows?: boolean
  scale?: number
}

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
        setError("Model yuklanmadi")
        setLoading(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [modelUrl, gltf])

  useFrame(() => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += 0.01
    }
  })

  if (loading && modelUrl) {
    return (
      <Html center>
        <div className="bg-white/95 rounded-lg p-2 flex items-center gap-2 shadow-md">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-xs font-medium">Yuklanmoqda...</span>
        </div>
      </Html>
    )
  }

  if (error || !modelUrl || !gltf || !gltf.scene) {
    return <FallbackShape autoRotate={autoRotate} scale={scale} />
  }

  return <primitive ref={ref} object={gltf.scene.clone()} scale={[scale, scale, scale]} position={[0, 0, 0]} />
}

function FallbackShape({ autoRotate, scale }: { autoRotate: boolean; scale: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += 0.01
      ref.current.rotation.x += 0.005
    }
  })

  return (
    <mesh ref={ref} scale={[scale, scale, scale]} position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.1} />
    </mesh>
  )
}

export default function EmbeddedModelViewer({
  modelUrl,
  className = "w-full h-full",
  autoRotate = true,
  showShadows = true,
  scale = 1,
}: EmbeddedModelViewerProps) {
  // Don't render Canvas if no valid modelUrl
  if (!modelUrl || modelUrl.trim() === "") {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">📦</div>
          <p className="text-sm">3D model mavjud emas</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <Canvas
        shadows
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0, 3], fov: 50 }}
        dpr={[1, 1.5]}
        onError={(error) => {
          console.error("Canvas error:", error)
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-5, -5, -5]} intensity={0.2} />

        <Suspense
          fallback={
            <Html center>
              <div className="bg-white/95 rounded-lg p-2 flex items-center gap-2 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium">3D model...</span>
              </div>
            </Html>
          }
        >
          <Model modelUrl={modelUrl} autoRotate={autoRotate} scale={scale} />
          {showShadows && <ContactShadows position={[0, -1, 0]} opacity={0.3} scale={5} blur={1} far={2} />}
          <Environment preset="apartment" intensity={0.6} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={6}
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 6}
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.8}
          zoomSpeed={0.8}
        />
      </Canvas>
    </div>
  )
}

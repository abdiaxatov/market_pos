"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Menu, Loader2, AlertCircle, Home } from "lucide-react"
import ModelViewer from "@/components/3d-model-viewer"
import { useToast } from "@/components/ui/use-toast"
import type { MenuItem } from "@/types"

export default function ThreeDViewPage() {
  const params = useParams()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchItem = async () => {
      try {
        if (!params.itemId) {
          setError("Mahsulot ID topilmadi")
          return
        }

        const itemDoc = await getDoc(doc(db, "menuItems", params.itemId as string))

        if (!itemDoc.exists()) {
          setError("Mahsulot topilmadi")
          return
        }

        const itemData = itemDoc.data()

        // Comprehensive data mapping with fallbacks
        const menuItem: MenuItem = {
          id: itemDoc.id,
          name: itemData.name || "Noma'lum mahsulot",
          description: itemData.description || "",
          price: typeof itemData.price === "number" ? itemData.price : 0,
          category: itemData.category || "",
          categoryId: itemData.categoryId || "",
          image: itemData.imageUrl || itemData.image || "/placeholder.svg?height=300&width=300",
          imageUrl: itemData.imageUrl || itemData.image || "/placeholder.svg?height=300&width=300",
          available: itemData.isAvailable !== false && itemData.available !== false,
          isAvailable: itemData.isAvailable !== false && itemData.available !== false,
          preparationTime: itemData.preparationTime || 0,
          ingredients: Array.isArray(itemData.ingredients) ? itemData.ingredients : [],
          allergens: Array.isArray(itemData.allergens) ? itemData.allergens : [],
          remainingServings: typeof itemData.remainingServings === "number" ? itemData.remainingServings : null,
          servesCount: typeof itemData.servesCount === "number" ? itemData.servesCount : null,
          needsContainer: Boolean(itemData.needsContainer),
          containerPrice: typeof itemData.containerPrice === "number" ? itemData.containerPrice : 0,
          modelUrl: itemData.modelUrl || null,
          createdAt: itemData.createdAt || null,
          updatedAt: itemData.updatedAt || null,
        }

        setItem(menuItem)

        // Show success toast
        toast({
          title: "Mahsulot yuklandi",
          description: `${menuItem.name} 3D ko'rinishiga xush kelibsiz`,
        })
      } catch (err) {
        console.error("Error fetching item:", err)
        const errorMessage = "Mahsulotni yuklashda xatolik yuz berdi"
        setError(errorMessage)

        toast({
          title: "Xatolik",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchItem()
  }, [params.itemId, toast])

  const handleBack = () => {
    try {
      router.back()
    } catch {
      router.push("/menu")
    }
  }

  const handleGoToMenu = () => {
    router.push("/menu")
  }

  const handleGoHome = () => {
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
         <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b p-4 sticky top-0 z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center gap-2 hover:bg-gray-100 rounded-xl px-3 py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Orqaga</span>
            </Button>

            <h1 className="font-semibold text-lg text-center flex-1 px-4">3D Ko'rish</h1>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleGoToMenu}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-xl px-3 py-2"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Menyu</span>
              </Button>

              <Button
                variant="ghost"
                onClick={handleGoHome}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-xl px-3 py-2"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Bosh sahifa</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Error Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-md w-full mx-4 border border-gray-100">
            <div className="text-red-500 mb-6">
              <AlertCircle className="w-16 h-16 mx-auto" />
            </div>

            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Xatolik yuz berdi</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>

            <div className="space-y-3">
              <Button onClick={handleBack} className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-3">
                Orqaga qaytish
              </Button>

              <Button
                onClick={handleGoToMenu}
                variant="outline"
                className="w-full border-gray-300 hover:bg-gray-50 rounded-xl py-3 bg-transparent"
              >
                Menyuga o'tish
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 3D Viewer - Full screen */}
      <div className="flex-1 relative overflow-hidden">
        <ModelViewer modelUrl={item.modelUrl} itemName={item.name} className="w-full h-full" />
      </div>

      {/* Item Info Overlay (Mobile) */}
      {item.description && (
        <div className="absolute top-20 left-4 right-4 z-10 md:hidden">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-200">
            <p className="text-sm text-gray-700 line-clamp-2">{item.description}</p>
            {item.price > 0 && (
              <p className="text-lg font-semibold text-blue-600 mt-1">{item.price.toLocaleString()} so'm</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

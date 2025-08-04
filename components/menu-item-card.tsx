"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, Box } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Suspense } from "react"
import dynamic from "next/dynamic"

// Dynamically import the 3D viewer to avoid SSR issues
const ModelViewer = dynamic(() => import("@/components/model-viewer"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64">Loading 3D Model...</div>,
})

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  image?: string
  model3d?: string
  available: boolean
  category: string
}

interface MenuItemCardProps {
  item: MenuItem
}

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { addItem, items, updateQuantity } = useCart()
  const [show3DModal, setShow3DModal] = useState(false)

  const cartItem = items.find((cartItem) => cartItem.id === item.id)
  const quantity = cartItem?.quantity || 0

  const handleAddToCart = () => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
    })
  }

  const handleUpdateQuantity = (newQuantity: number) => {
    if (newQuantity <= 0) {
      updateQuantity(item.id, 0)
    } else {
      updateQuantity(item.id, newQuantity)
    }
  }

  return (
    <>
      <Card
        className={`overflow-hidden transition-all duration-200 hover:shadow-lg ${!item.available ? "opacity-60" : ""}`}
      >
        <div className="relative">
          <img
            src={item.image || "/placeholder.svg?height=200&width=300"}
            alt={item.name}
            className="w-full h-48 object-cover"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg?height=200&width=300"
            }}
          />

          {/* 3D Model Button */}
          {item.model3d && (
            <Button
              onClick={() => setShow3DModal(true)}
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-800 shadow-md"
            >
              <Box className="h-4 w-4 mr-1" />
              3D
            </Button>
          )}

          {!item.available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm">
                Mavjud emas
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg line-clamp-1">{item.name}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">{item.price.toLocaleString()} so'm</span>

              {item.available && (
                <div className="flex items-center gap-2">
                  {quantity > 0 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateQuantity(quantity - 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-medium min-w-[20px] text-center">{quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateQuantity(quantity + 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={handleAddToCart}>
                      <Plus className="h-4 w-4 mr-1" />
                      Qo'shish
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3D Model Modal */}
      <Dialog open={show3DModal} onOpenChange={setShow3DModal}>
        <DialogContent className="max-w-4xl h-[80vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              {item.name} - 3D Ko'rinish
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 pt-2">
            {item.model3d && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Box className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                      <p>3D model yuklanmoqda...</p>
                    </div>
                  </div>
                }
              >
                <div className="w-full h-full rounded-lg overflow-hidden bg-gray-50">
                  <ModelViewer modelUrl={item.model3d} />
                </div>
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

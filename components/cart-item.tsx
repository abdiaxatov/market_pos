"use client"

import { useState } from "react"
import Image from "next/image"
import { useCart } from "@/components/cart-provider"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Minus, Plus, Trash2 } from "lucide-react"
import type { CartItem as CartItemType } from "@/types"
import { motion } from "framer-motion"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/components/ui/use-toast"
import type { MenuItem } from "@/types"

interface CartItemProps {
  item: CartItemType
}

export function CartItem({ item }: CartItemProps) {
  const { updateItemQuantity, removeItem } = useCart()
  const [isRemoving, setIsRemoving] = useState(false)
  const handleIncrement = async () => {
    // Mahsulotning hozirgi qolgan miqdorini tekshirish
    try {
      const menuItemRef = doc(db, "menuItems", item.id)
      const menuItemSnap = await getDoc(menuItemRef)

      if (menuItemSnap.exists()) {
        const menuItemData = menuItemSnap.data() as MenuItem
        const remainingServings =
          menuItemData.remainingServings !== undefined ? menuItemData.remainingServings : menuItemData.servesCount

        // Agar qo'shiladigan miqdor qolgan miqdordan ko'p bo'lsa, xatolik chiqarish
        if (item.quantity + 1 > remainingServings) {
          // Xatolik tovushini ijro etish
          const audio = new Audio("/notification.mp3")
          audio.play().catch((e) => console.error("Error playing sound:", e))

          // Xatolik xabarini ko'rsatish
          toast({
            title: "Yetarli porsiya yo'q",
            description: `Kechirasiz, ${item.name} taomidan faqat ${remainingServings} porsiya qolgan.`,
            variant: "destructive",
          })
          return
        }
      }
    } catch (error) {
      console.error("Error checking remaining servings:", error)
    }

    // Tovush ijro etish
    const audio = new Audio("/click.mp3")
    audio.play().catch((e) => console.error("Error playing sound:", e))

    // Miqdorni oshirish
    updateItemQuantity(item.id, item.quantity + 1)
  }

  const handleDecrement = () => {
    if (item.quantity <= 1) {
      handleRemove()
      return
    }
    // Play click sound
    const audio = new Audio("/click.mp3")
    audio.play().catch((e) => console.error("Error playing sound:", e))
    updateItemQuantity(item.id, item.quantity - 1)
  }

  const handleRemove = () => {
    setIsRemoving(true)
    // Play delete sound
    const audio = new Audio("/notification.mp3")
    audio.play().catch((e) => console.error("Error playing sound:", e))

    // Small delay to allow animation to play
    setTimeout(() => {
      removeItem(item.id)
    }, 300)
  }

  return (
    <motion.div
      className="mb-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      transition={{ duration: 0.3 }}
      layout
    >
      <motion.div
        className={`flex items-center rounded-lg border bg-card p-3 shadow-sm ${isRemoving ? "opacity-50" : ""}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        animate={{ x: isRemoving ? 100 : 0, opacity: isRemoving ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl || "/placeholder.svg"}
              alt={item.name}
              fill
              className="object-cover"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.svg?height=64&width=64"
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">No img</div>
          )}
        </div>

        <div className="ml-3 flex-1">
          <div className="flex items-start justify-between">
            <h3 className="font-medium">{item.name}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove</span>
            </Button>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm font-medium">{formatCurrency(item.price)}</p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={handleDecrement}
                disabled={isRemoving}
              >
                <Minus className="h-3 w-3" />
                <span className="sr-only">Decrease</span>
              </Button>
              <span className="w-6 text-center">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={handleIncrement}
                disabled={isRemoving}
              >
                <Plus className="h-3 w-3" />
                <span className="sr-only">Increase</span>
              </Button>
            </div>
          </div>

          <div className="mt-1 text-right text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</div>
        </div>
      </motion.div>
    </motion.div>
  )
}

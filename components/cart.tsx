"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import type { CartItem, MenuItem } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Trash2, ShoppingBag } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface CartProps {
  items: CartItem[]
  updateQuantity: (id: string, quantity: number) => void
}

export function Cart({ items, updateQuantity }: CartProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const tableNumber = typeof window !== "undefined" ? sessionStorage.getItem("tableNumber") : null

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handlePlaceOrder = useCallback(async () => {
    if (items.length === 0) {
      toast({
        title: "Bo'sh savat",
        description: "Iltimos, buyurtma berish uchun savatga mahsulot qo'shing.",
        variant: "destructive",
      })
      return
    }

    if (!tableNumber) {
      toast({
        title: "Stol raqami yo'q",
        description: "Iltimos, orqaga qaytib stol raqamingizni kiriting.",
        variant: "destructive",
      })
      router.push("/")
      return
    }

    setIsSubmitting(true)

    try {
      // Check if items have enough servings
      for (const item of items) {
        const menuItemRef = doc(db, "menuItems", item.id)
        const menuItemSnap = await getDoc(menuItemRef)

        if (menuItemSnap.exists()) {
          const menuItemData = menuItemSnap.data() as MenuItem
          const remainingServings = menuItemData.remainingServings || menuItemData.servesCount

          if (remainingServings < item.quantity) {
            toast({
              title: "Yetarli porsiya yo'q",
              description: `Kechirasiz, ${item.name} faqat ${remainingServings} porsiya mavjud.`,
              variant: "destructive",
            })
            setIsSubmitting(false)
            return
          }
        }
      }

      // Prepare order data
      const orderData = {
        tableNumber: Number.parseInt(tableNumber),
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total,
        status: "pending",
        createdAt: serverTimestamp(),
        orderType: "table",
      }

      // Add order to Firestore
      const orderRef = await addDoc(collection(db, "orders"), orderData)

      // Update remaining servings for each item
      for (const item of items) {
        const menuItemRef = doc(db, "menuItems", item.id)
        const menuItemSnap = await getDoc(menuItemRef)

        if (menuItemSnap.exists()) {
          const menuItemData = menuItemSnap.data() as MenuItem
          const remainingServings = (menuItemData.remainingServings || menuItemData.servesCount) - item.quantity

          await updateDoc(menuItemRef, {
            remainingServings: remainingServings > 0 ? remainingServings : 0,
          })
        }
      }

      // Store order ID in localStorage for "My Orders" page
      const myOrders = JSON.parse(localStorage.getItem("myOrders") || "[]")
      myOrders.push(orderRef.id)
      localStorage.setItem("myOrders", JSON.stringify(myOrders))

      // Play success sound
      const audio = new Audio("/success.mp3")
      audio.play().catch((e) => console.error("Error playing sound:", e))

      toast({
        title: "Buyurtma muvaffaqiyatli joylashtirildi!",
        description: "Sizning buyurtmangiz oshxonaga yuborildi.",
      })

      // Clear cart and redirect to confirmation page
      setTimeout(() => {
        router.push(`/confirmation?orderId=${orderRef.id}`)
      }, 1000)
    } catch (error) {
      console.error("Error placing order:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmangizni joylashtirish amalga oshmadi. Iltimos, qayta urinib ko'ring.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }, [items, tableNumber, total, toast, router])

  // Memoize the container variants to prevent unnecessary re-renders
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 30,
      },
    },
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 md:p-6">
        <h2 className="mb-4 text-xl font-bold">Sizning buyurtmangiz</h2>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Stol #{tableNumber}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pt-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground/50" />
            <p className="text-lg font-medium">Sizning savatchangiz bo'sh</p>
            <p className="mt-1 text-sm text-muted-foreground">Buyurtma berish uchun mahsulotlarni qo'shing</p>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div className="space-y-1" variants={containerVariants} initial="hidden" animate="visible">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          updateQuantity(item.id, item.quantity - 1)
                          // Play sound when removing item
                          if (item.quantity > 1) {
                            const audio = new Audio("/click.mp3")
                            audio.play().catch((e) => console.error("Error playing sound:", e))
                          } else {
                            const audio = new Audio("/notification.mp3")
                            audio.play().catch((e) => console.error("Error playing sound:", e))
                          }
                        }}
                      >
                        -
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          updateQuantity(item.id, item.quantity + 1)
                          // Play sound when adding item
                          const audio = new Audio("/click.mp3")
                          audio.play().catch((e) => console.error("Error playing sound:", e))
                        }}
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          // Play sound when removing item completely
                          const audio = new Audio("/notification.mp3")
                          audio.play().catch((e) => console.error("Error playing sound:", e))
                          updateQuantity(item.id, 0)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="border-t p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between font-semibold">
          <span>Jami</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button className="w-full" size="lg" disabled={items.length === 0 || isSubmitting} onClick={handlePlaceOrder}>
            {isSubmitting ? "Buyurtma joylashtirilmoqda..." : "Buyurtma berish"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

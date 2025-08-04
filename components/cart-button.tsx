"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { motion, AnimatePresence } from "framer-motion"

export function CartButton() {
  const { items, getTotalPrice, getTotalItems } = useCart()
  const router = useRouter()
  const totalItems = getTotalItems()
  const [isAnimating, setIsAnimating] = useState(false)
  const [prevTotalItems, setPrevTotalItems] = useState(totalItems)

  useEffect(() => {
    if (totalItems > prevTotalItems) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 500)
      return () => clearTimeout(timer)
    }
    setPrevTotalItems(totalItems)
  }, [totalItems, prevTotalItems])

  if (totalItems === 0) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button size="lg" className="rounded-full shadow-lg" onClick={() => router.push("/cart")}>
          <motion.div animate={isAnimating ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5 }}>
            <ShoppingCart className="mr-2 h-5 w-5" />
          </motion.div>
          <span className="font-medium">{totalItems}</span>
        </Button>
      </motion.div>
    </AnimatePresence>
  )
}

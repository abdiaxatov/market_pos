"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ClipboardList } from "lucide-react"

export function ViewMyOrdersButton() {
  const router = useRouter()
  const [hasOrders, setHasOrders] = useState(false)

  useEffect(() => {
    // Check if user has any orders on the client side
    const orders = JSON.parse(localStorage.getItem("myOrders") || "[]")
    setHasOrders(orders.length > 0)
  }, [])

  if (!hasOrders) return null


}

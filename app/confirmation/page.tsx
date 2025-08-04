"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Loader2, CheckCircle2, ArrowLeft, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { ViewMyOrdersButton } from "@/components/view-my-orders-button"
import Link from "next/link"
import { motion } from "framer-motion"
import type { Order } from "@/types"
import { getWaiterNameById } from "@/lib/table-service"

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [waiterName, setWaiterName] = useState<string | null>(null)

  const getSeatingTypeDisplay = (order: Order) => {
    if (order.orderType === "delivery") {
      return "Yetkazib berish"
    }

    if (order.seatingType) {
      // If we have the seating type directly
      return order.seatingType
    }

    // For backward compatibility
    if (order.roomNumber) {
      return "Xona"
    }

    return order.tableType || "Stol"
  }

  const getSeatingDisplay = (order: Order) => {
    const type = getSeatingTypeDisplay(order)

    if (order.orderType === "delivery") {
      return type
    }

    const number = order.roomNumber || order.tableNumber
    return `${type} ${number}`
  }

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setError("Buyurtma ID topilmadi")
        setLoading(false)
        return
      }

      try {
        const orderDoc = await getDoc(doc(db, "orders", orderId))
        if (orderDoc.exists()) {
          const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order
          setOrder(orderData)

          // Fetch waiter name if waiterId exists
          if (orderData.waiterId) {
            const name = await getWaiterNameById(orderData.waiterId)
            setWaiterName(name)
          }

          // Store the order timestamp and table/room number in localStorage
          const orderTime = orderData.createdAt?.toDate?.() || new Date()

          if (orderData.tableNumber || orderData.roomNumber) {
            localStorage.setItem(
              "lastOrderInfo",
              JSON.stringify({
                timestamp: orderTime.getTime(),
                tableNumber: orderData.tableNumber,
                roomNumber: orderData.roomNumber,
              }),
            )
          }
        } else {
          setError("Buyurtma topilmadi")
        }
      } catch (error) {
        console.error("Error fetching order:", error)
        setError("Buyurtmani yuklashda xatolik yuz berdi")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  // Play success sound on component mount
  useEffect(() => {
    const audio = new Audio("/success.mp3")
    audio.play().catch((e) => console.error("Error playing sound:", e))
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto flex h-[80vh] max-w-md items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
          <p>Buyurtma ma'lumotlari yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto flex h-[80vh] max-w-md items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-red-500">Xatolik</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">{error || "Buyurtma ma'lumotlarini yuklashda xatolik yuz berdi"}</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/">Bosh sahifaga qaytish</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden">
          <div className="bg-primary p-6 text-center text-primary-foreground">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            >
              <CheckCircle2 className="mx-auto mb-4 h-16 w-16" />
            </motion.div>
            <h1 className="mb-2 text-2xl font-bold">Buyurtmangiz qabul qilindi!</h1>
            <p>Buyurtma raqami: #{order.id?.substring(0, 6)}</p>
          </div>

          <CardHeader>
            <CardTitle>Buyurtma tafsilotlari</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium">Buyurtma turi</h3>
              <p>{getSeatingDisplay(order)}</p>
            </div>

            {waiterName && (
              <div>
                <h3 className="mb-2 font-medium">Ofitsiant</h3>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p>{waiterName}</p>
                </div>
              </div>
            )}

            {order.orderType === "delivery" && (
              <>
                <div>
                  <h3 className="mb-2 font-medium">Telefon raqami</h3>
                  <p>{order.phoneNumber}</p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium">Manzil</h3>
                  <p>{order.address}</p>
                </div>
              </>
            )}

            <div>
              <h3 className="mb-2 font-medium">Buyurtma elementlari</h3>
              <ul className="space-y-2">
                {order.items.map((item, index) => (
                  <li key={index} className="flex justify-between">
                    <span>
                      {item.name} x {item.quantity}
                    </span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between">
                <span>Jami:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Menyuga qaytish
              </Link>
            </Button>
            <ViewMyOrdersButton className="w-full" />
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}

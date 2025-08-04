"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, where, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"
import { RefreshCw, Clock, CheckCircle, Truck, ChefHat } from "lucide-react"
import type { Order } from "@/types"
import { getDeviceId } from "@/lib/device-utils"

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()

  const deviceId = getDeviceId()

  const fetchOrders = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const allOrders: Order[] = []
      const orderIds = new Set<string>()

      // Method 1: Get orders by device ID
      try {
        if (deviceId) {
          const deviceQuery = query(collection(db, "orders"), where("deviceId", "==", deviceId), limit(50))
          const deviceSnapshot = await getDocs(deviceQuery)
          deviceSnapshot.forEach((doc) => {
            if (!orderIds.has(doc.id)) {
              allOrders.push({ id: doc.id, ...doc.data() } as Order)
              orderIds.add(doc.id)
            }
          })
        }
      } catch (error) {
        console.log("Device ID query failed:", error)
      }

      // Method 2: Get orders from localStorage
      try {
        const storedOrderIds = JSON.parse(localStorage.getItem("myOrders") || "[]")
        if (storedOrderIds.length > 0) {
          // Get orders in batches to avoid 'in' query limit
          const batchSize = 10
          for (let i = 0; i < storedOrderIds.length; i += batchSize) {
            const batch = storedOrderIds.slice(i, i + batchSize)
            const batchQuery = query(collection(db, "orders"), where("__name__", "in", batch))
            const batchSnapshot = await getDocs(batchQuery)
            batchSnapshot.forEach((doc) => {
              if (!orderIds.has(doc.id)) {
                allOrders.push({ id: doc.id, ...doc.data() } as Order)
                orderIds.add(doc.id)
              }
            })
          }
        }
      } catch (error) {
        console.log("localStorage query failed:", error)
      }

      // Method 3: Get orders by phone number (if available)
      try {
        const userPhone = localStorage.getItem("userPhone")
        if (userPhone) {
          const phoneQuery = query(collection(db, "orders"), where("customerPhone", "==", userPhone), limit(20))
          const phoneSnapshot = await getDocs(phoneQuery)
          phoneSnapshot.forEach((doc) => {
            if (!orderIds.has(doc.id)) {
              allOrders.push({ id: doc.id, ...doc.data() } as Order)
              orderIds.add(doc.id)
            }
          })
        }
      } catch (error) {
        console.log("Phone query failed:", error)
      }

      // Sort orders by creation date (newest first)
      const sortedOrders = allOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
        return dateB.getTime() - dateA.getTime()
      })

      console.log("Fetched orders:", sortedOrders.length)
      setOrders(sortedOrders)

      if (showRefreshToast) {
        toast({
          title: "Yangilandi",
          description: `${sortedOrders.length} ta buyurtma topildi`,
        })
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmalarni yuklashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleRefresh = () => {
    fetchOrders(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />
      case "preparing":
        return <ChefHat className="h-4 w-4" />
      case "ready":
        return <CheckCircle className="h-4 w-4" />
      case "delivered":
        return <Truck className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Kutilmoqda"
      case "confirmed":
        return "Tasdiqlandi"
      case "preparing":
        return "Tayyorlanmoqda"
      case "ready":
        return "Tayyor"
      case "delivered":
        return "Yetkazildi"
      case "paid":
        return "To'landi"
      case "cancelled":
        return "Bekor qilindi"
      default:
        return status
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "confirmed":
        return "default"
      case "preparing":
        return "default"
      case "ready":
        return "default"
      case "delivered":
        return "default"
      case "paid":
        return "default"
      case "cancelled":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const formatOrderDate = (createdAt: any) => {
    try {
      let date: Date
      if (createdAt?.toDate) {
        date = createdAt.toDate()
      } else if (createdAt?.seconds) {
        date = new Date(createdAt.seconds * 1000)
      } else if (createdAt) {
        date = new Date(createdAt)
      } else {
        return "Noma'lum sana"
      }

      return date.toLocaleDateString("uz-UZ", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Noma'lum sana"
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Buyurtmalar topilmadi</h3>
        <p className="text-muted-foreground mb-4">Siz hali hech qanday buyurtma bermagansiz</p>
        <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Yangilash
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Buyurtmalarim ({orders.length})</h2>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Yangilash
        </Button>
      </div>

      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Buyurtma #{order.receiptNumber || order.id.slice(-6)}</CardTitle>
              <Badge variant={getStatusVariant(order.status)} className="flex items-center gap-1">
                {getStatusIcon(order.status)}
                {getStatusText(order.status)}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Stol: {order.tableNumber}</span>
              <span>{formatOrderDate(order.createdAt)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.items?.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Jami:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
              {order.notes && (
                <div className="text-sm text-muted-foreground">
                  <strong>Izoh:</strong> {order.notes}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

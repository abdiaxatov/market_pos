"use client"

import { useState, useEffect, useRef } from "react"
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingSpinner } from "@/components/admin/loading-spinner"
import { formatCurrency } from "@/lib/utils"
import { Clock, CheckCircle2, History, Bell, BellOff, User } from "lucide-react"
import type { Order } from "@/types"
import { getDocs as getDocsHelper } from "@/lib/getDocs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { playAudio, initAudioContext } from "@/lib/audio-player"

export function ChefPage() {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [preparingOrders, setPreparingOrders] = useState<Order[]>([])
  const [completedOrders, setCompletedOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([])
  const [waiterFilter, setWaiterFilter] = useState<string>("all")
  const [waiterNames, setWaiterNames] = useState<Record<string, string>>({})
  const [tableWaiters, setTableWaiters] = useState<Record<number, string>>({})
  const [roomWaiters, setRoomWaiters] = useState<Record<number, string>>({})
  const [seatingTypes, setSeatingTypes] = useState<Record<string, string>>({})
  const previousPendingCountRef = useRef(0)

  // Initialize audio context on first user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      initAudioContext()
      document.removeEventListener("click", handleUserInteraction)
    }
    document.addEventListener("click", handleUserInteraction)

    return () => {
      document.removeEventListener("click", handleUserInteraction)
    }
  }, [])

  useEffect(() => {
    // Load saved waiter filter from localStorage
    const savedWaiterFilter = localStorage.getItem("chefWaiterFilter")
    if (savedWaiterFilter) {
      setWaiterFilter(savedWaiterFilter)
    }

    // Fetch seating types
    const fetchSeatingTypes = async () => {
      try {
        const typesData = await getDocsHelper("seatingTypes", [])
        const typesMap: Record<string, string> = {}

        typesData.forEach((type: any) => {
          if (type.name) {
            typesMap[type.id] = type.name
          }
        })

        setSeatingTypes(typesMap)
      } catch (error) {
        console.error("Error fetching seating types:", error)
      }
    }

    // Fetch waiters
    const fetchWaiters = async () => {
      try {
        const waitersQuery = query(collection(db, "users"), where("role", "==", "waiter"))
        const waitersSnapshot = await getDocs(waitersQuery)
        const waitersList: { id: string; name: string }[] = []
        const waiterData: Record<string, string> = {}

        waitersSnapshot.forEach((doc) => {
          waitersList.push({ id: doc.id, name: doc.data().name })
          waiterData[doc.id] = doc.data().name
        })

        setWaiters(waitersList)
        setWaiterNames(waiterData)
      } catch (error) {
        console.error("Error fetching waiters:", error)
      }
    }

    // Fetch tables with their assigned waiters
    const fetchTableWaiters = async () => {
      try {
        const tablesQuery = query(collection(db, "tables"))
        const tablesSnapshot = await getDocs(tablesQuery)
        const tableData: Record<number, string> = {}

        tablesSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.waiterId) {
            tableData[data.number] = data.waiterId
          }
        })

        setTableWaiters(tableData)
      } catch (error) {
        console.error("Error fetching table waiters:", error)
      }
    }

    // Fetch rooms with their assigned waiters
    const fetchRoomWaiters = async () => {
      try {
        const roomsQuery = query(collection(db, "rooms"))
        const roomsSnapshot = await getDocs(roomsQuery)
        const roomData: Record<number, string> = {}

        roomsSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.waiterId) {
            roomData[data.number] = data.waiterId
          }
        })

        setRoomWaiters(roomData)
      } catch (error) {
        console.error("Error fetching room waiters:", error)
      }
    }

    fetchSeatingTypes()
    fetchWaiters()
    fetchTableWaiters()
    fetchRoomWaiters()
  }, [])

  // Save waiter filter to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("chefWaiterFilter", waiterFilter)
  }, [waiterFilter])

  // Function to get waiter name for an order
  const getWaiterName = (order: Order) => {
    // First check if the order has a waiterId directly
    if (order.waiterId && waiterNames[order.waiterId]) {
      return waiterNames[order.waiterId]
    }

    // Fall back to the previous logic for backward compatibility
    if (order.orderType === "table") {
      if (order.tableNumber && tableWaiters[order.tableNumber]) {
        const waiterId = tableWaiters[order.tableNumber]
        return waiterNames[waiterId] || "Belgilanmagan"
      } else if (order.roomNumber && roomWaiters[order.roomNumber]) {
        const waiterId = roomWaiters[order.roomNumber]
        return waiterNames[waiterId] || "Belgilanmagan"
      }
    }
    return "Belgilanmagan"
  }

  // Function to fetch orders
  const fetchOrders = async () => {
    try {
      // Get pending orders using our improved helper function
      const pendingOrdersData = await getDocsHelper("orders", [{ field: "status", operator: "==", value: "pending" }])

      // Check for new orders and play notification if needed
      if (pendingOrdersData.length > previousPendingCountRef.current && soundEnabled) {
        playAudio("/notification.mp3").catch((e) => console.error("Error playing notification:", e))
      }
      previousPendingCountRef.current = pendingOrdersData.length

      // Filter orders by waiter if needed
      let filteredPendingOrders = pendingOrdersData
      if (waiterFilter !== "all") {
        filteredPendingOrders = pendingOrdersData.filter((order) => {
          // First check if the order has a waiterId directly
          if (order.waiterId) {
            return order.waiterId === waiterFilter
          }

          // Fall back to the previous logic
          if (order.orderType !== "table") return false

          if (order.tableNumber && tableWaiters[order.tableNumber]) {
            return tableWaiters[order.tableNumber] === waiterFilter
          }

          if (order.roomNumber && roomWaiters[order.roomNumber]) {
            return roomWaiters[order.roomNumber] === waiterFilter
          }

          return false
        })
      }

      setPendingOrders(filteredPendingOrders)

      // Get preparing orders
      const preparingOrdersData = await getDocsHelper("orders", [
        { field: "status", operator: "==", value: "preparing" },
      ])

      // Filter preparing orders by waiter if needed
      let filteredPreparingOrders = preparingOrdersData
      if (waiterFilter !== "all") {
        filteredPreparingOrders = preparingOrdersData.filter((order) => {
          // First check if the order has a waiterId directly
          if (order.waiterId) {
            return order.waiterId === waiterFilter
          }

          // Fall back to the previous logic
          if (order.orderType !== "table") return false

          if (order.tableNumber && tableWaiters[order.tableNumber]) {
            return tableWaiters[order.tableNumber] === waiterFilter
          }

          if (order.roomNumber && roomWaiters[order.roomNumber]) {
            return roomWaiters[order.roomNumber] === waiterFilter
          }

          return false
        })
      }

      setPreparingOrders(filteredPreparingOrders)

      // Get completed orders
      const completedOrdersData = await getDocsHelper("orders", [
        { field: "status", operator: "==", value: "completed" },
      ])

      // Filter completed orders by waiter if needed
      let filteredCompletedOrders = completedOrdersData
      if (waiterFilter !== "all") {
        filteredCompletedOrders = completedOrdersData.filter((order) => {
          // First check if the order has a waiterId directly
          if (order.waiterId) {
            return order.waiterId === waiterFilter
          }

          // Fall back to the previous logic
          if (order.orderType !== "table") return false

          if (order.tableNumber && tableWaiters[order.tableNumber]) {
            return tableWaiters[order.tableNumber] === waiterFilter
          }

          if (order.roomNumber && roomWaiters[order.roomNumber]) {
            return roomWaiters[order.roomNumber] === waiterFilter
          }

          return false
        })
      }

      setCompletedOrders(filteredCompletedOrders.slice(0, 20)) // Limit to last 20 orders

      setIsLoading(false)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchOrders()

    // Set up a simple interval to refresh data every 3 seconds
    const intervalId = setInterval(() => {
      fetchOrders()
    }, 3000)

    return () => {
      clearInterval(intervalId)
    }
  }, [waiterFilter, soundEnabled])

  const handleStartPreparing = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "preparing",
        updatedAt: new Date(),
      })

      // Play cooking sound if enabled
      if (soundEnabled) {
        playAudio("/cooking.mp3").catch((e) => console.error("Error playing sound:", e))
      }

      // Refresh orders after update
      fetchOrders()
    } catch (error) {
      console.error("Error updating order status:", error)
    }
  }

  const handleOrderDelivered = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "completed",
        updatedAt: new Date(),
      })

      // Play ready sound if enabled
      if (soundEnabled) {
        playAudio("/ready.mp3").catch((e) => console.error("Error playing sound:", e))
      }

      // Refresh orders after update
      fetchOrders()
    } catch (error) {
      console.error("Error updating order status:", error)
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return ""
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Function to get the correct seating type display
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Oshpazlar</h1>
        <div className="flex items-center gap-4">
          <Select value={waiterFilter} onValueChange={(value) => setWaiterFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <SelectValue placeholder="Ofitsiant" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha ofitsiantlar</SelectItem>
              {waiters.map((waiter) => (
                <SelectItem key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            {soundEnabled ? <Bell className="h-5 w-5 text-green-600" /> : <BellOff className="h-5 w-5 text-gray-400" />}
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} id="sound-mode" />
            <Label htmlFor="sound-mode" className="text-sm">
              Ovozli bildirishnoma
            </Label>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="relative">
            Yangi
            {pendingOrders.length > 0 && <Badge className="ml-2 bg-primary">{pendingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="relative">
            <History className="mr-1 h-4 w-4" />
            Tarix
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingOrders.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">Yangi buyurtmalar yo'q</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {order.orderType === "table"
                          ? order.roomNumber
                            ? `Xona #${order.roomNumber}`
                            : `${getSeatingTypeDisplay(order)} #${order.tableNumber}`
                          : "Yetkazib berish"}
                      </CardTitle>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Yangi
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center text-xs text-muted-foreground">
                      <User className="mr-1 h-3 w-3" />
                      <span>Ofitsiant: {getWaiterName(order)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-1">
                      {order.items.map((item, index) => (
                        <li key={index} className="flex justify-between text-sm">
                          <span>
                            {item.name} x {item.quantity}
                          </span>
                          <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-between border-t pt-2">
                      <span className="font-medium">Jami:</span>
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30">
                    <Button className="w-full" onClick={() => handleStartPreparing(order.id)}>
                      Tayyorlashni boshlash
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preparing">
          {preparingOrders.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">Tayyorlanayotgan buyurtmalar yo'q</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {preparingOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-amber-50 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {order.orderType === "table"
                          ? order.roomNumber
                            ? `Xona #${order.roomNumber}`
                            : `${getSeatingTypeDisplay(order)} #${order.tableNumber}`
                          : "Yetkazib berish"}
                      </CardTitle>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700">
                        Tayyorlanmoqda
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center text-xs text-muted-foreground">
                      <User className="mr-1 h-3 w-3" />
                      <span>Ofitsiant: {getWaiterName(order)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-1">
                      {order.items.map((item, index) => (
                        <li key={index} className="flex justify-between text-sm">
                          <span>
                            {item.name} x {item.quantity}
                          </span>
                          <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-between border-t pt-2">
                      <span className="font-medium">Jami:</span>
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30">
                    <Button className="w-full" onClick={() => handleOrderDelivered(order.id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Yetkazildi
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {completedOrders.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">Yakunlangan buyurtmalar yo'q</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-green-50 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {order.orderType === "table"
                          ? order.roomNumber
                            ? `Xona #${order.roomNumber}`
                            : `${getSeatingTypeDisplay(order)} #${order.tableNumber}`
                          : "Yetkazib berish"}
                      </CardTitle>
                      <Badge variant="outline" className="bg-green-100 text-green-700">
                        Yakunlangan
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center text-xs text-muted-foreground">
                      <User className="mr-1 h-3 w-3" />
                      <span>Ofitsiant: {getWaiterName(order)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-1">
                      {order.items.map((item, index) => (
                        <li key={index} className="flex justify-between text-sm">
                          <span>
                            {item.name} x {item.quantity}
                          </span>
                          <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-between border-t pt-2">
                      <span className="font-medium">Jami:</span>
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Yakunlangan vaqt:</span> {formatDate(order.updatedAt)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

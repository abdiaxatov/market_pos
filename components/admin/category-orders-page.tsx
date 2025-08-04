"use client"

import { useEffect, useState, useRef } from "react"
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Printer, RefreshCw, Bell, BellOff, Clock, MapPin, User, Utensils, ChefHat } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Switch } from "@/components/ui/switch"
import { format } from "date-fns"
import { playNotificationSound, playDeliverySound } from "@/lib/audio-player"

// Category interface
interface Category {
  id: string
  name: string
  description?: string
  imageUrl?: string
  createdAt?: any
}

// Order item interface
interface OrderItem {
  id?: string
  name: string
  price: number
  quantity: number
  categoryId?: string
  category?: string | null
  notes?: string | null
}

// Order interface
interface Order {
  id: string
  orderType?: "table" | "delivery"
  tableNumber?: number | null
  roomNumber?: number | null
  status?: string
  createdAt: any
  items: OrderItem[]
  total?: number
  floor?: number
  seatingType?: string
  waiterId?: string
  waiterName?: string
  claimedBy?: string
  claimedByName?: string
  isPaid?: boolean
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
}

// Grouped orders by category
interface CategoryOrders {
  categoryId: string
  categoryName: string
  orders: Order[]
  totalOrders: number
}

// Get status color
function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-500 text-white"
    case "confirmed":
      return "bg-blue-500 text-white"
    case "preparing":
      return "bg-orange-500 text-white"
    case "ready":
      return "bg-green-500 text-white"
    case "delivered":
      return "bg-purple-500 text-white"
    case "completed":
      return "bg-gray-500 text-white"
    case "paid":
      return "bg-green-500 text-white"
    default:
      return "bg-gray-400 text-white"
  }
}

// Get status text
function getStatusText(status: string): string {
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
    case "completed":
      return "Yakunlandi"
    case "paid":
      return "To'langan"
    default:
      return "Noma'lum"
  }
}

// Get order type info
function getOrderTypeInfo(order: Order) {
  if (order.orderType === "delivery") {
    return {
      text: "Yetkazib berish",
      icon: <MapPin className="h-4 w-4" />,
      color: "bg-blue-500 text-white",
      location: order.deliveryAddress || "Manzil ko'rsatilmagan",
    }
  } else if (order.tableNumber) {
    return {
      text: `Stol #${order.tableNumber}`,
      icon: <Utensils className="h-4 w-4" />,
      color: "bg-green-500 text-white",
      location: `${order.floor || 1}-qavat`,
    }
  } else if (order.roomNumber) {
    return {
      text: `Xona #${order.roomNumber}`,
      icon: <User className="h-4 w-4" />,
      color: "bg-purple-500 text-white",
      location: `${order.floor || 1}-qavat`,
    }
  } else {
    return {
      text: "Saboy",
      icon: <ChefHat className="h-4 w-4" />,
      color: "bg-orange-500 text-white",
      location: "Restoran",
    }
  }
}

export default function CategoryOrdersPage() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryOrders, setCategoryOrders] = useState<CategoryOrders[]>([])
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null)
  const deliveryAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio elements
  useEffect(() => {
    notificationAudioRef.current = new Audio("/notification.mp3")
    deliveryAudioRef.current = new Audio("/delivery.mp3")

    const handleUserInteraction = () => {
      setHasUserInteracted(true)
    }

    window.addEventListener("click", handleUserInteraction)
    window.addEventListener("keydown", handleUserInteraction)
    window.addEventListener("touchstart", handleUserInteraction)

    return () => {
      window.removeEventListener("click", handleUserInteraction)
      window.removeEventListener("keydown", handleUserInteraction)
      window.removeEventListener("touchstart", handleUserInteraction)
    }
  }, [])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log("Kategoriyalar yuklanmoqda...")
        const categoriesCollection = collection(db, "categories")
        const categoriesSnapshot = await getDocs(categoriesCollection)
        const categoriesList: Category[] = []

        categoriesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Category, "id">
          categoriesList.push({ ...data, id: doc.id })
          console.log("Kategoriya yuklandi:", { id: doc.id, name: data.name })
        })

        console.log(`Jami ${categoriesList.length} ta kategoriya yuklandi`)
        setCategories(categoriesList)
      } catch (error) {
        console.error("Kategoriyalarni yuklashda xatolik:", error)
        setError("Kategoriyalarni yuklashda xatolik yuz berdi")
      }
    }

    fetchCategories()
  }, [])

  // Set up real-time listener for orders
  useEffect(() => {
    if (categories.length === 0) return // Wait for categories to load first

    setLoading(true)
    setError(null)

    try {
      console.log("Buyurtmalar uchun real-time tinglovchi o'rnatilmoqda...")
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const ordersCollection = collection(db, "orders")
      const ordersQuery = query(
        ordersCollection,
        where("createdAt", ">=", today),
        orderBy("createdAt", "desc"),
        limit(100),
      )

      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const ordersList: Order[] = []
          let newOrderDetected = false
          let newestOrderId: string | null = null

          snapshot.forEach((doc) => {
            const data = doc.data() as Omit<Order, "id">

            if (!data.items || data.items.length === 0) return

            if (!newestOrderId) {
              newestOrderId = doc.id
            }

            let orderDate: Date | null = null
            if (data.createdAt) {
              if (data.createdAt.toDate) {
                orderDate = data.createdAt.toDate()
              } else if (data.createdAt.seconds) {
                orderDate = new Date(data.createdAt.seconds * 1000)
              } else {
                orderDate = new Date(data.createdAt)
              }
            }

            if (!orderDate) return

            let total = data.total || 0
            if (!total && data.items) {
              total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
            }

            ordersList.push({
              ...data,
              id: doc.id,
              total,
            } as Order)
          })

          // Check for new orders
          if (newestOrderId && lastOrderId && newestOrderId !== lastOrderId) {
            newOrderDetected = true

            // Find the newest order to check its type
            const newestOrder = ordersList.find(order => order.id === newestOrderId)
            
            if (newestOrder) {
              // Check if it's a delivery order
              if (newestOrder.orderType === "delivery") {
                // Play delivery sound
                if (soundEnabled && hasUserInteracted && deliveryAudioRef.current) {
                  try {
                    const playPromise = deliveryAudioRef.current.play()
                    if (playPromise !== undefined) {
                      playPromise.catch((error) => {
                        console.log("Audio playback prevented:", error)
                      })
                    }
                  } catch (error) {
                    console.error("Error playing delivery sound:", error)
                  }
                }

                toast({
                  title: "🚚 Yangi yetkazib berish buyurtmasi!",
                  description: "Yangi yetkazib berish buyurtmasi qabul qilindi",
                  variant: "default",
                })
              } else {
                // Play regular notification sound for non-delivery orders
                if (soundEnabled && hasUserInteracted && notificationAudioRef.current) {
                  try {
                    const playPromise = notificationAudioRef.current.play()
                    if (playPromise !== undefined) {
                      playPromise.catch((error) => {
                        console.log("Audio playback prevented:", error)
                      })
                    }
                  } catch (error) {
                    console.error("Error playing notification sound:", error)
                  }
                }

                toast({
                  title: "🔔 Yangi buyurtma!",
                  description: "Yangi buyurtma qabul qilindi",
                  variant: "default",
                })
              }
            }
          }

          if (newestOrderId) {
            setLastOrderId(newestOrderId)
          }

          console.log(`${ordersList.length} ta buyurtma yuklandi`)
          setOrders(ordersList)
          processOrdersByCategory(ordersList)
          setLoading(false)
          setIsRefreshing(false)
        },
        (error) => {
          console.error("Buyurtmalarni kuzatishda xatolik:", error)
          setError("Buyurtmalarni kuzatishda xatolik yuz berdi")
          setLoading(false)
          setIsRefreshing(false)
        },
      )

      return () => unsubscribe()
    } catch (error) {
      console.error("Buyurtmalarni kuzatishni o'rnatishda xatolik:", error)
      setError("Buyurtmalarni kuzatishni o'rnatishda xatolik yuz berdi")
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [categories, soundEnabled, hasUserInteracted, toast, lastOrderId])

  // Process orders by category
  const processOrdersByCategory = (ordersList: Order[]) => {
    console.log("Buyurtmalar kategoriyalar bo'yicha qayta ishlanmoqda...")
    console.log(`Buyurtmalar: ${ordersList.length}, Kategoriyalar: ${categories.length}`)

    const categoryOrdersMap: { [categoryId: string]: Order[] } = {}

    // Initialize all categories
    categories.forEach((category) => {
      categoryOrdersMap[category.id] = []
    })

    // Group orders by category
    ordersList.forEach((order) => {
      const orderCategories = new Set<string>()

      // Get categories from order items
      order.items.forEach((item) => {
        if (item.categoryId) {
          orderCategories.add(item.categoryId)
          console.log(`Item "${item.name}" kategoriyasi: ${item.categoryId}`)
        } else {
          console.log(`Item "${item.name}" kategoriyasi yo'q`)
        }
      })

      // If order has items from categories, add to each category
      if (orderCategories.size > 0) {
        orderCategories.forEach((categoryId) => {
          if (categoryOrdersMap[categoryId]) {
            // Check if order already exists in this category
            const existingOrder = categoryOrdersMap[categoryId].find((o) => o.id === order.id)
            if (!existingOrder) {
              categoryOrdersMap[categoryId].push(order)
              console.log(`Buyurtma ${order.id} kategoriya ${categoryId}ga qo'shildi`)
            }
          } else {
            console.log(`Noma'lum kategoriya: ${categoryId}`)
          }
        })
      } else {
        // If no category found, add to "unknown" category
        if (!categoryOrdersMap["unknown"]) {
          categoryOrdersMap["unknown"] = []
        }
        categoryOrdersMap["unknown"].push(order)
        console.log(`Buyurtma ${order.id} noma'lum kategoriyaga qo'shildi`)
      }
    })

    // Convert to CategoryOrders array
    const categoryOrdersList: CategoryOrders[] = []

    // Add known categories that have orders
    categories.forEach((category) => {
      if (categoryOrdersMap[category.id] && categoryOrdersMap[category.id].length > 0) {
        categoryOrdersList.push({
          categoryId: category.id,
          categoryName: category.name,
          orders: categoryOrdersMap[category.id],
          totalOrders: categoryOrdersMap[category.id].length,
        })
        console.log(`Kategoriya "${category.name}": ${categoryOrdersMap[category.id].length} ta buyurtma`)
      }
    })

    // Add unknown category if exists
    if (categoryOrdersMap["unknown"] && categoryOrdersMap["unknown"].length > 0) {
      categoryOrdersList.push({
        categoryId: "unknown",
        categoryName: "Boshqa",
        orders: categoryOrdersMap["unknown"],
        totalOrders: categoryOrdersMap["unknown"].length,
      })
      console.log(`"Boshqa" kategoriya: ${categoryOrdersMap["unknown"].length} ta buyurtma`)
    }

    console.log(`Jami ${categoryOrdersList.length} ta kategoriya buyurtmalar bilan`)
    setCategoryOrders(categoryOrdersList)
  }

  // Manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true)
    toast({
      title: "🔄 Yangilanmoqda",
      description: "Ma'lumotlar yangilanmoqda...",
    })
  }

  // Print receipt for order
  const printReceipt = (order: Order) => {
    const orderTypeInfo = getOrderTypeInfo(order)
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chek - ${order.id}</title>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Courier New', monospace;
          width: 300px;
          margin: 0 auto;
          padding: 10px;
          font-size: 14px;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
          border-bottom: 2px solid black;
          padding-bottom: 10px;
        }
        .logo {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .info {
          margin-bottom: 15px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 5px 0;
        }
        .item-name {
          flex: 1;
          margin-right: 10px;
        }
        .item-qty {
          margin-right: 10px;
          font-weight: bold;
        }
        .item-price {
          font-weight: bold;
        }
        .notes {
          font-style: italic;
          font-size: 12px;
          margin-left: 10px;
          color: #666;
          margin-top: 3px;
        }
        .total {
          font-weight: bold;
          border-top: 2px solid black;
          margin-top: 15px;
          padding-top: 10px;
          font-size: 16px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          border-top: 1px dashed black;
          padding-top: 10px;
        }
        .status {
          text-align: center;
          font-weight: bold;
          margin: 10px 0;
          padding: 5px;
          border: 1px solid black;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🍽️ RESTORAN</div>
        <h2>BUYURTMA CHEKI</h2>
        <p>ID: ${order.id.slice(-6).toUpperCase()}</p>
      </div>
      
      <div class="info">
        <div class="info-row">
          <span>Turi:</span>
          <span>${orderTypeInfo.text}</span>
        </div>
        <div class="info-row">
          <span>Joylashuv:</span>
          <span>${orderTypeInfo.location}</span>
        </div>
        ${
          order.waiterName || order.claimedByName
            ? `
        <div class="info-row">
          <span>Ofitsiant:</span>
          <span>${order.waiterName || order.claimedByName}</span>
        </div>
        `
            : ""
        }
        ${
          order.customerName
            ? `
        <div class="info-row">
          <span>Mijoz:</span>
          <span>${order.customerName}</span>
        </div>
        `
            : ""
        }
        <div class="info-row">
          <span>Sana:</span>
          <span>${format(new Date(), "dd.MM.yyyy HH:mm")}</span>
        </div>
      </div>

      <div class="status">
        HOLAT: ${getStatusText(order.status || "pending").toUpperCase()}
      </div>
      
      <div class="items">
        ${order.items
          .map(
            (item) => `
          <div class="item">
            <div class="item-name">${item.name}</div>
            <div class="item-qty">x${item.quantity}</div>
            <div class="item-price">${formatCurrency(item.total || item.price * item.quantity)}</div>
          </div>
          ${item.notes ? `<div class="notes">💬 ${item.notes}</div>` : ""}
        `,
          )
          .join("")}
      </div>
      
      <div class="total">
        <div class="item">
          <span>JAMI SUMMA:</span>
          <span>${formatCurrency(order.total || 0)}</span>
        </div>
      </div>
      
      <div class="footer">
        <p>🙏 Rahmat!</p>
        <p>Yaxshi ishtaha!</p>
      </div>
    </body>
    </html>
    `

    printWindow.document.open()
    printWindow.document.write(content)
    printWindow.document.close()

    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium text-muted-foreground">Buyurtmalar yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <p className="text-lg font-medium text-destructive mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="destructive">
            <RefreshCw className="h-4 w-4 mr-2" />
            Qayta urinish
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground p-3 rounded-lg">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Kategoriyalarga Bo'lingan Buyurtmalar</h1>
              <p className="text-muted-foreground">Real vaqt rejimida kuzatuv</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Sound Toggle */}
            <div className="flex items-center space-x-2 bg-muted rounded-lg p-3">
              <Switch id="sound-toggle" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
              <label htmlFor="sound-toggle" className="text-sm font-medium cursor-pointer flex items-center">
                {soundEnabled ? (
                  <>
                    <Bell className="h-4 w-4 mr-2 text-green-600" />
                    <span className="hidden sm:inline">Ovozli</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="hidden sm:inline">Ovozsiz</span>
                  </>
                )}
              </label>
            </div>

            {/* Orders Count */}
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex flex-col items-center">
              <span className="text-xl font-bold">{orders.length}</span>
              <p className="text-xs">Buyurtma</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
      <div className="bg-card rounded-lg shadow-sm p-4 mb-6 border">
  <div className="w-full overflow-x-auto">
    <TabsList className="inline-flex items-center h-10 space-x-2 w-max bg-muted p-1 rounded-md text-muted-foreground">
      {/* Barchasi */}
      <TabsTrigger
        value="all"
        className="inline-flex items-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
      >
        Barchasi
        <Badge variant="secondary" className="ml-2">{orders.length}</Badge>
      </TabsTrigger>

      {/* Dinamik kategoriyalar */}
      {categoryOrders.map((categoryData) => (
        <TabsTrigger
          key={categoryData.categoryId}
          value={categoryData.categoryId}
          className="inline-flex items-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          {categoryData.categoryName}
          <Badge variant="secondary" className="ml-2">{categoryData.totalOrders}</Badge>
        </TabsTrigger>
      ))}
    </TabsList>
  </div>
</div>


        {/* All Orders Tab */}
        <TabsContent value="all" className="mt-0">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-card rounded-lg shadow-sm border">
              <div className="text-muted-foreground text-6xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Buyurtmalar mavjud emas</h3>
              <p className="text-muted-foreground">Bugun hali buyurtmalar qabul qilinmagan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {orders.map((order) => {
                const orderTypeInfo = getOrderTypeInfo(order)
                const orderTime = order.createdAt?.toDate ? order.createdAt.toDate() : new Date()

                return (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-md ${orderTypeInfo.color}`}>{orderTypeInfo.icon}</div>
                          <div>
                            <h3 className="font-semibold text-sm">{orderTypeInfo.text}</h3>
                            <p className="text-xs text-muted-foreground">{orderTypeInfo.location}</p>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(order.status || "pending")} text-xs`}>
                          {getStatusText(order.status || "pending")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(orderTime, "HH:mm")}</span>
                        <span>•</span>
                        <span>ID: {order.id.slice(-6).toUpperCase()}</span>
                      </div>

                      {(order.waiterName || order.claimedByName) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded p-2">
                          <User className="h-3 w-3" />
                          <span>Ofitsiant: {order.waiterName || order.claimedByName}</span>
                        </div>
                      )}

                      {order.customerName && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 rounded p-2">
                          <User className="h-3 w-3 text-blue-600" />
                          <span>Mijoz: {order.customerName}</span>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 placeholder:animate-pulse">
                          {order.items.map((item, index) => (
                            <div key={index} className="bg-muted rounded p-2">
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-sm flex-1">{item.name}</span>
                                <div className="text-right ml-2">
                                  <div className="font-semibold text-primary text-sm">x{item.quantity}</div>
                                  <div className="text-xs font-semibold">
                                    {formatCurrency(item.total || item.price * item.quantity)}
                                  </div>
                                </div>
                              </div>
                              {item.notes && (
                                <div className="text-xs text-muted-foreground bg-yellow-50 rounded p-1 mt-1 border-l-2 border-yellow-400">
                                  💬 {item.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-semibold text-sm">Jami summa:</span>
                          <span className="font-bold text-primary">{formatCurrency(order.total || 0)}</span>
                        </div>

                        {/* <Button onClick={() => printReceipt(order)} className="w-full" size="sm">
                          <Printer className="h-4 w-4 mr-2" />
                          Chek chop etish
                        </Button> */}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Category-specific tabs */}
        {categoryOrders.map((categoryData) => (
          <TabsContent key={categoryData.categoryId} value={categoryData.categoryId} className="mt-0">
            {/* <div className="mb-4 bg-card rounded-lg shadow-sm p-4 border">
              <h2 className="text-xl font-bold text-foreground mb-1">{categoryData.categoryName}</h2>
              <p className="text-muted-foreground">
                {categoryData.totalOrders} ta buyurtma • Kategoriya bo'yicha filtr
              </p>
            </div> */}

            {categoryData.orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-card rounded-lg shadow-sm border">
                <div className="text-muted-foreground text-6xl mb-4">🍽️</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Bu kategoriyada buyurtmalar yo'q</h3>
                <p className="text-muted-foreground">
                  Hozircha {categoryData.categoryName} kategoriyasida buyurtmalar mavjud emas
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                {categoryData.orders.map((order) => {
                  const orderTypeInfo = getOrderTypeInfo(order)
                  const orderTime = order.createdAt?.toDate ? order.createdAt.toDate() : new Date()

                  // Filter items for this category
                  const categoryItems = order.items.filter((item) => item.categoryId === categoryData.categoryId)

                  return (
                    <Card key={`${categoryData.categoryId}-${order.id}`} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-md ${orderTypeInfo.color}`}>{orderTypeInfo.icon}</div>
                            <div>
                              <h3 className="font-semibold text-sm">{orderTypeInfo.text}</h3>
                              <p className="text-xs text-muted-foreground">{orderTypeInfo.location}</p>
                            </div>
                          </div>
                          <Badge className={`${getStatusColor(order.status || "pending")} text-xs`}>
                            {getStatusText(order.status || "pending")}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(orderTime, "HH:mm")}</span>
                          <span>•</span>
                          <span>ID: {order.id.slice(-6).toUpperCase()}</span>
                        </div>

                        {(order.waiterName || order.claimedByName) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded p-2">
                            <User className="h-3 w-3" />
                            <span>Ofitsiant: {order.waiterName || order.claimedByName}</span>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 placeholder:animate-pulse">
                            {categoryItems.map((item, index) => (
                              <div key={index} className="bg-muted rounded p-2">
                                <div className="flex justify-between items-start">
                                  <span className="font-medium text-sm flex-1">{item.name}</span>
                                  <div className="text-right ml-2">
                                    <div className="font-semibold text-primary text-sm">x{item.quantity}</div>
                                    <div className="text-xs font-semibold">
                                      {formatCurrency(item.total || item.price * item.quantity)}
                                    </div>
                                  </div>
                                </div>
                                {item.notes && (
                                  <div className="text-xs text-muted-foreground bg-yellow-50 rounded p-1 mt-1 border-l-2 border-yellow-400">
                                    💬 {item.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-semibold text-sm">Kategoriya jami:</span>
                            <span className="font-bold text-primary">
                              {formatCurrency(
                                categoryItems.reduce(
                                  (sum, item) => sum + (item.total || item.price * item.quantity),
                                  0,
                                ),
                              )}
                            </span>
                          </div>

                          {/* <Button onClick={() => printReceipt(order)} className="w-full" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Chek chop etish
                          </Button> */}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

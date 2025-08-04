"use client"

import { useState, useEffect } from "react"
import { collection, query, onSnapshot, where, getDocs, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { OrderDetails } from "@/components/admin/order-details"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import {
  Loader2,
  History,
  AlertTriangle,
  Download,
  User,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Eye,
  Clock,
  DollarSign,
  Package,
  Phone,
  MapPin,
  Car,
  Users,
  Home,
} from "lucide-react"
import type { Order } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import * as XLSX from "xlsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface OrderHistoryStats {
  totalOrders: number
  totalRevenue: number
  tableOrders: number
  deliveryOrders: number
  saboyOrders: number
  paidOrders: number
  unpaidOrders: number
  averageOrderValue: number
}

// Utility functions for status and colors
const getStatusText = (status: string): string => {
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
    case "cancelled":
      return "Bekor qilindi"
    default:
      return "Noma'lum"
  }
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "confirmed":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "preparing":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "ready":
      return "bg-green-100 text-green-800 border-green-200"
    case "delivered":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "completed":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "paid":
      return "bg-emerald-100 text-emerald-800 border-emerald-200"
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getOrderTypeText = (orderType: string): string => {
  switch (orderType) {
    case "table":
      return "Stol buyurtmasi"
    case "delivery":
      return "Yetkazib berish"
    case "saboy":
      return "Saboy"
    default:
      return "Noma'lum"
  }
}

const getOrderTypeIcon = (orderType: string) => {
  switch (orderType) {
    case "table":
      return <Users className="w-4 h-4" />
    case "delivery":
      return <Car className="w-4 h-4" />
    case "saboy":
      return <Home className="w-4 h-4" />
    default:
      return <Package className="w-4 h-4" />
  }
}

const getPaymentStatusText = (isPaid: boolean): string => {
  return isPaid ? "To'langan" : "To'lanmagan"
}

const getPaymentStatusColor = (isPaid: boolean): string => {
  return isPaid ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"
}

export function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [dateFilter, setDateFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([])
  const [waiterFilter, setWaiterFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [waiterNames, setWaiterNames] = useState<Record<string, string>>({})
  const [tableWaiters, setTableWaiters] = useState<Record<number, string>>({})
  const [roomWaiters, setRoomWaiters] = useState<Record<number, string>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stats, setStats] = useState<OrderHistoryStats>({
    totalOrders: 0,
    totalRevenue: 0,
    tableOrders: 0,
    deliveryOrders: 0,
    saboyOrders: 0,
    paidOrders: 0,
    unpaidOrders: 0,
    averageOrderValue: 0,
  })
  const { toast } = useToast()

  // Load saved filters from localStorage
  useEffect(() => {
    const savedWaiterFilter = localStorage.getItem("historyWaiterFilter")
    const savedStatusFilter = localStorage.getItem("historyStatusFilter")
    const savedPaymentFilter = localStorage.getItem("historyPaymentFilter")
    const savedDateFilter = localStorage.getItem("historyDateFilter")
    const savedSearchQuery = localStorage.getItem("historySearchQuery")

    if (savedWaiterFilter) setWaiterFilter(savedWaiterFilter)
    if (savedStatusFilter) setStatusFilter(savedStatusFilter)
    if (savedPaymentFilter) setPaymentFilter(savedPaymentFilter)
    if (savedDateFilter) setDateFilter(savedDateFilter)
    if (savedSearchQuery) setSearchQuery(savedSearchQuery)
  }, [])

  // Save filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem("historyWaiterFilter", waiterFilter)
  }, [waiterFilter])

  useEffect(() => {
    localStorage.setItem("historyStatusFilter", statusFilter)
  }, [statusFilter])

  useEffect(() => {
    localStorage.setItem("historyPaymentFilter", paymentFilter)
  }, [paymentFilter])

  useEffect(() => {
    localStorage.setItem("historyDateFilter", dateFilter)
  }, [dateFilter])

  useEffect(() => {
    localStorage.setItem("historySearchQuery", searchQuery)
  }, [searchQuery])

  // Fetch waiters and table assignments
  useEffect(() => {
    const fetchWaitersAndTables = async () => {
      try {
        // Fetch waiters
        const waitersQuery = query(collection(db, "users"), where("role", "==", "waiter"))
        const waitersSnapshot = await getDocs(waitersQuery)
        const waitersList: { id: string; name: string }[] = []
        const waiterData: Record<string, string> = {}

        waitersSnapshot.forEach((doc) => {
          const data = doc.data()
          waitersList.push({ id: doc.id, name: data.name || "Noma'lum" })
          waiterData[doc.id] = data.name || "Noma'lum"
        })

        setWaiters(waitersList)
        setWaiterNames(waiterData)

        // Fetch tables with their assigned waiters
        const tablesQuery = query(collection(db, "tables"))
        const tablesSnapshot = await getDocs(tablesQuery)
        const tableData: Record<number, string> = {}

        tablesSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.waiterId && data.number) {
            tableData[data.number] = data.waiterId
          }
        })

        setTableWaiters(tableData)

        // Fetch rooms with their assigned waiters
        const roomsQuery = query(collection(db, "rooms"))
        const roomsSnapshot = await getDocs(roomsQuery)
        const roomData: Record<number, string> = {}

        roomsSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.waiterId && data.number) {
            roomData[data.number] = data.waiterId
          }
        })

        setRoomWaiters(roomData)
      } catch (error) {
        console.error("Error fetching waiters and tables:", error)
        toast({
          title: "Xatolik",
          description: "Ofitsiantlar va stollar ma'lumotlarini yuklashda xatolik yuz berdi.",
          variant: "destructive",
        })
      }
    }

    fetchWaitersAndTables()
  }, [toast])

  // Function to get waiter name for an order
  const getWaiterName = (order: Order): string => {
    try {
      // First check if the order has a waiterId directly
      if (order.waiterId && waiterNames[order.waiterId]) {
        return waiterNames[order.waiterId]
      }

      // Fallback to the old method for backward compatibility
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
    } catch (error) {
      console.error("Error getting waiter name:", error)
      return "Belgilanmagan"
    }
  }

  // Fetch order history
  useEffect(() => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("Fetching order history...")
      const ordersQuery = query(
        collection(db, "orderHistory"),
        orderBy("deletedAt", "desc"),
        limit(1000), // Limit to prevent performance issues
      )

      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          try {
            const ordersList: Order[] = []
            console.log(`Found ${snapshot.docs.length} orders in history`)

            snapshot.forEach((doc) => {
              const data = doc.data()
              if (data && typeof data === "object") {
                ordersList.push({
                  id: doc.id,
                  ...data,
                  // Ensure required fields have default values
                  items: data.items || [],
                  status: data.status || "unknown",
                  orderType: data.orderType || "table",
                  total: data.total || data.totalAmount || 0,
                  isPaid: data.isPaid || false,
                  phoneNumber: data.phoneNumber || "",
                  customerPhone: data.customerPhone || "",
                  address: data.address || "",
                  tableNumber: data.tableNumber || null,
                  roomNumber: data.roomNumber || null,
                  waiterId: data.waiterId || null,
                  customerName: data.customerName || "",
                } as Order)
              }
            })

            setOrders(ordersList)
            setIsLoading(false)
          } catch (processingError) {
            console.error("Error processing order history:", processingError)
            setError("Buyurtmalar tarixini qayta ishlashda xatolik yuz berdi.")
            setIsLoading(false)
          }
        },
        (error) => {
          console.error("Error fetching order history:", error)
          setError("Buyurtmalar tarixini yuklashda xatolik: " + error.message)
          toast({
            title: "Xatolik",
            description: "Buyurtmalar tarixini yuklashda xatolik yuz berdi.",
            variant: "destructive",
          })
          setIsLoading(false)
        },
      )

      return () => unsubscribe()
    } catch (err: any) {
      console.error("Error setting up order history query:", err)
      setError("Buyurtmalar tarixi so'rovini o'rnatishda xatolik: " + err.message)
      setIsLoading(false)
    }
  }, [toast])

  // Calculate stats when orders change
  useEffect(() => {
    const calculateStats = () => {
      const totalOrders = orders.length
      const totalRevenue = orders.reduce((sum, order) => {
        const orderTotal = order.total || order.totalAmount || 0
        return sum + orderTotal
      }, 0)

      const tableOrders = orders.filter((order) => order.orderType === "table").length
      const deliveryOrders = orders.filter((order) => order.orderType === "delivery").length
      const saboyOrders = orders.filter((order) => order.orderType === "saboy").length
      const paidOrders = orders.filter((order) => order.isPaid).length
      const unpaidOrders = totalOrders - paidOrders
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      setStats({
        totalOrders,
        totalRevenue,
        tableOrders,
        deliveryOrders,
        saboyOrders,
        paidOrders,
        unpaidOrders,
        averageOrderValue,
      })
    }

    calculateStats()
  }, [orders])

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsOrderDetailsOpen(true)
  }

  const handleOrderDetailsClose = () => {
    setIsOrderDetailsOpen(false)
    setSelectedOrder(null)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Force refresh by clearing and reloading data
      setOrders([])
      await new Promise((resolve) => setTimeout(resolve, 500))
      // The useEffect will automatically reload the data
    } catch (error) {
      console.error("Error refreshing:", error)
      toast({
        title: "Xatolik",
        description: "Ma'lumotlarni yangilashda xatolik yuz berdi.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const clearAllFilters = () => {
    setActiveTab("all")
    setDateFilter("")
    setSearchQuery("")
    setWaiterFilter("all")
    setStatusFilter("all")
    setPaymentFilter("all")

    // Clear from localStorage
    localStorage.removeItem("historyWaiterFilter")
    localStorage.removeItem("historyStatusFilter")
    localStorage.removeItem("historyPaymentFilter")
    localStorage.removeItem("historyDateFilter")
    localStorage.removeItem("historySearchQuery")
  }

  // Filter orders based on all criteria
  const filteredOrders = orders.filter((order) => {
    try {
      // Filter by tab (order type)
      const tabMatch =
        activeTab === "all" ||
        (activeTab === "table" && order.orderType === "table") ||
        (activeTab === "delivery" && order.orderType === "delivery") ||
        (activeTab === "saboy" && order.orderType === "saboy")

      // Filter by date if date filter is set
      let dateMatch = true
      if (dateFilter) {
        const orderDate = order.deletedAt?.toDate
          ? format(new Date(order.deletedAt.toDate()), "yyyy-MM-dd")
          : order.createdAt?.toDate
            ? format(new Date(order.createdAt.toDate()), "yyyy-MM-dd")
            : format(new Date(), "yyyy-MM-dd")

        dateMatch = orderDate === dateFilter
      }

      // Filter by search query
      let searchMatch = true
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const orderText = [
          order.id,
          order.phoneNumber || "",
          order.customerPhone || "",
          order.address || "",
          order.customerName || "",
          order.tableNumber?.toString() || "",
          order.roomNumber?.toString() || "",
          getWaiterName(order),
          ...order.items.map((item) => item.name || ""),
        ]
          .join(" ")
          .toLowerCase()

        searchMatch = orderText.includes(query)
      }

      // Filter by waiter (only for table orders)
      let waiterMatch = true
      if (waiterFilter !== "all" && order.orderType === "table") {
        if (order.waiterId) {
          waiterMatch = order.waiterId === waiterFilter
        } else if (order.tableNumber && tableWaiters[order.tableNumber]) {
          waiterMatch = tableWaiters[order.tableNumber] === waiterFilter
        } else if (order.roomNumber && roomWaiters[order.roomNumber]) {
          waiterMatch = roomWaiters[order.roomNumber] === waiterFilter
        } else {
          waiterMatch = false
        }
      }

      // Filter by status
      let statusMatch = true
      if (statusFilter !== "all") {
        statusMatch = order.status === statusFilter
      }

      // Filter by payment status
      let paymentMatch = true
      if (paymentFilter !== "all") {
        paymentMatch = paymentFilter === "paid" ? order.isPaid : !order.isPaid
      }

      return tabMatch && dateMatch && searchMatch && waiterMatch && statusMatch && paymentMatch
    } catch (error) {
      console.error("Error filtering order:", error)
      return false
    }
  })

  // Export to Excel
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredOrders.map((order, index) => {
        const createdDate = order.createdAt?.toDate
          ? format(new Date(order.createdAt.toDate()), "yyyy-MM-dd HH:mm")
          : "Noma'lum"

        const deletedDate = order.deletedAt?.toDate
          ? format(new Date(order.deletedAt.toDate()), "yyyy-MM-dd HH:mm")
          : "Noma'lum"

        const paidDate = order.paidAt?.toDate ? format(new Date(order.paidAt.toDate()), "yyyy-MM-dd HH:mm") : ""

        const waiterName = order.orderType === "table" ? getWaiterName(order) : "-"

        const itemsList = order.items
          .map(
            (item) =>
              `${item.quantity || 0} × ${item.name || "Noma'lum"} (${formatCurrency((item.price || 0) * (item.quantity || 1))})`,
          )
          .join("; ")

        return {
          "№": index + 1,
          "Buyurtma ID": order.id || "",
          "Buyurtma turi": getOrderTypeText(order.orderType || "table"),
          "Stol raqami": order.tableNumber || "-",
          "Xona raqami": order.roomNumber || "-",
          "Mijoz ismi": order.customerName || "-",
          Telefon: order.phoneNumber || order.customerPhone || "-",
          Ofitsiant: waiterName,
          Status: getStatusText(order.status || "unknown"),
          "To'lov holati": getPaymentStatusText(order.isPaid || false),
          "To'langan sana": paidDate,
          Manzil: order.address || "-",
          Taomlar: itemsList,
          "Taomlar soni": order.items.reduce((sum, item) => sum + (item.quantity || 0), 0),
          "Jami summa": formatCurrency(order.total || order.totalAmount || 0),
          "Yaratilgan sana": createdDate,
          "O'chirilgan sana": deletedDate,
        }
      })

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData)

      // Set column widths
      const colWidths = [
        { wch: 5 }, // №
        { wch: 15 }, // Buyurtma ID
        { wch: 15 }, // Buyurtma turi
        { wch: 12 }, // Stol raqami
        { wch: 12 }, // Xona raqami
        { wch: 20 }, // Mijoz ismi
        { wch: 15 }, // Telefon
        { wch: 15 }, // Ofitsiant
        { wch: 15 }, // Status
        { wch: 12 }, // To'lov holati
        { wch: 18 }, // To'langan sana
        { wch: 30 }, // Manzil
        { wch: 50 }, // Taomlar
        { wch: 12 }, // Taomlar soni
        { wch: 15 }, // Jami summa
        { wch: 18 }, // Yaratilgan sana
        { wch: 18 }, // O'chirilgan sana
      ]
      worksheet["!cols"] = colWidths

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Buyurtmalar tarixi")

      // Generate Excel file
      const fileName = dateFilter
        ? `Buyurtmalar_tarixi_${dateFilter}.xlsx`
        : `Buyurtmalar_tarixi_${format(new Date(), "yyyy-MM-dd")}.xlsx`

      XLSX.writeFile(workbook, fileName)

      toast({
        title: "Eksport qilindi",
        description: `${filteredOrders.length} ta buyurtma Excel formatida eksport qilindi`,
      })
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast({
        title: "Xatolik",
        description: "Excel formatiga eksport qilishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Xatolik</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Qayta urinish
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Buyurtmalar tarixi</h1>
            <p className="text-sm text-muted-foreground">O'chirilgan buyurtmalar tarixi va hisobotlar</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Yangilash
            </Button>
            <Button onClick={clearAllFilters} variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtrlarni tozalash
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jami buyurtmalar</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Stol: {stats.tableOrders}, Yetkazib berish: {stats.deliveryOrders}, Saboy: {stats.saboyOrders}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jami tushum</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">O'rtacha: {formatCurrency(stats.averageOrderValue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">To'lov holati</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.paidOrders}</div>
            <p className="text-xs text-muted-foreground">To'lanmagan: {stats.unpaidOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Filtrlangan</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground">Jami: {orders.length} dan</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="border-b bg-gray-50 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Date Filter */}
          <div>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full" />
          </div>

          {/* Waiter Filter */}
          <Select value={waiterFilter} onValueChange={setWaiterFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Ofitsiant" />
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

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha statuslar</SelectItem>
              <SelectItem value="pending">Kutilmoqda</SelectItem>
              <SelectItem value="confirmed">Tasdiqlandi</SelectItem>
              <SelectItem value="preparing">Tayyorlanmoqda</SelectItem>
              <SelectItem value="ready">Tayyor</SelectItem>
              <SelectItem value="delivered">Yetkazildi</SelectItem>
              <SelectItem value="completed">Yakunlandi</SelectItem>
              <SelectItem value="paid">To'langan</SelectItem>
              <SelectItem value="cancelled">Bekor qilindi</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Filter */}
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="To'lov" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="paid">To'langan</SelectItem>
              <SelectItem value="unpaid">To'lanmagan</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Button */}
          <Button onClick={exportToExcel} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Tabs and Orders List */}
      <div className="p-4">
        <div className="mb-4">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                Barchasi{" "}
                <Badge variant="secondary" className="ml-1">
                  {orders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="table">
                Stol buyurtmalari{" "}
                <Badge variant="secondary" className="ml-1">
                  {stats.tableOrders}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="delivery">
                Yetkazib berish{" "}
                <Badge variant="secondary" className="ml-1">
                  {stats.deliveryOrders}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="saboy">
                Saboy{" "}
                <Badge variant="secondary" className="ml-1">
                  {stats.saboyOrders}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {renderOrdersList(filteredOrders)}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold">{selectedOrder ? "Buyurtma tafsilotlari" : ""}</DialogTitle>
          {selectedOrder && <OrderDetails order={selectedOrder} onClose={handleOrderDetailsClose} />}
        </DialogContent>
      </Dialog>
    </div>
  )

  function renderOrdersList(orders: Order[]) {
    if (isLoading) {
      return (
        <div className="flex h-60 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Buyurtmalar yuklanmoqda...</p>
          </div>
        </div>
      )
    }

    if (orders.length === 0) {
      return (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed">
          <Trash2 className="mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">Buyurtmalar topilmadi</p>
          <p className="text-sm text-muted-foreground">
            {searchQuery || dateFilter || waiterFilter !== "all" || statusFilter !== "all" || paymentFilter !== "all"
              ? "Filtr shartlariga mos buyurtmalar mavjud emas"
              : "Hali hech qanday buyurtma o'chirilmagan"}
          </p>
          {(searchQuery ||
            dateFilter ||
            waiterFilter !== "all" ||
            statusFilter !== "all" ||
            paymentFilter !== "all") && (
            <Button onClick={clearAllFilters} variant="outline" className="mt-2 bg-transparent">
              Filtrlarni tozalash
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onSelect={handleSelectOrder} getWaiterName={getWaiterName} />
        ))}
      </div>
    )
  }
}

function OrderCard({
  order,
  onSelect,
  getWaiterName,
}: {
  order: Order
  onSelect: (order: Order) => void
  getWaiterName: (order: Order) => string
}) {
  const waiterName = getWaiterName(order)
  const orderTotal = order.total || order.totalAmount || 0
  const itemsCount = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md">
      {/* Header with deleted status */}
      <div className="bg-red-50 p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              O'chirilgan
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {order.deletedAt?.toDate ? format(new Date(order.deletedAt.toDate()), "dd.MM.yyyy HH:mm") : "Noma'lum"}
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Order Info */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getOrderTypeIcon(order.orderType)}
              <div className="font-medium text-lg">
                {order.orderType === "table"
                  ? order.roomNumber
                    ? `Xona #${order.roomNumber}`
                    : `Stol #${order.tableNumber || "?"}`
                  : order.orderType === "delivery"
                    ? "Yetkazib berish"
                    : "Saboy"}
              </div>
            </div>
            <div className="font-semibold text-primary">{formatCurrency(orderTotal)}</div>
          </div>

          {/* Order Type and Status */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={getStatusColor(order.status || "unknown")}>
              {getStatusText(order.status || "unknown")}
            </Badge>
            <Badge variant="outline" className={getPaymentStatusColor(order.isPaid || false)}>
              {getPaymentStatusText(order.isPaid || false)}
            </Badge>
          </div>

          {/* Customer info */}
          {order.customerName && order.customerName !== "Saboy mijozi" && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <User className="h-3 w-3" />
              <span>{order.customerName}</span>
            </div>
          )}

          {/* Waiter for table orders */}
          {order.orderType === "table" && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <User className="h-3 w-3" />
              <span>Ofitsiant: {waiterName}</span>
            </div>
          )}

          {/* Contact info for delivery */}
          {order.orderType === "delivery" && (
            <div className="space-y-1 mb-2">
              {(order.phoneNumber || order.customerPhone) && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{order.phoneNumber || order.customerPhone}</span>
                </div>
              )}
              {order.address && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{order.address}</span>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Yaratilgan: </span>
              <span>
                {order.createdAt?.toDate ? format(new Date(order.createdAt.toDate()), "dd.MM.yyyy HH:mm") : "Noma'lum"}
              </span>
            </div>
            {order.isPaid && order.paidAt?.toDate && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>To'langan: </span>
                <span>{format(new Date(order.paidAt.toDate()), "dd.MM.yyyy HH:mm")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items Summary */}
        <div className="mb-3">
          <div className="mb-1 text-sm font-medium">Buyurtma tarkibi ({itemsCount} ta mahsulot):</div>
          <div className="space-y-1 text-sm max-h-20 overflow-y-auto">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span className="truncate">
                  {item.quantity || 0} × {item.name || "Noma'lum"}
                </span>
                <span className="text-muted-foreground ml-2 flex-shrink-0">
                  {formatCurrency((item.price || 0) * (item.quantity || 1))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onSelect(order)} className="flex-1">
            <Eye className="mr-1 h-3 w-3" />
            Batafsil
          </Button>
        </div>
      </div>
    </div>
  )
}

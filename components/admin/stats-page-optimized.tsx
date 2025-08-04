"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, query, getDocs, type Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { parseDate, formatDate } from "@/lib/date-utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Loader2 } from "lucide-react"

// Define types
interface Order {
  id: string
  tableNumber: string
  items: OrderItem[]
  status: string
  total: number
  createdAt: Timestamp
  orderDate?: string
  paymentMethod?: string
}

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  category?: string
}

interface CategorySales {
  name: string
  value: number
}

interface DailySales {
  date: string
  sales: number
}

interface ItemSales {
  name: string
  quantity: number
  revenue: number
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#8dd1e1",
  "#a4de6c",
  "#d0ed57",
]

export default function StatsPageOptimized() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("week")
  const [paymentFilter, setPaymentFilter] = useState("all")

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      try {
        const ordersRef = collection(db, "orders")
        const q = query(ordersRef)
        const querySnapshot = await getDocs(q)

        const fetchedOrders: Order[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Order
          fetchedOrders.push({
            id: doc.id,
            ...data,
          })
        })

        setOrders(fetchedOrders)
      } catch (error) {
        console.error("Error fetching orders:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  // Filter orders based on time range and payment method
  const filteredOrders = useMemo(() => {
    if (!orders.length) return []

    // Get the current date
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Filter by time range
    let filteredByTime = orders.filter((order) => {
      // Try to use orderDate first, fall back to createdAt
      let orderDate

      if (order.orderDate) {
        // Parse the orderDate string
        orderDate = parseDate(order.orderDate)
      } else if (order.createdAt) {
        // Fall back to createdAt timestamp
        orderDate = order.createdAt.toDate()
      } else {
        // If neither exists, skip this order
        return false
      }

      if (!orderDate) return false

      const orderTime = orderDate.getTime()

      switch (timeRange) {
        case "today":
          return orderTime >= today.getTime()
        case "week": {
          const weekAgo = new Date(today)
          weekAgo.setDate(today.getDate() - 7)
          return orderTime >= weekAgo.getTime()
        }
        case "month": {
          const monthAgo = new Date(today)
          monthAgo.setMonth(today.getMonth() - 1)
          return orderTime >= monthAgo.getTime()
        }
        case "year": {
          const yearAgo = new Date(today)
          yearAgo.setFullYear(today.getFullYear() - 1)
          return orderTime >= yearAgo.getTime()
        }
        default:
          return true
      }
    })

    // Filter by payment method
    if (paymentFilter !== "all") {
      filteredByTime = filteredByTime.filter((order) => order.paymentMethod === paymentFilter)
    }

    return filteredByTime
  }, [orders, timeRange, paymentFilter])

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0)
  }, [filteredOrders])

  // Calculate total orders
  const totalOrders = useMemo(() => {
    return filteredOrders.length
  }, [filteredOrders])

  // Calculate average order value
  const averageOrderValue = useMemo(() => {
    if (totalOrders === 0) return 0
    return totalRevenue / totalOrders
  }, [totalRevenue, totalOrders])

  // Calculate sales by category
  const salesByCategory = useMemo(() => {
    const categorySales: Record<string, number> = {}

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const category = item.category || "Uncategorized"
        if (!categorySales[category]) {
          categorySales[category] = 0
        }
        categorySales[category] += item.price * item.quantity
      })
    })

    return Object.entries(categorySales).map(([name, value]) => ({
      name,
      value,
    }))
  }, [filteredOrders])

  // Calculate daily sales
  const dailySales = useMemo(() => {
    const salesByDay: Record<string, number> = {}

    filteredOrders.forEach((order) => {
      let orderDate

      if (order.orderDate) {
        // Parse the orderDate string
        orderDate = parseDate(order.orderDate)
      } else if (order.createdAt) {
        // Fall back to createdAt timestamp
        orderDate = order.createdAt.toDate()
      } else {
        // If neither exists, skip this order
        return
      }

      if (!orderDate) return

      const dateStr = formatDate(orderDate, "yyyy-MM-dd")
      if (!salesByDay[dateStr]) {
        salesByDay[dateStr] = 0
      }
      salesByDay[dateStr] += order.total || 0
    })

    // Convert to array and sort by date
    return Object.entries(salesByDay)
      .map(([date, sales]) => ({
        date: formatDate(parseDate(date), "MMM d"),
        sales,
      }))
      .sort((a, b) => {
        const dateA = parseDate(a.date, "MMM d")
        const dateB = parseDate(b.date, "MMM d")
        return dateA && dateB ? dateA.getTime() - dateB.getTime() : 0
      })
  }, [filteredOrders])

  // Calculate top selling items
  const topSellingItems = useMemo(() => {
    const itemSales: Record<string, { quantity: number; revenue: number }> = {}

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!itemSales[item.name]) {
          itemSales[item.name] = { quantity: 0, revenue: 0 }
        }
        itemSales[item.name].quantity += item.quantity
        itemSales[item.name].revenue += item.price * item.quantity
      })
    })

    return Object.entries(itemSales)
      .map(([name, { quantity, revenue }]) => ({
        name,
        quantity,
        revenue,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [filteredOrders])

  // Calculate payment method distribution
  const paymentMethodDistribution = useMemo(() => {
    const paymentMethods: Record<string, number> = {
      cash: 0,
      card: 0,
      other: 0,
    }

    filteredOrders.forEach((order) => {
      const method = order.paymentMethod || "other"
      if (paymentMethods[method] !== undefined) {
        paymentMethods[method] += 1
      } else {
        paymentMethods.other += 1
      }
    })

    return Object.entries(paymentMethods)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
      .filter((item) => item.value > 0)
  }, [filteredOrders])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading statistics...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Restaurant Statistics</h1>

        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Sales Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="items">Top Items</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {dailySales.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySales} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="sales" name="Sales" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No sales data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {salesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {salesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No category data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {topSellingItems.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topSellingItems}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "revenue") return formatCurrency(Number(value))
                        return value
                      }}
                    />
                    <Legend />
                    <Bar dataKey="quantity" name="Quantity Sold" fill="#82ca9d" />
                    <Bar dataKey="revenue" name="Revenue" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No item data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {paymentMethodDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethodDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No payment method data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
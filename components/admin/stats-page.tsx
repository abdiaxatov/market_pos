"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDate, formatTime } from "@/lib/date-utils"
import {
  BarChart,
  DollarSign,
  ShoppingBag,
  Download,
  CalendarIcon,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  TrendingUp,
  Users,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react"
import * as XLSX from "xlsx"
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  addDays,
  startOfDay,
  endOfDay,
  parseISO,
  isValid,
} from "date-fns"
import { OrderDetails } from "./order-details"
import type { MenuItem } from "@/types"

// Chart components
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line,
} from "recharts"

// Define interfaces for our data structures
interface TopItem {
  name: string
  count: number
  value: number
  revenue: number
}

interface DailyRevenue {
  date: string
  revenue: number
  orders: number
  paidRevenue?: number
  unpaidRevenue?: number
  tableRevenue?: number
  saboyRevenue?: number
  averageOrderValue?: number
}

interface OrdersByStatus {
  name: string
  value: number
  color: string
}

interface OrdersByType {
  name: string
  value: number
  color: string
}

interface CategoryData {
  id: string
  name: string
  itemCount: number
  revenue: number
  percentage: number
}

interface HourlyData {
  hour: string
  orders: number
  revenue: number
}

interface MonthlyData {
  month: string
  orders: number
  revenue: number
  tableRevenue: number
  saboyRevenue: number
}

interface WaiterPerformance {
  id: string
  name: string
  orderCount: number
  revenue: number
  averageOrderValue: number
  isCustomer?: boolean
}

interface DateRange {
  from: Date
  to: Date
}

interface OrderDetailsData {
  id: string
  orderType: string
  tableNumber?: number | null
  roomNumber?: number | null
  total: number
  subtotal: number
  createdAt: any
  updatedAt?: any
  status: string
  isPaid: boolean
  paidAt?: any
  items: Array<{
    id?: string
    name: string
    price: number
    quantity: number
    category?: string
  }>
  customerName?: string
  customerPhone?: string
  address?: string
  waiterId?: string
  waiterName?: string
  claimedBy?: string
  claimedByName?: string
  notes?: string
  seatingType?: string
  floor?: number
  containerCost?: number
  deliveryFee?: number
  orderDate?: string
  deletedAt?: any
  phoneNumber?: string
}

export function StatsPage() {
  // State variables
  const [todayOrders, setTodayOrders] = useState(0)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>([])
  const [ordersByStatus, setOrdersByStatus] = useState<OrdersByStatus[]>([])
  const [ordersByType, setOrdersByType] = useState<OrdersByType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "custom" | "year">("today")
  const [comparisonData, setComparisonData] = useState({
    ordersChange: 0,
    revenueChange: 0,
    averageOrderChange: 0,
    paidOrdersChange: 0,
  })
  const [totalPaidAmount, setTotalPaidAmount] = useState(0)
  const [totalUnpaidAmount, setTotalUnpaidAmount] = useState(0)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [expiredOrdersCount, setExpiredOrdersCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [orderDetails, setOrderDetails] = useState<OrderDetailsData[]>([])
  const [tableRevenue, setTableRevenue] = useState(0)
  const [saboyRevenue, setSaboyRevenue] = useState(0)
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [waiterPerformance, setWaiterPerformance] = useState<WaiterPerformance[]>([])
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })
  const [predefinedDateRange, setPredefinedDateRange] = useState<string>("last7days")
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"))
  const [orderTypeFilter, setOrderTypeFilter] = useState<string[]>(["table", "saboy", "delivery"])
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(["paid", "unpaid"])
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [orderHistoryTab, setOrderHistoryTab] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [averageOrderValue, setAverageOrderValue] = useState(0)
  const [averageItemsPerOrder, setAverageItemsPerOrder] = useState(0)
  const [mostPopularHour, setMostPopularHour] = useState("")
  const [mostPopularDay, setMostPopularDay] = useState("")
  const [topCategories, setTopCategories] = useState<CategoryData[]>([])
  const [orderGrowthRate, setOrderGrowthRate] = useState(0)
  const [revenueGrowthRate, setRevenueGrowthRate] = useState(0)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([])
  const [waiterFilter, setWaiterFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [orderCountByDay, setOrderCountByDay] = useState<{ day: string; count: number }[]>([])
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderDetailsData | null>(null)
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const { toast } = useToast()

  // Constants
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"]
  const STATUS_COLORS = {
    pending: "#FFBB28",
    preparing: "#0088FE",
    ready: "#00C49F",
    completed: "#8884d8",
    paid: "#82ca9d",
  }

  // Declare itemCounts here
  // const [itemCounts, setItemCounts] = useState<Record<string, number>>({})

  // Fetch categories and waiters on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch categories
        const categoriesSnapshot = await getDocs(collection(db, "categories"))
        const categoriesData = categoriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }))
        setCategories(categoriesData)

        // Fetch waiters
        const waitersSnapshot = await getDocs(query(collection(db, "users"), where("role", "in", ["waiter", "admin"])))
        const waitersData = waitersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }))
        setWaiters(waitersData)

        // Fetch menu items
        const menuItemsSnapshot = await getDocs(collection(db, "menu"))
        const menuItemsData = menuItemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MenuItem[]
        setMenuItems(menuItemsData)
      } catch (error) {
        console.error("Error fetching initial data:", error)
        toast({
          title: "Xatolik",
          description: "Ma'lumotlarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    }

    fetchInitialData()
  }, [toast])

  // Get date range based on selected time range
  const getDateRange = () => {
    const today = new Date()
    let startDate: Date
    let endDate = new Date(today)
    endDate.setHours(23, 59, 59, 999)

    switch (timeRange) {
      case "today":
        startDate = new Date(today)
        startDate.setHours(0, 0, 0, 0)
        break
      case "week":
        startDate = subDays(today, 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case "month":
        if (selectedMonth) {
          const [year, month] = selectedMonth.split("-").map(Number)
          startDate = new Date(year, month - 1, 1)
          endDate = new Date(year, month, 0)
          endDate.setHours(23, 59, 59, 999)
        } else {
          startDate = startOfMonth(today)
          endDate = endOfMonth(today)
        }
        break
      case "custom":
        if (predefinedDateRange === "custom" && customDateRange.from && customDateRange.to) {
          startDate = startOfDay(customDateRange.from)
          endDate = endOfDay(customDateRange.to)
        } else if (predefinedDateRange === "last7days") {
          startDate = subDays(today, 7)
          startDate.setHours(0, 0, 0, 0)
        } else if (predefinedDateRange === "last30days") {
          startDate = subDays(today, 30)
          startDate.setHours(0, 0, 0, 0)
        } else if (predefinedDateRange === "last90days") {
          startDate = subDays(today, 90)
          startDate.setHours(0, 0, 0, 0)
        } else if (predefinedDateRange === "specific") {
          startDate = new Date(2025, 3, 19) // April 19, 2025
          endDate = new Date(2025, 3, 26, 23, 59, 59, 999) // April 26, 2025
        } else {
          startDate = subDays(today, 7)
          startDate.setHours(0, 0, 0, 0)
        }
        break
      case "year":
        startDate = new Date(today.getFullYear(), 0, 1)
        endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999)
        break
      default:
        startDate = subDays(today, 7)
        startDate.setHours(0, 0, 0, 0)
    }

    return { startDate, endDate }
  }

  // Helper function to safely get date from Firestore timestamp or string
  const safeGetDate = (order: any): Date => {
    // For paid orders, prioritize paidAt timestamp
    if (order.status === "paid") {
      if (order.paidAt) {
        if (order.paidAt instanceof Timestamp || (order.paidAt && typeof order.paidAt.toDate === "function")) {
          return order.paidAt.toDate()
        }
        if (order.paidAt._seconds) {
          return new Date(order.paidAt._seconds * 1000)
        }
        if (typeof order.paidAt === "string") {
          const parsedDate = parseISO(order.paidAt)
          if (isValid(parsedDate)) {
            return parsedDate
          }
          const date = new Date(order.paidAt)
          if (!isNaN(date.getTime())) {
            return date
          }
        }
      }
    }

    // If not paid or paidAt is not available, use createdAt
    const timestamp = order.createdAt
    if (!timestamp) return new Date()

    if (timestamp instanceof Timestamp || (timestamp && typeof timestamp.toDate === "function")) {
      return timestamp.toDate()
    }

    if (timestamp._seconds) {
      return new Date(timestamp._seconds * 1000)
    }

    if (typeof timestamp === "string") {
      // Try to parse ISO string
      const parsedDate = parseISO(timestamp)
      if (isValid(parsedDate)) {
        return parsedDate
      }

      // Try to parse other date formats
      const date = new Date(timestamp)
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    return new Date()
  }

  // Helper function to check if an order is paid
  const isOrderPaid = (order: any): boolean => {
    return order.status === "paid"
  }

  // Helper function to get waiter ID from order
  const getWaiterId = (order: any): string => {
    return order.waiterId || order.claimedBy || ""
  }

  // Helper function to get waiter name from order
  const getWaiterName = (order: any, waiters: { id: string; name: string }[]): string => {
    const waiterId = getWaiterId(order)
    const waiterName = order.waiterName || order.claimedByName

    if (waiterName) return waiterName

    const waiter = waiters.find((w) => w.id === waiterId)
    return waiter ? waiter.name : "Noma'lum"
  }

  // Helper function to get category name for an item
  const getCategoryForItem = (itemName: string): string => {
    // Try exact match first
    let menuItem = menuItems.find((item) => item.name === itemName)
    
    // If no exact match, try case-insensitive match
    if (!menuItem) {
      menuItem = menuItems.find((item) => 
        item.name.toLowerCase() === itemName.toLowerCase()
      )
    }
    
    // If still no match, try partial match
    if (!menuItem) {
      menuItem = menuItems.find((item) => 
        item.name.toLowerCase().includes(itemName.toLowerCase()) ||
        itemName.toLowerCase().includes(item.name.toLowerCase())
      )
    }
    
    if (menuItem && menuItem.category) {
      const category = categories.find((cat) => cat.id === menuItem.category)
      return category ? category.name : "Boshqa"
    }
    return "Boshqa"
  }

  // Fetch stats based on selected time range
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)

        // Get date range
        const { startDate, endDate } = getDateRange()

        // For comparison with previous period
        const previousPeriodLength = differenceInDays(endDate, startDate) + 1
        const previousStartDate = subDays(startDate, previousPeriodLength)
        const previousEndDate = subDays(startDate, 1)

        // Query for orders
        const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"))

        const ordersSnapshot = await getDocs(ordersQuery)

        // Current period stats
        let orderCount = 0
        let revenue = 0
        let paidRevenue = 0
        let paidOrdersCount = 0
        let tableRevenueTotal = 0
        let saboyRevenueTotal = 0
        let deliveryRevenueTotal = 0
        const itemCounts: Record<string, { count: number; revenue: number }> = {}
        const statusCounts: Record<string, number> = {
          pending: 0,
          preparing: 0,
          ready: 0,
          completed: 0,
          paid: 0,
        }
        const typeCounts: Record<string, number> = {
          table: 0,
          saboy: 0,
          delivery: 0,
        }

        // For category data
        const categoryRevenue: Record<string, number> = {}
        const categoryItemCount: Record<string, number> = {}

        // For hourly data
        const hourlyOrders: Record<string, number> = {}
        const hourlyRevenue: Record<string, number> = {}

        // For monthly data
        const monthlyOrders: Record<string, number> = {}
        const monthlyRevenue: Record<string, number> = {}
        const monthlyTableRevenue: Record<string, number> = {}
        const monthlySaboyRevenue: Record<string, number> = {}
        const monthlyDeliveryRevenue: Record<string, number> = {}

        // For waiter performance
        const waiterOrders: Record<string, number> = {}
        const waiterRevenue: Record<string, number> = {}
        const waiterNames: Record<string, string> = {}

        // For order count by day of week
        const dayOfWeekCounts: Record<string, number> = {
          Sunday: 0,
          Monday: 0,
          Tuesday: 0,
          Wednesday: 0,
          Thursday: 0,
          Friday: 0,
          Saturday: 0,
        }

        // Daily/weekly/monthly data for charts
        const dailyData: Record<
          string,
          {
            revenue: number
            orders: number
            paidRevenue: number
            unpaidRevenue: number
            tableRevenue: number
            saboyRevenue: number
            deliveryRevenue: number
          }
        > = {}

        // Previous period stats
        let previousOrderCount = 0
        let previousRevenue = 0
        let previousPaidOrdersCount = 0

        // All order details
        const allOrderDetails: OrderDetailsData[] = []

        // Process each order
        for (const doc of ordersSnapshot.docs) {
          const orderData = doc.data()
          const order: OrderDetailsData = {
            id: doc.id,
            orderType: orderData.orderType || "table",
            tableNumber: orderData.tableNumber,
            roomNumber: orderData.roomNumber,
            total: orderData.total || 0,
            subtotal: orderData.subtotal || 0,
            createdAt: orderData.createdAt,
            updatedAt: orderData.updatedAt,
            status: orderData.status || "unknown",
            isPaid: isOrderPaid(orderData),
            paidAt: orderData.paidAt,
            items: orderData.items || [],
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone || orderData.phoneNumber,
            phoneNumber: orderData.phoneNumber,
            address: orderData.address,
            waiterId: orderData.waiterId,
            waiterName: orderData.waiterName,
            claimedBy: orderData.claimedBy,
            claimedByName: orderData.claimedByName,
            notes: orderData.notes,
            seatingType: orderData.seatingType,
            floor: orderData.floor,
            containerCost: orderData.containerCost || 0,
            deliveryFee: orderData.deliveryFee || 0,
            orderDate: orderData.orderDate,
            deletedAt: orderData.deletedAt,
          }

          // Check if order is within the selected date range
          const orderDate = safeGetDate(order)

          // Add to all order details regardless of date range
          allOrderDetails.push(order)

          // Check if order is in previous period for comparison
          if (orderDate >= previousStartDate && orderDate <= previousEndDate) {
            previousOrderCount++
            previousRevenue += order.total || 0

            if (order.status === "paid") {
              previousPaidOrdersCount++
            }
          }

          // Skip if not in current period
          if (orderDate < startDate || orderDate > endDate) {
            continue
          }

          // Apply filters
          if (
            (orderTypeFilter.length > 0 && !orderTypeFilter.includes(order.orderType)) ||
            (paymentStatusFilter.length > 0 &&
              ((order.isPaid && !paymentStatusFilter.includes("paid")) ||
                (!order.isPaid && !paymentStatusFilter.includes("unpaid")))) ||
            (waiterFilter !== "all" && getWaiterId(order) !== waiterFilter && waiterFilter !== "")
          ) {
            continue
          }

          // Check if any item in the order matches the category filter
          if (categoryFilter !== "all") {
            const hasMatchingCategory = order.items.some((item) => {
              const itemCategory = getCategoryForItem(item.name)
              return itemCategory === categoryFilter
            })

            if (!hasMatchingCategory) {
              continue
            }
          }

          orderCount++
          revenue += order.total || 0

          // Track revenue by order type
          if (order.orderType === "table") {
            tableRevenueTotal += order.total || 0
            typeCounts.table++
          } else if (order.orderType === "saboy") {
            saboyRevenueTotal += order.total || 0
            typeCounts.saboy++
          } else if (order.orderType === "delivery") {
            deliveryRevenueTotal += order.total || 0
            typeCounts.delivery++
          }

          // Count paid orders
          if (order.status === "paid") {
            paidRevenue += order.total || 0
            paidOrdersCount++
          }

          // Count items for popularity
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item) => {
              if (item && item.name) {
                const itemName = item.name
                const itemQuantity = item.quantity || 1
                const itemPrice = item.price || 0
                const itemRevenue = itemPrice * itemQuantity

                // Update item counts
                if (!itemCounts[itemName]) {
                  itemCounts[itemName] = { count: 0, revenue: 0 }
                }
                itemCounts[itemName].count += itemQuantity
                itemCounts[itemName].revenue += itemRevenue

                // Get category for this item
                const categoryName = getCategoryForItem(itemName)

                // Update category data
                if (!categoryRevenue[categoryName]) {
                  categoryRevenue[categoryName] = 0
                  categoryItemCount[categoryName] = 0
                }
                categoryRevenue[categoryName] += itemRevenue
                categoryItemCount[categoryName] += itemQuantity
              }
            })
          }

          // Count orders by status
          if (order.status && statusCounts[order.status] !== undefined) {
            statusCounts[order.status]++
          }

          // Update waiter performance
          const waiterId = getWaiterId(order)
          const waiterName = getWaiterName(order, waiters)

          if (waiterId) {
            waiterOrders[waiterId] = (waiterOrders[waiterId] || 0) + 1
            waiterRevenue[waiterId] = (waiterRevenue[waiterId] || 0) + (order.total || 0)
            waiterNames[waiterId] = waiterName
          } else if (order.customerName) {
            // Handle customer orders
            const customerId = `customer_${order.customerName}`
            waiterOrders[customerId] = (waiterOrders[customerId] || 0) + 1
            waiterRevenue[customerId] = (waiterRevenue[customerId] || 0) + (order.total || 0)
            waiterNames[customerId] = `Mijoz (${order.customerName})`
          }

          // Aggregate daily data
          const dateKey = format(orderDate, timeRange === "today" ? "HH:00" : "yyyy-MM-dd")
          if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
              revenue: 0,
              orders: 0,
              paidRevenue: 0,
              unpaidRevenue: 0,
              tableRevenue: 0,
              saboyRevenue: 0,
              deliveryRevenue: 0,
            }
          }

          dailyData[dateKey].revenue += order.total || 0
          dailyData[dateKey].orders += 1

          if (order.orderType === "table") {
            dailyData[dateKey].tableRevenue += order.total || 0
          } else if (order.orderType === "saboy") {
            dailyData[dateKey].saboyRevenue += order.total || 0
          } else if (order.orderType === "delivery") {
            dailyData[dateKey].deliveryRevenue += order.total || 0
          }

          if (order.status === "paid") {
            dailyData[dateKey].paidRevenue += order.total || 0
          } else {
            dailyData[dateKey].unpaidRevenue += order.total || 0
          }

          // Hourly data
          const hour = format(orderDate, "HH:00")
          hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1
          hourlyRevenue[hour] = (hourlyRevenue[hour] || 0) + (order.total || 0)

          // Monthly data
          const month = format(orderDate, "yyyy-MM")
          monthlyOrders[month] = (monthlyOrders[month] || 0) + 1
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (order.total || 0)

          if (order.orderType === "table") {
            monthlyTableRevenue[month] = (monthlyTableRevenue[month] || 0) + (order.total || 0)
          } else if (order.orderType === "saboy") {
            monthlySaboyRevenue[month] = (monthlySaboyRevenue[month] || 0) + (order.total || 0)
          } else if (order.orderType === "delivery") {
            monthlyDeliveryRevenue[month] = (monthlyDeliveryRevenue[month] || 0) + (order.total || 0)
          }

          // Day of week
          const dayOfWeek = format(orderDate, "EEEE")
          dayOfWeekCounts[dayOfWeek]++
        }

        // Calculate changes
        const ordersChange = previousOrderCount > 0 ? ((orderCount - previousOrderCount) / previousOrderCount) * 100 : 0
        const revenueChange = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0
        const paidOrdersChange =
          previousPaidOrdersCount > 0
            ? ((paidOrdersCount - previousPaidOrdersCount) / previousPaidOrdersCount) * 100
            : 0

        const currentAvgOrder = orderCount > 0 ? revenue / orderCount : 0
        const previousAvgOrder = previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0
        const averageOrderChange =
          previousAvgOrder > 0 ? ((currentAvgOrder - previousAvgOrder) / previousAvgOrder) * 100 : 0

        setComparisonData({
          ordersChange,
          revenueChange,
          averageOrderChange,
          paidOrdersChange,
        })

        // Calculate average order value
        const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0
        setAverageOrderValue(avgOrderValue)

        // Calculate average items per order
        const totalItems = Object.values(itemCounts).reduce((sum, item) => sum + item.count, 0)
        const avgItemsPerOrder = orderCount > 0 ? totalItems / orderCount : 0
        setAverageItemsPerOrder(avgItemsPerOrder)

        // Find most popular hour
        let maxHourOrders = 0
        let popularHour = ""
        Object.entries(hourlyOrders).forEach(([hour, count]) => {
          if (count > maxHourOrders) {
            maxHourOrders = count
            popularHour = hour
          }
        })
        setMostPopularHour(popularHour)

        // Find most popular day
        let maxDayOrders = 0
        let popularDay = ""
        Object.entries(dayOfWeekCounts).forEach(([day, count]) => {
          if (count > maxDayOrders) {
            maxDayOrders = count
            popularDay = day
          }
        })
        setMostPopularDay(popularDay)

        // Calculate growth rates
        setOrderGrowthRate(ordersChange)
        setRevenueGrowthRate(revenueChange)

        // Convert to array and sort by count
        const topItemsArray = Object.entries(itemCounts)
          .map(([name, data]) => ({
            name,
            count: data.count,
            value: data.count,
            revenue: data.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)

        // Create orders by status data for pie chart
        const ordersByStatusArray = [
          { name: "Kutilmoqda", value: statusCounts.pending, color: STATUS_COLORS.pending },
          { name: "Tayyorlanmoqda", value: statusCounts.preparing, color: STATUS_COLORS.preparing },
          { name: "Tayyor", value: statusCounts.ready, color: STATUS_COLORS.ready },
          { name: "Yakunlangan", value: statusCounts.completed, color: STATUS_COLORS.completed },
          { name: "To'landi", value: statusCounts.paid, color: STATUS_COLORS.paid },
        ].filter((item) => item.value > 0)

        // Create orders by type data for pie chart
        const ordersByTypeArray = [
          { name: "Stol buyurtmasi", value: typeCounts.table, color: "#0088FE" },
          { name: "Saboy", value: typeCounts.saboy, color: "#00C49F" },
          { name: "Yetkazib berish", value: typeCounts.delivery, color: "#FFBB28" },
        ].filter((item) => item.value > 0)

        // Prepare category data
        const categoryDataArray: CategoryData[] = Object.keys(categoryRevenue)
          .map((categoryName) => {
            return {
              id: categoryName,
              name: categoryName,
              itemCount: categoryItemCount[categoryName] || 0,
              revenue: categoryRevenue[categoryName] || 0,
              percentage: revenue > 0 ? ((categoryRevenue[categoryName] || 0) / revenue) * 100 : 0,
            }
          })
          .sort((a, b) => b.revenue - a.revenue)

        // Prepare hourly data
        const hourlyDataArray: HourlyData[] = Object.keys(hourlyOrders)
          .map((hour) => ({
            hour,
            orders: hourlyOrders[hour] || 0,
            revenue: hourlyRevenue[hour] || 0,
          }))
          .sort((a, b) => {
            const hourA = Number.parseInt(a.hour.split(":")[0])
            const hourB = Number.parseInt(b.hour.split(":")[0])
            return hourA - hourB
          })

        // Prepare monthly data
        const monthlyDataArray: MonthlyData[] = Object.keys(monthlyOrders)
          .map((month) => ({
            month,
            orders: monthlyOrders[month] || 0,
            revenue: monthlyRevenue[month] || 0,
            tableRevenue: monthlyTableRevenue[month] || 0,
            saboyRevenue: monthlySaboyRevenue[month] || 0,
          }))
          .sort((a, b) => {
            const [yearA, monthA] = a.month.split("-").map(Number)
            const [yearB, monthB] = b.month.split("-").map(Number)
            return yearA !== yearB ? yearA - yearB : monthA - monthB
          })

        // Prepare waiter performance data
        const waiterPerformanceArray: WaiterPerformance[] = Object.keys(waiterOrders)
          .map((id) => ({
            id,
            name: waiterNames[id] || waiters.find((w) => w.id === id)?.name || "Unknown",
            orderCount: waiterOrders[id] || 0,
            revenue: waiterRevenue[id] || 0,
            averageOrderValue: waiterOrders[id] > 0 ? waiterRevenue[id] / waiterOrders[id] : 0,
            isCustomer: id.startsWith("customer_"),
          }))
          .sort((a, b) => b.revenue - a.revenue)

        // Prepare order count by day of week
        const orderCountByDayArray = Object.entries(dayOfWeekCounts)
          .map(([day, count]) => ({ day, count }))
          .sort((a, b) => {
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            return days.indexOf(a.day) - days.indexOf(b.day)
          })

        // Set state with all the calculated data
        setTodayOrders(orderCount)
        setTodayRevenue(revenue)
        setTopItems(topItemsArray)
        setOrdersByStatus(ordersByStatusArray)
        setOrdersByType(ordersByTypeArray)
        setTotalPaidAmount(paidRevenue)
        setTotalUnpaidAmount(revenue - paidRevenue)
        setOrderDetails(allOrderDetails)
        setItemCounts(itemCounts)
        setTableRevenue(tableRevenueTotal)
        setSaboyRevenue(saboyRevenueTotal)
        setCategoryData(categoryDataArray)
        setHourlyData(hourlyDataArray)
        setMonthlyData(monthlyDataArray)
        setWaiterPerformance(waiterPerformanceArray)
        setOrderCountByDay(orderCountByDayArray)
        setTopCategories(categoryDataArray.slice(0, 5))

        // Prepare time series data for charts
        const timeSeriesData: DailyRevenue[] = []

        if (timeRange === "today") {
          // For today, show hourly data
          for (let hour = 0; hour < 24; hour++) {
            const hourKey = `${hour.toString().padStart(2, "0")}:00`
            const hourData = dailyData[hourKey] || {
              revenue: 0,
              orders: 0,
              paidRevenue: 0,
              unpaidRevenue: 0,
              tableRevenue: 0,
              saboyRevenue: 0,
              deliveryRevenue: 0,
            }

            const avgValue = hourData.orders > 0 ? hourData.revenue / hourData.orders : 0

            timeSeriesData.push({
              date: hourKey,
              revenue: hourData.revenue,
              orders: hourData.orders,
              paidRevenue: hourData.paidRevenue,
              unpaidRevenue: hourData.unpaidRevenue,
              tableRevenue: hourData.tableRevenue,
              saboyRevenue: hourData.saboyRevenue,
              averageOrderValue: avgValue,
            })
          }
        } else if (timeRange === "week") {
          // For week, show daily data for the last 7 days
          for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i)
            const dateKey = format(date, "yyyy-MM-dd")
            const dateStr = format(date, "dd MMM")
            const dayData = dailyData[dateKey] || {
              revenue: 0,
              orders: 0,
              paidRevenue: 0,
              unpaidRevenue: 0,
              tableRevenue: 0,
              saboyRevenue: 0,
              deliveryRevenue: 0,
            }

            const avgValue = dayData.orders > 0 ? dayData.revenue / dayData.orders : 0

            timeSeriesData.push({
              date: dateStr,
              revenue: dayData.revenue,
              orders: dayData.orders,
              paidRevenue: dayData.paidRevenue,
              unpaidRevenue: dayData.unpaidRevenue,
              tableRevenue: dayData.tableRevenue,
              saboyRevenue: dayData.saboyRevenue,
              averageOrderValue: avgValue,
            })
          }
        } else if (timeRange === "month") {
          // For month, show daily data for the selected month
          const [year, month] = selectedMonth
            ? selectedMonth.split("-").map(Number)
            : [new Date().getFullYear(), new Date().getMonth() + 1]
          const daysInMonth = new Date(year, month, 0).getDate()

          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day)
            const dateKey = format(date, "yyyy-MM-dd")
            const dateStr = format(date, "dd MMM")
            const dayData = dailyData[dateKey] || {
              revenue: 0,
              orders: 0,
              paidRevenue: 0,
              unpaidRevenue: 0,
              tableRevenue: 0,
              saboyRevenue: 0,
              deliveryRevenue: 0,
            }

            const avgValue = dayData.orders > 0 ? dayData.revenue / dayData.orders : 0

            timeSeriesData.push({
              date: dateStr,
              revenue: dayData.revenue,
              orders: dayData.orders,
              paidRevenue: dayData.paidRevenue,
              unpaidRevenue: dayData.unpaidRevenue,
              tableRevenue: dayData.tableRevenue,
              saboyRevenue: dayData.saboyRevenue,
              averageOrderValue: avgValue,
            })
          }
        } else if (timeRange === "custom") {
          // For custom range, show daily data for the selected range
          const { from, to } = customDateRange
          const dayCount = differenceInDays(to, from) + 1

          for (let i = 0; i < dayCount; i++) {
            const date = addDays(from, i)
            const dateKey = format(date, "yyyy-MM-dd")
            const dateStr = format(date, "dd MMM")
            const dayData = dailyData[dateKey] || {
              revenue: 0,
              orders: 0,
              paidRevenue: 0,
              unpaidRevenue: 0,
              tableRevenue: 0,
              saboyRevenue: 0,
              deliveryRevenue: 0,
            }

            const avgValue = dayData.orders > 0 ? dayData.revenue / dayData.orders : 0

            timeSeriesData.push({
              date: dateStr,
              revenue: dayData.revenue,
              orders: dayData.orders,
              paidRevenue: dayData.paidRevenue,
              unpaidRevenue: dayData.unpaidRevenue,
              tableRevenue: dayData.tableRevenue,
              saboyRevenue: dayData.saboyRevenue,
              averageOrderValue: avgValue,
            })
          }
        } else if (timeRange === "year") {
          // For year, show monthly data
          const currentYear = new Date().getFullYear()

          for (let month = 0; month < 12; month++) {
            const date = new Date(currentYear, month, 1)
            const monthKey = format(date, "yyyy-MM")
            const monthStr = format(date, "MMM")
            const monthData = {
              revenue: monthlyRevenue[monthKey] || 0,
              orders: monthlyOrders[monthKey] || 0,
              tableRevenue: monthlyTableRevenue[monthKey] || 0,
              saboyRevenue: monthlySaboyRevenue[monthKey] || 0,
            }

            const avgValue = monthData.orders > 0 ? monthData.revenue / monthData.orders : 0

            timeSeriesData.push({
              date: monthStr,
              revenue: monthData.revenue,
              orders: monthData.orders,
              tableRevenue: monthData.tableRevenue,
              saboyRevenue: monthData.saboyRevenue,
              averageOrderValue: avgValue,
            })
          }
        }

        setRevenueData(timeSeriesData)
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching stats:", error)
        toast({
          title: "Xatolik",
          description: "Statistikani yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [
    toast,
    timeRange,
    selectedMonth,
    customDateRange,
    predefinedDateRange,
    orderTypeFilter,
    paymentStatusFilter,
    waiterFilter,
    categoryFilter,
    categories,
    waiters,
    menuItems,
  ])

  // Filter order details based on search query and tab
  const filteredOrderDetails = useMemo(() => {
    return orderDetails.filter((order) => {
      // Filter by tab
      const tabMatch =
        orderHistoryTab === "all" ||
        (orderHistoryTab === "table" && order.orderType === "table") ||
        (orderHistoryTab === "saboy" && order.orderType === "saboy") ||
        (orderHistoryTab === "delivery" && order.orderType === "delivery")

      // Filter by search query
      const searchMatch =
        searchQuery === "" ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.customerPhone && order.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.items && order.items.some((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase())))

      // Filter by status
      const statusMatch = statusFilter === "all" || order.status === statusFilter

      return tabMatch && searchMatch && statusMatch
    })
  }, [orderDetails, orderHistoryTab, searchQuery, statusFilter])

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value)
  }

  const getSeatingTypeDisplay = (order: OrderDetailsData) => {
    if (!order) return "Noma'lum"

    if (order.orderType === "saboy") {
      return "Saboy"
    }

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

  const exportToExcel = () => {
    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()

      // Create main stats sheet
      const mainStats = [
        [
          "Statistika",
          timeRange === "today"
            ? "Bugun"
            : timeRange === "week"
              ? "Hafta"
              : timeRange === "month"
                ? "Oy"
                : "Tanlangan davr",
        ],
        ["Buyurtmalar soni", todayOrders],
        ["Jami tushum", todayRevenue],
        ["To'langan summa", totalPaidAmount],
        ["To'lanmagan summa", totalUnpaidAmount],
        ["O'rtacha buyurtma qiymati", averageOrderValue],
        ["O'rtacha mahsulotlar soni", averageItemsPerOrder],
        [],
        ["Buyurtma turlari bo'yicha tushum"],
        ["Stol buyurtmalari", tableRevenue],
        ["Saboy buyurtmalari", saboyRevenue],
        [],
        ["Buyurtmalar holati"],
        ["Holat", "Soni"],
        ...ordersByStatus.map((item) => [item.name, item.value]),
        [],
        ["Buyurtma turlari"],
        ["Tur", "Soni"],
        ...ordersByType.map((item) => [item.name, item.value]),
        [],
        ["Eng mashhur taomlar"],
        ["Taom nomi", "Soni"],
        ...topItems.map((item) => [item.name, item.count]),
      ]

      // Add revenue data if available
      if (revenueData.length > 0) {
        mainStats.push([])
        mainStats.push([timeRange === "week" ? "Haftalik tushum" : "Oylik tushum"])
        mainStats.push(["Sana", "Tushum", "To'langan", "To'lanmagan", "Buyurtmalar"])
        revenueData.forEach((item) => {
          mainStats.push([item.date, item.revenue, item.paidRevenue, item.unpaidRevenue, item.orders])
        })
      }

      const ws = XLSX.utils.aoa_to_sheet(mainStats)
      XLSX.utils.book_append_sheet(wb, ws, "Statistika")

      // Add order details sheet
      const orderDetailsData = [
        ["ID", "Sana", "Tur", "Stol/Xona", "Mijoz", "Telefon", "Holat", "To'lov", "Summa", "Mahsulotlar"],
      ]

      orderDetails.forEach((order) => {
        const orderDate = safeGetDate(order)
        orderDetailsData.push([
          order.id,
          format(orderDate, "yyyy-MM-dd HH:mm"),
          order.orderType === "table" ? "Stol" : order.orderType === "saboy" ? "Saboy" : "Yetkazib berish",
          order.orderType === "table"
            ? order.roomNumber
              ? `Xona #${order.roomNumber}`
              : `Stol #${order.tableNumber}`
            : "-",
          order.customerName || "-",
          order.customerPhone || order.phoneNumber || "-",
          order.status,
          order.isPaid ? "To'langan" : "To'lanmagan",
          order.total,
          order.items.map((item) => `${item.quantity}x ${item.name}`).join(", "),
        ])
      })

      const orderDetailsWs = XLSX.utils.aoa_to_sheet(orderDetailsData)
      XLSX.utils.book_append_sheet(wb, orderDetailsWs, "Buyurtmalar")

      // Generate filename based on date range
      const dateStr = new Date()
        .toLocaleDateString("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "-")

      const filename = `Statistika_${timeRange === "today" ? "Kun" : timeRange === "week" ? "Hafta" : timeRange === "month" ? "Oy" : "Tanlangan_davr"}_${dateStr}.xlsx`

      // Save file
      XLSX.writeFile(wb, filename)

      toast({
        title: "Muvaffaqiyatli",
        description: "Statistika ma'lumotlari Excel formatida yuklab olindi",
      })
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast({
        title: "Xatolik",
        description: "Excel faylini yaratishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const renderChangeIndicator = (value: number) => {
    if (value > 0) {
      return (
        <div className="flex items-center text-green-600">
          <ArrowUpRight className="mr-1 h-4 w-4" />
          <span>+{value.toFixed(1)}%</span>
        </div>
      )
    } else if (value < 0) {
      return (
        <div className="flex items-center text-red-600">
          <ArrowDownRight className="mr-1 h-4 w-4" />
          <span>{value.toFixed(1)}%</span>
        </div>
      )
    }
    return <span className="text-muted-foreground">0%</span>
  }

  const handleViewOrderDetails = (order: OrderDetailsData) => {
    setSelectedOrderDetails(order)
    setIsOrderDetailsDialogOpen(true)
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Kutilmoqda"
      case "preparing":
        return "Tayyorlanmoqda"
      case "ready":
        return "Tayyor"
      case "completed":
        return "Yakunlangan"
      case "paid":
        return "To'landi"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "preparing":
        return "bg-blue-100 text-blue-800"
      case "ready":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-purple-100 text-purple-800"
      case "paid":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div>
      <div className="container mx-auto p-4">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Statistika</h1>

          <div className="flex flex-wrap items-center gap-4">
            <Tabs defaultValue={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
              <TabsList>
                <TabsTrigger value="today" className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Bugun</span>
                </TabsTrigger>
                <TabsTrigger value="week" className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Hafta</span>
                </TabsTrigger>
                <TabsTrigger value="month" className="flex items-center gap-1">
                  <BarChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Oy</span>
                </TabsTrigger>
                <TabsTrigger value="year" className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Yil</span>
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex items-center gap-1">
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Boshqa</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {timeRange === "month" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Oy tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const date = new Date(new Date().getFullYear(), i, 1)
                    const monthValue = format(date, "yyyy-MM")
                    const monthLabel = format(date, "MMMM yyyy")
                    return (
                      <SelectItem key={monthValue} value={monthValue}>
                        {monthLabel}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}

            {timeRange === "custom" && (
              <div className="flex items-center gap-2">
                <Select value={predefinedDateRange} onValueChange={setPredefinedDateRange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Davr tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last7days">So'nggi 7 kun</SelectItem>
                    <SelectItem value="last30days">So'nggi 30 kun</SelectItem>
                    <SelectItem value="last90days">So'nggi 90 kun</SelectItem>
                    <SelectItem value="custom">Boshqa davr</SelectItem>
                  </SelectContent>
                </Select>

                {predefinedDateRange === "custom" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[240px] justify-start text-left font-normal bg-transparent"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.from ? (
                          customDateRange.to ? (
                            <>
                              {format(customDateRange.from, "dd/MM/yyyy")} - {format(customDateRange.to, "dd/MM/yyyy")}
                            </>
                          ) : (
                            format(customDateRange.from, "dd/MM/yyyy")
                          )
                        ) : (
                          <span>Sana tanlang</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={customDateRange.from}
                        selected={{
                          from: customDateRange.from,
                          to: customDateRange.to,
                        }}
                        onSelect={(range) => {
                          if (range?.from && range?.to) {
                            setCustomDateRange({ from: range.from, to: range.to })
                          }
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            <Button variant="outline" onClick={() => setIsFilterDialogOpen(true)}>
              <Filter className="mr-2 h-4 w-4" />
              Filtrlar
            </Button>

            <Button variant="outline" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}

            <Card className="col-span-2">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full" />
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Umumiy ko'rinish</TabsTrigger>
              <TabsTrigger value="revenue">Tushum</TabsTrigger>
              <TabsTrigger value="orders">Buyurtmalar</TabsTrigger>
              <TabsTrigger value="items">Mahsulotlar</TabsTrigger>
              <TabsTrigger value="waiters">Ofitsiantlar</TabsTrigger>
              <TabsTrigger value="history">Buyurtmalar tarixi</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      {timeRange === "today"
                        ? "Bugungi buyurtmalar"
                        : timeRange === "week"
                          ? "Haftalik buyurtmalar"
                          : timeRange === "month"
                            ? "Oylik buyurtmalar"
                            : "Buyurtmalar"}
                    </CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{todayOrders}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        O'tgan {timeRange === "today" ? "kun" : timeRange === "week" ? "hafta" : "oy"}ga nisbatan
                      </span>
                      {renderChangeIndicator(comparisonData.ordersChange)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      {timeRange === "today"
                        ? "Bugungi tushum"
                        : timeRange === "week"
                          ? "Haftalik tushum"
                          : timeRange === "month"
                            ? "Oylik tushum"
                            : "Tushum"}
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        O'tgan {timeRange === "today" ? "kun" : timeRange === "week" ? "hafta" : "oy"}ga nisbatan
                      </span>
                      {renderChangeIndicator(comparisonData.revenueChange)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">To'langan summa</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidAmount)}</div>
                    <div className="mt-1">
                      <Progress
                        value={todayRevenue > 0 ? (totalPaidAmount / todayRevenue) * 100 : 0}
                        className="h-2 bg-gray-100"
                      />
                      <div className="mt-1 text-sm text-muted-foreground">
                        {todayRevenue > 0
                          ? `${((totalPaidAmount / todayRevenue) * 100).toFixed(1)}% to'langan`
                          : "Ma'lumot yo'q"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">To'lanmagan summa</CardTitle>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(totalUnpaidAmount)}</div>
                    <div className="mt-1">
                      <Progress
                        value={todayRevenue > 0 ? (totalUnpaidAmount / todayRevenue) * 100 : 0}
                        className="h-2 bg-gray-100"
                      />
                      <div className="mt-1 text-sm text-muted-foreground">
                        {todayRevenue > 0
                          ? `${((totalUnpaidAmount / todayRevenue) * 100).toFixed(1)}% to'lanmagan`
                          : "Ma'lumot yo'q"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-8 grid gap-6 md:grid-cols-2">
                {/* Revenue Chart */}
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Tushum dinamikasi</CardTitle>
                    <CardDescription>
                      {timeRange === "today"
                        ? "Bugungi soatlik tushum"
                        : timeRange === "week"
                          ? "Haftalik tushum"
                          : timeRange === "month"
                            ? "Oylik tushum"
                            : "Tushum dinamikasi"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={revenueData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="revenue" name="Jami tushum" fill="#8884d8" />
                          <Bar dataKey="paidRevenue" name="To'langan" fill="#82ca9d" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Order Types Chart */}
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Buyurtma turlari</CardTitle>
                    <CardDescription>Buyurtma turlari bo'yicha taqsimot</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={ordersByType}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {ordersByType.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, "Buyurtmalar soni"]} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{formatCurrency(tableRevenue)}</div>
                        <div className="text-sm text-muted-foreground">Stol buyurtmalari</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{formatCurrency(saboyRevenue)}</div>
                        <div className="text-sm text-muted-foreground">Saboy buyurtmalari</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(todayRevenue - tableRevenue - saboyRevenue)}
                        </div>
                        <div className="text-sm text-muted-foreground">Yetkazib berish</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-8 grid gap-6 md:grid-cols-2">
                {/* Top Items */}
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Eng ko'p sotilgan taomlar</CardTitle>
                    <CardDescription>Eng mashhur taomlar va ularning sotilish soni</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topItems.length > 0 ? (
                        topItems.map((item, index) => {
                          const maxRevenue = topItems[0].revenue
                          const percentage = (item.revenue / maxRevenue) * 100

                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{item.name}</span>
                                <span className="font-medium">{formatCurrency(item.revenue)}</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                              <div className="text-xs text-muted-foreground">{item.count} ta sotilgan</div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">Ma'lumot topilmadi</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Order Status */}
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Buyurtma holatlari</CardTitle>
                    <CardDescription>Buyurtmalar holati bo'yicha taqsimot</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={ordersByStatus}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {ordersByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, "Buyurtmalar soni"]} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Waiter Performance */}
              <Card className="mb-8 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>Ofitsiantlar samaradorligi</CardTitle>
                  <CardDescription>Ofitsiantlar bo'yicha buyurtmalar va tushum</CardDescription>
                </CardHeader>
                <CardContent>
                  {waiterPerformance.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {waiterPerformance
                        .filter((waiter) => !waiter.isCustomer)
                        .slice(0, 6)
                        .map((waiter) => (
                          <Card key={waiter.id} className="bg-muted/50">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4" />
                                <h3 className="font-medium">{waiter.name}</h3>
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span>Buyurtmalar:</span>
                                  <span className="font-medium">{waiter.orderCount}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Daromad:</span>
                                  <span className="font-medium">{formatCurrency(waiter.revenue)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>O'rtacha buyurtma:</span>
                                  <span className="font-medium">{formatCurrency(waiter.averageOrderValue)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Ofitsiantlar bo'yicha ma'lumot topilmadi
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revenue">
              <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Jami tushum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {renderChangeIndicator(comparisonData.revenueChange)} o'tgan davr bilan taqqoslaganda
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">O'rtacha buyurtma qiymati</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {renderChangeIndicator(comparisonData.averageOrderChange)} o'tgan davr bilan taqqoslaganda
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">To'langan summa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidAmount)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {todayRevenue > 0
                        ? `${((totalPaidAmount / todayRevenue) * 100).toFixed(1)}% to'langan`
                        : "Ma'lumot yo'q"}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">To'lanmagan summa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(totalUnpaidAmount)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {todayRevenue > 0
                        ? `${((totalUnpaidAmount / todayRevenue) * 100).toFixed(1)}% to'lanmagan`
                        : "Ma'lumot yo'q"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-8 grid gap-6 md:grid-cols-2">
                {/* Revenue by Time */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tushum dinamikasi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={revenueData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="revenue" name="Jami tushum" fill="#8884d8" />
                          <Bar dataKey="paidRevenue" name="To'langan" fill="#82ca9d" />
                          <Bar dataKey="unpaidRevenue" name="To'lanmagan" fill="#ff8042" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue by Order Type */}
                <Card>
                  <CardHeader>
                    <CardTitle>Buyurtma turlari bo'yicha tushum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={revenueData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="tableRevenue" name="Stol buyurtmalari" fill="#0088FE" />
                          <Bar dataKey="saboyRevenue" name="Saboy buyurtmalari" fill="#00C49F" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Revenue Trends */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Oylik tushum tendensiyalari</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart
                        data={monthlyData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Jami tushum"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                        />
                        <Line type="monotone" dataKey="tableRevenue" name="Stol buyurtmalari" stroke="#0088FE" />
                        <Line type="monotone" dataKey="saboyRevenue" name="Saboy buyurtmalari" stroke="#00C49F" />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Category */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Kategoriyalar bo'yicha tushum</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryData.slice(0, 8).map((category, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{category.name}</span>
                          <span className="font-medium">{formatCurrency(category.revenue)}</span>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {category.percentage.toFixed(1)}% of total revenue • {category.itemCount} items sold
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Jami buyurtmalar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{todayOrders}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {renderChangeIndicator(comparisonData.ordersChange)} o'tgan davr bilan taqqoslaganda
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">O'rtacha mahsulotlar soni</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{averageItemsPerOrder.toFixed(1)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Har bir buyurtmada</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eng mashhur vaqt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mostPopularHour || "Ma'lumot yo'q"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Eng ko'p buyurtma qilingan vaqt</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eng mashhur kun</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mostPopularDay || "Ma'lumot yo'q"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Eng ko'p buyurtma qilingan kun</div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-8 grid gap-6 md:grid-cols-2">
                {/* Orders by Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Buyurtma holatlari</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={ordersByStatus}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {ordersByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, "Buyurtmalar soni"]} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Orders by Type */}
                <Card>
                  <CardHeader>
                    <CardTitle>Buyurtma turlari</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={ordersByType}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {ordersByType.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, "Buyurtmalar soni"]} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders by Day of Week */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Hafta kunlari bo'yicha buyurtmalar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={orderCountByDay}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" name="Buyurtmalar soni" fill="#8884d8" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Hourly Order Distribution */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Soatlik buyurtmalar taqsimoti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={hourlyData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis yAxisId="left" orientation="left" />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip
                          formatter={(value, name) => [
                            name === "orders" ? value : formatCurrency(Number(value)),
                            name === "orders" ? "Buyurtmalar soni" : "Tushum",
                          ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="orders" name="Buyurtmalar soni" fill="#8884d8" />
                        <Bar yAxisId="right" dataKey="revenue" name="Tushum" fill="#82ca9d" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items">
              <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Jami sotilgan mahsulotlar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Object.values(itemCounts).reduce((sum, item) => sum + item.count, 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">O'rtacha mahsulotlar soni</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{averageItemsPerOrder.toFixed(1)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Har bir buyurtmada</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eng mashhur taom</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{topItems.length > 0 ? topItems[0].name : "Ma'lumot yo'q"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {topItems.length > 0 ? `${topItems[0].count} ta sotilgan` : ""}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eng mashhur kategoriya</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {topCategories.length > 0 ? topCategories[0].name : "Ma'lumot yo'q"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {topCategories.length > 0 ? `${topCategories[0].itemCount} ta sotilgan` : ""}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Items */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Eng ko'p sotilgan taomlar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topItems.length > 0 ? (
                      topItems.map((item, index) => {
                        const maxRevenue = topItems[0].revenue
                        const percentage = (item.revenue / maxRevenue) * 100

                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{item.name}</span>
                              <span className="font-medium">{formatCurrency(item.revenue)}</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{item.count} ta sotilgan</span>
                              <span>{percentage.toFixed(1)}% of total revenue</span>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">Ma'lumot topilmadi</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Categories */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Kategoriyalar bo'yicha sotuvlar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryData.length > 0 ? (
                      categoryData.slice(0, 10).map((category, index) => {
                        const maxRevenue = categoryData[0].revenue
                        const percentage = (category.revenue / maxRevenue) * 100

                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{category.name}</span>
                              <span className="font-medium">{formatCurrency(category.revenue)}</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{category.itemCount} ta sotilgan</span>
                              <span>{category.percentage.toFixed(1)}% of total revenue</span>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">Ma'lumot topilmadi</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="waiters">
              <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Jami ofitsiantlar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{waiterPerformance.filter((w) => !w.isCustomer).length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">O'rtacha buyurtma qiymati</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eng yuqori daromad</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {waiterPerformance.length > 0 && !waiterPerformance[0].isCustomer
                        ? formatCurrency(waiterPerformance[0].revenue)
                        : "Ma'lumot yo'q"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {waiterPerformance.length > 0 && !waiterPerformance[0].isCustomer
                        ? waiterPerformance[0].name
                        : ""}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eng ko'p buyurtma</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {waiterPerformance.length > 0
                        ? waiterPerformance.filter((w) => !w.isCustomer).sort((a, b) => b.orderCount - a.orderCount)[0]
                            ?.orderCount || 0
                        : 0}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {waiterPerformance.length > 0
                        ? waiterPerformance.filter((w) => !w.isCustomer).sort((a, b) => b.orderCount - a.orderCount)[0]
                            ?.name || ""
                        : ""}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Waiter Performance */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Ofitsiantlar samaradorligi</CardTitle>
                </CardHeader>
                <CardContent>
                  {waiterPerformance.filter((w) => !w.isCustomer).length > 0 ? (
                    <div className="space-y-6">
                      {waiterPerformance
                        .filter((w) => !w.isCustomer)
                        .map((waiter, index) => {
                          const maxRevenue = waiterPerformance.filter((w) => !w.isCustomer)[0].revenue
                          const percentage = (waiter.revenue / maxRevenue) * 100

                          return (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <Users className="mr-2 h-5 w-5 text-muted-foreground" />
                                  <span className="font-medium">{waiter.name}</span>
                                </div>
                                <span className="font-bold">{formatCurrency(waiter.revenue)}</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{waiter.orderCount} buyurtma</span>
                                <span>O'rtacha: {formatCurrency(waiter.averageOrderValue)}</span>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Ofitsiantlar bo'yicha ma'lumot topilmadi
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Waiter Orders by Type */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Ofitsiantlar bo'yicha buyurtma turlari</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {waiterPerformance
                      .filter((w) => !w.isCustomer)
                      .slice(0, 6)
                      .map((waiter) => (
                        <Card key={waiter.id} className="bg-muted/50">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-4 w-4" />
                              <h3 className="font-medium">{waiter.name}</h3>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Buyurtmalar:</span>
                                <span className="font-medium">{waiter.orderCount}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Daromad:</span>
                                <span className="font-medium">{formatCurrency(waiter.revenue)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>O'rtacha buyurtma:</span>
                                <span className="font-medium">{formatCurrency(waiter.averageOrderValue)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buyurtma ID, mijoz yoki taom bo'yicha qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Holat bo'yicha filtrlash" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha holatlar</SelectItem>
                      <SelectItem value="pending">Kutilmoqda</SelectItem>
                      <SelectItem value="preparing">Tayyorlanmoqda</SelectItem>
                      <SelectItem value="ready">Tayyor</SelectItem>
                      <SelectItem value="completed">Yakunlangan</SelectItem>
                      <SelectItem value="paid">To'landi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Tabs value={orderHistoryTab} onValueChange={setOrderHistoryTab} className="w-full sm:w-auto">
                  <TabsList>
                    <TabsTrigger value="all">Hammasi</TabsTrigger>
                    <TabsTrigger value="table">Stol</TabsTrigger>
                    <TabsTrigger value="saboy">Saboy</TabsTrigger>
                    <TabsTrigger value="delivery">Yetkazib berish</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Buyurtmalar tarixi</CardTitle>
                  <CardDescription>{filteredOrderDetails.length} ta buyurtma topildi</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-7 bg-muted px-4 py-3 text-sm font-medium">
                      <div className="col-span-2">Buyurtma</div>
                      <div className="hidden md:block">Vaqt</div>
                      <div>Mijoz</div>
                      <div className="hidden md:block">Summa</div>
                      <div className="text-center">Holat</div>
                      <div></div>
                    </div>
                    <ScrollArea className="h-[500px]">
                      {filteredOrderDetails.length > 0 ? (
                        filteredOrderDetails.map((order) => {
                          const orderDate = safeGetDate(order)
                          const formattedDate = formatDate(orderDate)
                          const formattedTime = formatTime(orderDate)

                          return (
                            <div key={order.id} className="grid grid-cols-7 items-center border-t px-4 py-3 text-sm">
                              <div className="col-span-2">
                                <div className="font-medium">{order.id.substring(0, 8)}...</div>
                                <div className="text-xs text-muted-foreground">
                                  {getSeatingTypeDisplay(order)}
                                  {order.orderType === "table" && order.tableNumber && ` #${order.tableNumber}`}
                                  {order.orderType === "table" && order.roomNumber && ` #${order.roomNumber}`}
                                </div>
                              </div>
                              <div className="hidden md:block text-muted-foreground">
                                <div>{formattedDate}</div>
                                <div className="text-xs">{formattedTime}</div>
                              </div>
                              <div>
                                <div className="font-medium">
                                  {order.customerName || order.customerPhone || "Noma'lum"}
                                </div>
                                {order.customerPhone && (
                                  <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                                )}
                              </div>
                              <div className="hidden md:block font-medium">{formatCurrency(order.total)}</div>
                              <div className="text-center">
                                <Badge variant="outline" className={`${getStatusColor(order.status)}`}>
                                  {getStatusText(order.status)}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleViewOrderDetails(order)}>
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="px-4 py-8 text-center text-muted-foreground">Buyurtmalar topilmadi</div>
                      )}
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Filter Dialog */}
        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Filtrlar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Buyurtma turlari</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={orderTypeFilter.includes("table") ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (orderTypeFilter.includes("table")) {
                        setOrderTypeFilter(orderTypeFilter.filter((type) => type !== "table"))
                      } else {
                        setOrderTypeFilter([...orderTypeFilter, "table"])
                      }
                    }}
                  >
                    Stol
                  </Badge>
                  <Badge
                    variant={orderTypeFilter.includes("saboy") ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (orderTypeFilter.includes("saboy")) {
                        setOrderTypeFilter(orderTypeFilter.filter((type) => type !== "saboy"))
                      } else {
                        setOrderTypeFilter([...orderTypeFilter, "saboy"])
                      }
                    }}
                  >
                    Saboy
                  </Badge>
                  <Badge
                    variant={orderTypeFilter.includes("delivery") ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (orderTypeFilter.includes("delivery")) {
                        setOrderTypeFilter(orderTypeFilter.filter((type) => type !== "delivery"))
                      } else {
                        setOrderTypeFilter([...orderTypeFilter, "delivery"])
                      }
                    }}
                  >
                    Yetkazib berish
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">To'lov holati</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={paymentStatusFilter.includes("paid") ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (paymentStatusFilter.includes("paid")) {
                        setPaymentStatusFilter(paymentStatusFilter.filter((status) => status !== "paid"))
                      } else {
                        setPaymentStatusFilter([...paymentStatusFilter, "paid"])
                      }
                    }}
                  >
                    To'langan
                  </Badge>
                  <Badge
                    variant={paymentStatusFilter.includes("unpaid") ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (paymentStatusFilter.includes("unpaid")) {
                        setPaymentStatusFilter(paymentStatusFilter.filter((status) => status !== "unpaid"))
                      } else {
                        setPaymentStatusFilter([...paymentStatusFilter, "unpaid"])
                      }
                    }}
                  >
                    To'lanmagan
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Ofitsiant</h3>
                <Select value={waiterFilter} onValueChange={setWaiterFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ofitsiant tanlang" />
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
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Kategoriya</h3>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategoriya tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha kategoriyalar</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setOrderTypeFilter(["table", "saboy", "delivery"])
                  setPaymentStatusFilter(["paid", "unpaid"])
                  setWaiterFilter("all")
                  setCategoryFilter("all")
                }}
                className="mr-2"
              >
                Tozalash
              </Button>
              <Button onClick={() => setIsFilterDialogOpen(false)}>Qo'llash</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Order Details Dialog */}
        <Dialog open={isOrderDetailsDialogOpen} onOpenChange={setIsOrderDetailsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Buyurtma tafsilotlari</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4"
                onClick={() => setIsOrderDetailsDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            {selectedOrderDetails && (
              <OrderDetails order={selectedOrderDetails as any} onClose={() => setIsOrderDetailsDialogOpen(false)} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
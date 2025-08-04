"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
  orderBy,
  limit,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Loader2,
  RefreshCw,
  Printer,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  Users,
  DollarSign,
  ShoppingBag,
  Home,
  Car,
  Plus,
  Minus,
  Save,
  X,
  Search,
  Filter,
  Clock,
  User,
  Phone,
  MapPin,
  CreditCard,
  Ban,
  AlertTriangle,
  Smartphone,
  Trash,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { formatDateTime } from "@/lib/date-utils"
import { generateReceiptHTML } from "@/lib/receipt-utils"
import type { Order, MenuItem, Category } from "@/types"
import { isSameDay, subDays } from "date-fns"
import Image from "next/image"
import { playNotificationSound } from "@/lib/audio-player"

// Electron API uchun global interfeys deklaratsiyasi
declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (html: string) => void
    }
  }
}

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
  category?: string
  categoryId?: string
}

interface EditOrderItem extends OrderItem {
  isNew?: boolean
  isModified?: boolean
  originalQuantity?: number
  imageUrl?: string // Add imageUrl to EditOrderItem
}

interface WaiterInfo {
  id: string
  name: string
  displayName?: string
}

interface BlockedDevice {
  id: string
  deviceId: string
  customerPhone?: string
  customerName?: string
  blockedAt: any
  unblocked: boolean
}

export function AdminDashboard() {
  // State variables
  const [orders, setOrders] = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [waiters, setWaiters] = useState<WaiterInfo[]>([])
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([])
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("today")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [tableFilter, setTableFilter] = useState("all")
  const [deviceFilter, setDeviceFilter] = useState("all")
  const [blockFilter, setBlockFilter] = useState("all")
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const { toast } = useToast()
  const printFrameRef = useRef<HTMLIFrameElement | null>(null)
  const previousOrderIdsRef = useRef<string[]>([])
  const [isFullscreenOrders, setIsFullscreenOrders] = useState(false)

  // Order details modal
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)

  // Edit order modal
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editOrderItems, setEditOrderItems] = useState<EditOrderItem[]>([])
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([])
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false)
  const [searchMenuItems, setSearchMenuItems] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all")
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null)
  const [tempQuantity, setTempQuantity] = useState("")

  // Delete order modal
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Bulk delete modal
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleteType, setBulkDeleteType] = useState<"selected" | "device" | "unpaid">("selected")
  const [bulkDeleteDeviceId, setBulkDeleteDeviceId] = useState("")
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Block user modal
  const [isBlockUserOpen, setIsBlockUserOpen] = useState(false)
  const [userToBlock, setUserToBlock] = useState<Order | null>(null)
  const [blockReason, setBlockReason] = useState("")
  const [blockPhoneNumber, setBlockPhoneNumber] = useState(true)
  const [blockDevice, setBlockDevice] = useState(true)
  const [isBlocking, setIsBlocking] = useState(false)

  // Check if order is from blocked device/user
  const isOrderBlocked = useCallback(
    (order: Order): boolean => {
      if (order.deviceId) {
        const isDeviceBlocked = blockedDevices.some(
          (blocked) => blocked.deviceId === order.deviceId && !blocked.unblocked,
        )
        if (isDeviceBlocked) return true
      }

      if (order.customerPhone || order.phoneNumber) {
        const phone = order.customerPhone || order.phoneNumber
        const isPhoneBlocked = blockedUsers.some((blocked) => blocked.customerPhone === phone && !blocked.unblocked)
        if (isPhoneBlocked) return true
      }

      return false
    },
    [blockedDevices, blockedUsers],
  )

  // Get order date
  const getOrderDate = useCallback((order: Order): Date => {
    try {
      if (!order) return new Date()
      let dateValue: any
      if ((order.status === "paid" || order.isPaid === true) && order.paidAt) {
        dateValue = order.paidAt
      } else {
        dateValue = order.createdAt
      }
      if (!dateValue) return new Date()
      if (dateValue instanceof Date) return dateValue
      if (typeof dateValue === "string") return new Date(dateValue)
      if (typeof dateValue === "number") return new Date(dateValue)
      if (dateValue.toDate && typeof dateValue.toDate === "function") return dateValue.toDate()
      if (dateValue.seconds) return new Date(dateValue.seconds * 1000)
      return new Date(dateValue)
    } catch (error) {
      console.error("Error getting order date:", error)
      return new Date()
    }
  }, [])

  // Get waiter name by ID
  const getWaiterName = useCallback(
    (waiterId: string | undefined): string => {
      if (!waiterId) return "Noma'lum ofitsiant"
      const waiter = waiters.find((w) => w.id === waiterId)
      return waiter ? waiter.name || waiter.displayName || "Noma'lum ofitsiant" : "Noma'lum ofitsiant"
    },
    [waiters],
  )

  // Get unique table numbers from orders
  const uniqueTableNumbers = useMemo(() => {
    const tableNumbers = new Set<number>()
    orders.forEach((order) => {
      if (order.orderType === "table" && (order.tableNumber || order.roomNumber)) {
        tableNumbers.add(order.tableNumber || order.roomNumber || 0)
      }
    })
    return Array.from(tableNumbers).sort((a, b) => a - b)
  }, [orders])

  // Get unique device IDs from orders
  const uniqueDeviceIds = useMemo(() => {
    const deviceIds = new Set<string>()
    orders.forEach((order) => {
      if (order.deviceId) {
        deviceIds.add(order.deviceId)
      }
    })
    return Array.from(deviceIds).sort()
  }, [orders])

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true)

        // Fetch Menu Items
        const menuSnapshot = await getDocs(collection(db, "menuItems"))
        const menuData = menuSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MenuItem[]
        setMenuItems(menuData)
        const availableItems = menuData.filter((item) => item.isAvailable === true || item.available === true)
        setAvailableMenuItems(availableItems)

        // Fetch Categories
        const categoriesSnapshot = await getDocs(collection(db, "categories"))
        const categoriesData = categoriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Category[]
        setCategories(categoriesData)

        // Fetch Waiters/Users
        const usersSnapshot = await getDocs(collection(db, "users"))
        const waitersData = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.data().displayName || "Noma'lum",
          displayName: doc.data().displayName,
        })) as WaiterInfo[]
        setWaiters(waitersData)

        // Fetch Blocked Devices
        const blockedDevicesSnapshot = await getDocs(collection(db, "blockedDevices"))
        const blockedDevicesData = blockedDevicesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BlockedDevice[]
        setBlockedDevices(blockedDevicesData)

        // Fetch Blocked Users
        const blockedUsersSnapshot = await getDocs(collection(db, "blockedUsers"))
        const blockedUsersData = blockedUsersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setBlockedUsers(blockedUsersData)

        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching initial data:", error)
        toast({
          title: "Xatolik",
          description: "Boshlang'ich ma'lumotlarni yuklashda xatolik yuz berdi.",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchInitialData()
  }, [toast])

  // Real-time orders listener
  useEffect(() => {
    const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200))

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[]

        const sortedOrders = fetchedOrders.sort((a, b) => {
          const dateA = getOrderDate(a)
          const dateB = getOrderDate(b)
          return dateB.getTime() - dateA.getTime()
        })

        // Check for new orders and play notification sound
        const currentOrderIds = sortedOrders.map((o) => o.id)
        const previousOrderIds = previousOrderIdsRef.current
        const newOrders = sortedOrders.filter(
          (order) => !previousOrderIds.includes(order.id) && order.status === "pending",
        )

        if (newOrders.length > 0 && previousOrderIds.length > 0) {
          playNotificationSound()
          toast({
            title: "🔔 Yangi buyurtma!",
            description: `${newOrders.length} ta yangi buyurtma keldi`,
          })
        }

        previousOrderIdsRef.current = currentOrderIds
        setOrders(sortedOrders)
        setIsLoading(false)
      },
      (error) => {
        console.error("Error fetching real-time orders:", error)
        toast({
          title: "Xatolik",
          description: "Buyurtmalarni real vaqtda yuklashda xatolik yuz berdi.",
          variant: "destructive",
        })
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [toast, getOrderDate])

  // Helper functions
  const getCategoryName = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId)
      return category ? category.name : "Kategoriyasiz"
    },
    [categories],
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Kutilmoqda
          </Badge>
        )
      case "preparing":
        return (
          <Badge className="bg-yellow-500 text-white">
            <Timer className="w-3 h-3 mr-1" />
            Tayyorlanmoqda
          </Badge>
        )
      case "ready":
        return (
          <Badge className="bg-blue-500 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Tayyor
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-purple-500 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Yakunlangan
          </Badge>
        )
      case "delivered":
        return (
          <Badge className="bg-indigo-500 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Yetkazildi
          </Badge>
        )
      case "paid":
        return (
          <Badge className="bg-emerald-600 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            To'langan
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Bekor qilingan
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
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
        return <ShoppingBag className="w-4 h-4" />
    }
  }

  const getOrderTypeLabel = (orderType: string) => {
    switch (orderType) {
      case "table":
        return "Stol"
      case "delivery":
        return "Yetkazib berish"
      case "saboy":
        return "Saboy"
      default:
        return orderType
    }
  }

  // Filter orders based on current filters
  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Filter by order type
    if (orderTypeFilter !== "all") {
      filtered = filtered.filter((order) => order.orderType === orderTypeFilter)
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Filter by payment status
    if (paymentFilter !== "all") {
      if (paymentFilter === "paid") {
        filtered = filtered.filter((order) => order.status === "paid")
      } else if (paymentFilter === "unpaid") {
        filtered = filtered.filter((order) => order.status !== "paid")
      }
    }

    // Filter by table number
    if (tableFilter !== "all") {
      const tableNumber = Number.parseInt(tableFilter)
      filtered = filtered.filter((order) => {
        if (order.orderType === "table") {
          return order.tableNumber === tableNumber || order.roomNumber === tableNumber
        }
        return false
      })
    }

    // Filter by device ID
    if (deviceFilter !== "all") {
      filtered = filtered.filter((order) => order.deviceId === deviceFilter)
    }

    // Filter by block status
    if (blockFilter !== "all") {
      if (blockFilter === "blocked") {
        filtered = filtered.filter((order) => isOrderBlocked(order))
      } else if (blockFilter === "not_blocked") {
        filtered = filtered.filter((order) => !isOrderBlocked(order))
      }
    }

    // Filter by date
    if (dateFilter !== "all") {
      const today = new Date()
      const yesterday = subDays(today, 1)
      const weekAgo = subDays(today, 7)

      filtered = filtered.filter((order) => {
        const orderDate = getOrderDate(order)
        if (!orderDate) return false

        switch (dateFilter) {
          case "today":
            return isSameDay(orderDate, today)
          case "yesterday":
            return isSameDay(orderDate, yesterday)
          case "week":
            return orderDate >= weekAgo
          default:
            return true
        }
      })
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((order) => {
        return (
          order.id.toLowerCase().includes(query) ||
          order.customerName?.toLowerCase().includes(query) ||
          order.customerPhone?.toLowerCase().includes(query) ||
          (order.customerPhone || order.phoneNumber)?.toLowerCase().includes(query) ||
          order.tableNumber?.toString().includes(query) ||
          order.roomNumber?.toString().includes(query) ||
          order.items.some((item) => item.name.toLowerCase().includes(query)) ||
          getWaiterName(order.waiterId).toLowerCase().includes(query) ||
          order.deviceId?.toLowerCase().includes(query) ||
          (order.orderType === "table" &&
            ((order.tableNumber && order.tableNumber.toString().includes(query)) ||
              (order.roomNumber && order.roomNumber.toString().includes(query))))
        )
      })
    }

    return filtered
  }, [
    orders,
    orderTypeFilter,
    statusFilter,
    paymentFilter,
    tableFilter,
    deviceFilter,
    blockFilter,
    dateFilter,
    searchQuery,
    getOrderDate,
    getWaiterName,
    isOrderBlocked,
  ])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0)
    const paidOrders = filteredOrders.filter((order) => order.status === "paid").length
    const paidRevenue = filteredOrders
      .filter((order) => order.status === "paid")
      .reduce((sum, order) => sum + (order.total || 0), 0)
    const unpaidOrders = filteredOrders.filter((order) => order.status !== "paid").length
    const pendingOrders = filteredOrders.filter((order) => order.status === "pending").length
    const blockedOrders = filteredOrders.filter((order) => isOrderBlocked(order)).length

    return {
      totalOrders,
      totalRevenue,
      paidOrders,
      paidRevenue,
      unpaidOrders,
      pendingOrders,
      blockedOrders,
    }
  }, [filteredOrders, isOrderBlocked])

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Handle order selection
  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsOrderDetailsOpen(true)
  }

  // Handle checkbox selection
  const handleOrderCheckbox = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId])
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId))
    }
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const unpaidOrderIds = filteredOrders.filter((order) => order.status !== "paid").map((order) => order.id)
      setSelectedOrders(unpaidOrderIds)
    } else {
      setSelectedOrders([])
    }
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("")
    setOrderTypeFilter("all")
    setStatusFilter("all")
    setPaymentFilter("all")
    setTableFilter("all")
    setDeviceFilter("all")
    setBlockFilter("all")
    setDateFilter("all")
  }

  // Handle print receipt
  const handlePrintReceipt = useCallback(
    async (order: Order, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }

      try {
        const receiptHTML = await generateReceiptHTML(
          order.id,
          {
            items: order.items,
            total: order.total || 0,
            subtotal: order.subtotal,
            customerName: order.customerName,
            tableNumber: order.tableNumber,
            roomNumber: order.roomNumber,
            orderType: order.orderType,
            status: order.status,
            isPaid: order.isPaid,
            seatingType: order.seatingType,
            phoneNumber: order.customerPhone,
            address: order.address,
            deliveryFee: order.deliveryFee,
            containerCost: order.containerCost,
            createdAt: order.createdAt,
            paidAt: order.paidAt,
            waiterId: order.waiterId,
            waiterName: getWaiterName(order.waiterId),
          },
          window.location.origin,
        )

        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.printReceipt) {
          window.electronAPI.printReceipt(receiptHTML)
          toast({
            title: "Chek chop etildi",
            description: `Buyurtma #${order.id.slice(-6).toUpperCase()} cheki printerga yuborildi.`,
          })
        } else {
          // Fallback to browser print if Electron API is not available
          if (!printFrameRef.current) {
            const iframe = document.createElement("iframe")
            iframe.style.position = "fixed"
            iframe.style.right = "0"
            iframe.style.bottom = "0"
            iframe.style.width = "0"
            iframe.style.height = "0"
            iframe.style.border = "0"
            document.body.appendChild(iframe)
            printFrameRef.current = iframe
          }

          const frameDoc = printFrameRef.current.contentDocument
          if (frameDoc) {
            frameDoc.open()
            frameDoc.write(receiptHTML)
            frameDoc.close()

            setTimeout(() => {
              if (printFrameRef.current?.contentWindow) {
                printFrameRef.current.contentWindow.print()
              }
              toast({
                title: "Chek chop etildi",
                description: `Buyurtma #${order.id.slice(-6).toUpperCase()} cheki chop etildi.`,
              })
            }, 500)
          }
        }
      } catch (error) {
        console.error("Chek chop etishda xatolik:", error)
        toast({
          title: "Xatolik",
          description: "Chekni chop etishda xatolik yuz berdi.",
          variant: "destructive",
        })
      }
    },
    [toast, getWaiterName],
  )

  // Handle edit order
  const handleEditOrder = (order: Order, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setEditingOrder(order)
    const itemsWithImages = order.items.map((item) => {
      const menuItem = menuItems.find((mi) => mi.id === (item.id || (item as any).menuItemId))
      return {
        ...item,
        originalQuantity: item.quantity,
        imageUrl: menuItem?.imageUrl || `/placeholder.svg?width=100&height=100&query=${item.name}`,
      }
    })
    setEditOrderItems(itemsWithImages)
    setSelectedCategoryId("all")
    setSearchMenuItems("")
    setIsEditOrderOpen(true)
  }

  // Handle add item to order
  const handleAddItemToOrder = (menuItem: MenuItem) => {
    setEditOrderItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((item) => item.id === menuItem.id)

      if (existingItemIndex >= 0) {
        const updatedItems = [...prevItems]
        const currentItem = updatedItems[existingItemIndex]
        updatedItems[existingItemIndex] = {
          ...currentItem,
          quantity: currentItem.quantity + 1,
          isModified: true,
        }
        return updatedItems
      } else {
        const newItem: EditOrderItem = {
          id: menuItem.id,
          name: menuItem.name || "",
          price: menuItem.price || 0,
          quantity: 1,
          category: menuItem.category || "",
          categoryId: menuItem.categoryId || "",
          notes: "",
          imageUrl: menuItem.imageUrl || `/placeholder.svg?width=100&height=100&query=${menuItem.name}`,
          isNew: true,
          isModified: true,
          originalQuantity: 0,
        }
        return [...prevItems, newItem]
      }
    })
  }

  // Handle update item quantity
  const handleUpdateItemQuantity = (targetItemId: string, newQuantity: number) => {
    setEditOrderItems((prevItems) => {
      if (newQuantity <= 0) {
        return prevItems.filter((item) => item.id !== targetItemId)
      } else {
        return prevItems.map((item) => {
          if (item.id === targetItemId) {
            return {
              ...item,
              quantity: newQuantity,
              isModified: item.originalQuantity !== newQuantity,
            }
          }
          return item
        })
      }
    })
  }

  // Handle individual item increment
  const handleIncrementItem = (targetItemId: string) => {
    setEditOrderItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === targetItemId) {
          const newQuantity = item.quantity + 1
          return {
            ...item,
            quantity: newQuantity,
            isModified: item.originalQuantity !== newQuantity,
          }
        }
        return item
      })
    })
  }

  // Handle individual item decrement
  const handleDecrementItem = (targetItemId: string) => {
    setEditOrderItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.id === targetItemId) {
            const newQuantity = Math.max(0, item.quantity - 1)
            if (newQuantity === 0) {
              return null // Will be filtered out
            }
            return {
              ...item,
              quantity: newQuantity,
              isModified: item.originalQuantity !== newQuantity,
            }
          }
          return item
        })
        .filter(Boolean) as EditOrderItem[]
    })
  }

  // Handle quantity input
  const handleQuantityClick = (itemId: string, currentQuantity: number) => {
    setEditingQuantityId(itemId)
    setTempQuantity(currentQuantity.toString())
  }

  const handleQuantitySubmit = (itemId: string) => {
    const newQuantity = Number.parseInt(tempQuantity) || 1
    handleUpdateItemQuantity(itemId, newQuantity)
    setEditingQuantityId(null)
    setTempQuantity("")
  }

  const handleQuantityCancel = () => {
    setEditingQuantityId(null)
    setTempQuantity("")
  }

  // Handle save order changes
  const handleSaveOrderChanges = async () => {
    if (!editingOrder) return

    setIsUpdatingOrder(true)
    try {
      const newTotal = editOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

      const itemsToSave = editOrderItems.map((item) => {
        const newItem: any = {
          id: item.id || "",
          name: item.name || "",
          price: item.price || 0,
          quantity: item.quantity || 1,
        }
        if (item.notes && item.notes.trim()) newItem.notes = item.notes.trim()
        if (item.category && item.category.trim()) newItem.category = item.category.trim()
        if (item.categoryId && item.categoryId.trim()) newItem.categoryId = item.categoryId.trim()
        if (item.imageUrl) newItem.imageUrl = item.imageUrl

        return newItem
      })

      const updateData: any = {
        items: itemsToSave,
        total: newTotal,
        subtotal: newTotal,
        updatedAt: serverTimestamp(),
      }

      await updateDoc(doc(db, "orders", editingOrder.id), updateData)

      await addDoc(collection(db, "orderModifications"), {
        orderId: editingOrder.id,
        modifiedAt: serverTimestamp(),
        modifiedAtString: new Date().toLocaleString("uz-UZ"),
        modifiedBy: "admin",
        modifiedByName: "Admin",
        modificationType: "edit",
        orderType: editingOrder.orderType,
        tableNumber: editingOrder.tableNumber || null,
        roomNumber: editingOrder.roomNumber || null,
        notes: `${editingOrder.orderType === "saboy" ? "Saboy" : "Stol"} buyurtmasi admin tomonidan tahrirlandi`,
        editedItems: editOrderItems
          .filter((item) => item.isModified || item.isNew)
          .map((item) => ({
            before: item.isNew
              ? null
              : {
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  quantity: item.originalQuantity || 0,
                },
            after: {
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            },
          })),
      })

      toast({
        title: "✅ Buyurtma yangilandi",
        description: `${editingOrder.orderType === "saboy" ? "Saboy" : "Stol"} buyurtmasi muvaffaqiyatli yangilandi`,
      })

      setIsEditOrderOpen(false)
      setEditingOrder(null)
      setEditOrderItems([])
    } catch (error) {
      console.error("Error updating order:", error)
      toast({
        title: "❌ Xatolik",
        description: "Buyurtmani yangilashda xatolik yuz berdi. Qaytadan urinib ko'ring.",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingOrder(false)
    }
  }

  // Handle delete order
  const handleDeleteOrder = (order: Order, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setOrderToDelete(order)
    setIsDeleteDialogOpen(true)
  }

  // Handle bulk delete
  const handleBulkDelete = (type: "selected" | "device" | "unpaid") => {
    setBulkDeleteType(type)
    if (type === "device") {
      setBulkDeleteDeviceId("")
    }
    setIsBulkDeleteDialogOpen(true)
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return

    setIsDeleting(true)
    try {
      await addDoc(collection(db, "orderHistory"), {
        ...orderToDelete,
        deletedAt: serverTimestamp(),
        deletedBy: "admin",
      })

      await deleteDoc(doc(db, "orders", orderToDelete.id))

      toast({
        title: "Buyurtma o'chirildi",
        description: "Buyurtma muvaffaqiyatli o'chirildi va tarixga saqlandi",
      })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting order:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmani o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle bulk delete confirmation
  const handleBulkDeleteConfirm = async () => {
    setIsBulkDeleting(true)
    try {
      let ordersToDelete: Order[] = []

      if (bulkDeleteType === "selected") {
        ordersToDelete = orders.filter((order) => selectedOrders.includes(order.id))
      } else if (bulkDeleteType === "device") {
        if (!bulkDeleteDeviceId.trim()) {
          toast({
            title: "Xatolik",
            description: "Qurilma ID ni kiriting",
            variant: "destructive",
          })
          setIsBulkDeleting(false)
          return
        }
        ordersToDelete = orders.filter(
          (order) => order.deviceId === bulkDeleteDeviceId.trim() && order.status !== "paid",
        )
      } else if (bulkDeleteType === "unpaid") {
        ordersToDelete = orders.filter((order) => order.status !== "paid")
      }

      if (ordersToDelete.length === 0) {
        toast({
          title: "Ma'lumot",
          description: "O'chiriladigan buyurtmalar topilmadi",
        })
        setIsBulkDeleteDialogOpen(false)
        setIsBulkDeleting(false)
        return
      }

      const batch = writeBatch(db)

      // Move to history and delete
      for (const order of ordersToDelete) {
        // Add to history
        const historyRef = doc(collection(db, "orderHistory"))
        batch.set(historyRef, {
          ...order,
          deletedAt: serverTimestamp(),
          deletedBy: "admin",
          bulkDeleteType: bulkDeleteType,
        })

        // Delete from orders
        batch.delete(doc(db, "orders", order.id))
      }

      await batch.commit()

      toast({
        title: "Buyurtmalar o'chirildi",
        description: `${ordersToDelete.length} ta buyurtma o'chirildi va tarixga saqlandi`,
      })

      setSelectedOrders([])
      setIsBulkDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error bulk deleting orders:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmalarni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      }

      if (newStatus === "paid") {
        updateData.isPaid = true
        updateData.paidAt = serverTimestamp()
      }

      await updateDoc(doc(db, "orders", orderId), updateData)

      toast({
        title: "Status yangilandi",
        description: `Buyurtma statusi "${newStatus}" ga o'zgartirildi`,
      })
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtma statusini yangilashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  // Filter available menu items for search
  const filteredMenuItems = useMemo(() => {
    let items = availableMenuItems

    if (selectedCategoryId !== "all") {
      items = items.filter((item) => item.categoryId === selectedCategoryId)
    }

    if (searchMenuItems.trim()) {
      const searchTerm = searchMenuItems.toLowerCase().trim()
      items = items.filter(
        (item) => item.name?.toLowerCase().includes(searchTerm) || item.description?.toLowerCase().includes(searchTerm),
      )
    }

    return items
  }, [availableMenuItems, searchMenuItems, selectedCategoryId])

  // Handle quick payment
  const handleQuickPayment = async (orderId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }

    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "paid",
        isPaid: true,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      const audio = new Audio("/success.mp3")
      audio.play().catch((e) => console.error("Error playing sound:", e))

      toast({
        title: "💰 To'lov muvaffaqiyatli",
        description: "Buyurtma to'landi deb belgilandi",
      })
    } catch (error) {
      console.error("Error updating payment status:", error)
      toast({
        title: "Xatolik",
        description: "To'lov statusini yangilashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  // Handle block user
  const handleBlockUser = (order: Order, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }

    if (order.orderType !== "delivery" && order.orderType !== "table") {
      toast({
        title: "Bloklash mumkin emas",
        description: "Faqat yetkazib berish va stol buyurtmalarini bloklash mumkin",
        variant: "destructive",
      })
      return
    }

    setUserToBlock(order)
    setBlockReason("")
    setBlockPhoneNumber(true)
    setBlockDevice(!!order.deviceId)
    setIsBlockUserOpen(true)
  }

  // Handle block confirmation
  const handleBlockConfirm = async () => {
    if (!userToBlock) return

    setIsBlocking(true)
    try {
      const autoUnblockDate = new Date()
      autoUnblockDate.setDate(autoUnblockDate.getDate() + 10)

      const promises = []

      if (blockPhoneNumber && (userToBlock.customerPhone || userToBlock.phoneNumber)) {
        const phoneBlockData = {
          customerPhone: userToBlock.customerPhone || userToBlock.phoneNumber || "",
          customerName: userToBlock.customerName || "",
          blockedAt: serverTimestamp(),
          blockedBy: "admin",
          blockedByName: "Admin",
          reason: blockReason || "Adminning qaroriga ko'ra",
          orderId: userToBlock.id,
          orderType: userToBlock.orderType,
          autoUnblockAt: autoUnblockDate,
          unblocked: false,
          deviceId: userToBlock.deviceId,
        }
        promises.push(addDoc(collection(db, "blockedUsers"), phoneBlockData))
      }

      if (blockDevice && userToBlock.deviceId) {
        const deviceBlockData = {
          deviceId: userToBlock.deviceId,
          customerPhone: userToBlock.customerPhone || userToBlock.phoneNumber || "",
          customerName: userToBlock.customerName || "",
          blockedAt: serverTimestamp(),
          blockedBy: "admin",
          blockedByName: "Admin",
          reason: blockReason || "Adminning qaroriga ko'ra",
          orderId: userToBlock.id,
          orderType: userToBlock.orderType,
          autoUnblockAt: autoUnblockDate,
          unblocked: false,
        }
        promises.push(addDoc(collection(db, "blockedDevices"), deviceBlockData))
      }

      await Promise.all(promises)

      const blockedItems = []
      if (blockPhoneNumber) blockedItems.push("telefon raqami")
      if (blockDevice && userToBlock.deviceId) blockedItems.push("qurilma")

      toast({
        title: "Foydalanuvchi bloklandi",
        description: `${userToBlock.customerName || userToBlock.customerPhone} ning ${blockedItems.join(" va ")} bloklandi. 10 kundan keyin avtomatik ochiladi.`,
      })
      setIsBlockUserOpen(false)

      // Refresh blocked data
      const blockedDevicesSnapshot = await getDocs(collection(db, "blockedDevices"))
      const blockedDevicesData = blockedDevicesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as BlockedDevice[]
      setBlockedDevices(blockedDevicesData)

      const blockedUsersSnapshot = await getDocs(collection(db, "blockedUsers"))
      const blockedUsersData = blockedUsersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setBlockedUsers(blockedUsersData)
    } catch (error) {
      console.error("Error blocking user:", error)
      toast({
        title: "Xatolik",
        description: "Foydalanuvchini bloklashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsBlocking(false)
    }
  }

  // Render order card
  const renderOrderCard = (order: Order) => {
    const orderDate = getOrderDate(order)
    const orderDateTime = formatDateTime(orderDate)
    const waiterName = getWaiterName(order.waiterId)
    const isPaid = order.status === "paid"
    const isUnpaid = !isPaid
    const canBlock = order.orderType === "delivery" || order.orderType === "table"
    const isSelected = selectedOrders.includes(order.id)
    const isBlocked = isOrderBlocked(order)

    return (
      <Card
        key={order.id}
        className={`cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 transform hover:-translate-y-1 ${
          isBlocked
            ? "border-l-red-600 bg-gradient-to-br from-red-50 to-red-100 ring-2 ring-red-200 shadow-red-100"
            : isUnpaid
              ? "border-l-orange-500 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-orange-100"
              : isPaid
                ? "border-l-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-green-100"
                : "border-l-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-blue-100"
        } ${isSelected ? "ring-2 ring-blue-500 shadow-blue-200" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isUnpaid && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => handleOrderCheckbox(order.id, checked as boolean)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0"
                />
              )}
              <div
                className={`p-2 rounded-lg ${
                  isBlocked
                    ? "bg-red-200 text-red-700"
                    : isUnpaid
                      ? "bg-orange-200 text-orange-700"
                      : isPaid
                        ? "bg-green-200 text-green-700"
                        : "bg-blue-200 text-blue-700"
                }`}
              >
                {getOrderTypeIcon(order.orderType)}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 flex-wrap">
                  <span className="truncate font-bold">#{order.id.substring(0, 8).toUpperCase()}</span>
                  {isBlocked && (
                    <Badge variant="destructive" className="text-xs flex-shrink-0 animate-pulse">
                      <Shield className="w-3 h-3 mr-1" />
                      Bloklangan
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground font-medium">
                  {getOrderTypeLabel(order.orderType)}
                  {order.orderType === "table" && (order.tableNumber || order.roomNumber) && (
                    <span className="font-bold text-blue-600 ml-1">
                      - {order.seatingType || "Stol"} #{order.tableNumber || order.roomNumber}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end flex-shrink-0">
              {getStatusBadge(order.status)}
              {isUnpaid && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 animate-pulse font-medium">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  To'lanmagan
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3" onClick={() => handleSelectOrder(order)}>
          <div className="space-y-3">
            {order.customerName && (
              <div className="flex items-center gap-2 text-sm bg-white/60 rounded-lg p-2">
                <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="truncate font-medium">{order.customerName}</span>
              </div>
            )}

            {(order.customerPhone || order.phoneNumber) && (
              <div className="flex items-center gap-2 text-sm bg-white/60 rounded-lg p-2">
                <Phone className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="truncate font-medium">{order.customerPhone || order.phoneNumber}</span>
              </div>
            )}

            {order.deviceId && (
              <div className="flex items-center gap-2 text-sm bg-white/60 rounded-lg p-2">
                <Smartphone className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="font-mono text-xs truncate">{order.deviceId.substring(0, 20)}...</span>
              </div>
            )}

            {order.address && (
              <div className="flex items-center gap-2 text-sm bg-white/60 rounded-lg p-2">
                <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="truncate font-medium">{order.address}</span>
              </div>
            )}

            {order.waiterId && (
              <div className="flex items-center gap-2 text-sm bg-blue-100 rounded-lg p-2">
                <User className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <span className="font-semibold text-blue-800 truncate">Ofitsiant: {waiterName}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm bg-white/60 rounded-lg p-2">
              <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
              <span className="truncate font-medium">
                {orderDateTime.date} {orderDateTime.time}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600 font-medium">{order.items.length} ta taom</span>
              </div>
              <span
                className={`font-bold text-xl ${
                  isPaid ? "text-green-700" : isUnpaid ? "text-red-700" : "text-blue-700"
                }`}
              >
                {formatCurrency(order.total || 0)}
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-0  backdrop-blur-sm">
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handlePrintReceipt(order, e)}
                className="bg-white/80 hover:bg-white border-gray-300 hover:border-gray-400"
              >
                <Printer className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Chek</span>
              </Button>
              {order.orderType !== "saboy" && ( // Conditional rendering for Edit button
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleEditOrder(order, e)}
                  className="bg-white/80 hover:bg-white border-gray-300 hover:border-gray-400"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
              {canBlock && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleBlockUser(order, e)}
                  className={`${
                    isBlocked
                      ? "bg-red-200 hover:bg-red-300 text-red-800 border-red-400"
                      : "bg-red-100 hover:bg-red-200 text-red-700 border-red-300"
                  }`}
                >
                  <Ban className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleDeleteOrder(order, e)}
                className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="w-full">
              {isUnpaid && (
                <Button
                  onClick={(e) => handleQuickPayment(order.id, e)}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <CreditCard className="w-4 h-4 mr-2" />💰 To'landi
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px]" />
                <Skeleton className="h-4 w-[80px] mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12">
            <Image src="/logo.svg" alt="Restaurant Logo" width={48} height={48} className="object-contain" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Buyurtmalar va statistikalarni boshqaring</p>
          </div>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Yangilash
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Jami</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-blue-900">{stats.totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Daromad</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-900">{formatCurrency(stats.paidRevenue)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">To'langan</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-emerald-900">{stats.paidOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">To'lanmagan</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-900">{stats.unpaidOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Kutilayotgan</CardTitle>
            <Timer className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-orange-900">{stats.pendingOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Tanlangan</CardTitle>
            <Checkbox className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-purple-900">{selectedOrders.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Bloklangan</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-900">{stats.blockedOrders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Search className="w-5 h-5" />
              Qidiruv va filtrlar
            </CardTitle>
            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="bg-white hover:bg-blue-50 text-blue-700 border-blue-300">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrlar
                  {isFiltersOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Bar - Always Visible */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-blue-600" />
              <Input
                placeholder="Buyurtma ID, mijoz nomi, telefon, taom nomi bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-blue-200 focus:border-blue-400 focus:ring-blue-200"
              />
            </div>

            {/* Collapsible Filters */}
            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <CollapsibleContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-blue-900">📋 Buyurtma turi</label>
                    <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                      <SelectTrigger className="bg-white border-blue-200 focus:border-blue-400">
                        <SelectValue placeholder="Turi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        <SelectItem value="table">🍽️ Stol</SelectItem>
                        <SelectItem value="saboy">🏠 Saboy</SelectItem>
                        <SelectItem value="delivery">🚗 Yetkazish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-green-900">📊 Holat</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="bg-white border-green-200 focus:border-green-400">
                        <SelectValue placeholder="Holat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        <SelectItem value="pending">⏳ Kutilmoqda</SelectItem>
                        <SelectItem value="preparing">👨‍🍳 Tayyorlanmoqda</SelectItem>
                        <SelectItem value="ready">✅ Tayyor</SelectItem>
                        <SelectItem value="completed">🎯 Yakunlangan</SelectItem>
                        <SelectItem value="delivered">🚚 Yetkazildi</SelectItem>
                        <SelectItem value="paid">💰 To'langan</SelectItem>
                        <SelectItem value="cancelled">❌ Bekor qilingan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-purple-900">💳 To'lov holati</label>
                    <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                      <SelectTrigger className="bg-white border-purple-200 focus:border-purple-400">
                        <SelectValue placeholder="To'lov" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        <SelectItem value="paid">✅ To'langan</SelectItem>
                        <SelectItem value="unpaid">❌ To'lanmagan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-red-900">🛡️ Blok holati</label>
                    <Select value={blockFilter} onValueChange={setBlockFilter}>
                      <SelectTrigger className="bg-white border-red-200 focus:border-red-400">
                        <SelectValue placeholder="Blok holati" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        <SelectItem value="blocked">🚫 Bloklangan</SelectItem>
                        <SelectItem value="not_blocked">✅ Bloklanmagan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-orange-900">🪑 Stol raqami</label>
                    <Select value={tableFilter} onValueChange={setTableFilter}>
                      <SelectTrigger className="bg-white border-orange-200 focus:border-orange-400">
                        <SelectValue placeholder="Stol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        {uniqueTableNumbers.map((tableNumber) => (
                          <SelectItem key={tableNumber} value={tableNumber.toString()}>
                            🪑 Stol #{tableNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-indigo-900">📱 Qurilma</label>
                    <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                      <SelectTrigger className="bg-white border-indigo-200 focus:border-indigo-400">
                        <SelectValue placeholder="Qurilma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        {uniqueDeviceIds.slice(0, 10).map((deviceId) => (
                          <SelectItem key={deviceId} value={deviceId}>
                            📱 {deviceId.substring(0, 20)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-teal-900">📅 Sana</label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="bg-white border-teal-200 focus:border-teal-400">
                        <SelectValue placeholder="Sana" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">🔄 Barchasi</SelectItem>
                        <SelectItem value="today">📅 Bugun</SelectItem>
                        <SelectItem value="yesterday">📆 Kecha</SelectItem>
                        <SelectItem value="week">📊 Oxirgi hafta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={clearAllFilters}
                      variant="outline"
                      className="w-full bg-white hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300"
                    >
                      <X className="w-4 h-4 mr-2" />🧹 Tozalash
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedOrders.length === filteredOrders.filter((order) => order.status !== "paid").length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="font-medium">{selectedOrders.length} ta buyurtma tanlangan</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleBulkDelete("selected")}
                  variant="destructive"
                  size="sm"
                  disabled={selectedOrders.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Tanlanganlarni o'chirish
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ommaviy amallar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleBulkDelete("unpaid")} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Barcha to'lanmaganlarni o'chirish
            </Button>
            <Button onClick={() => handleBulkDelete("device")} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Qurilma bo'yicha o'chirish
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Buyurtmalar ({filteredOrders.length})</h2>
          <Button
            onClick={() => setIsFullscreenOrders(true)}
            variant="outline"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            To'liq ekran
          </Button>
        </div>

        {!isFullscreenOrders ? (
          filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Buyurtmalar topilmadi</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Hozircha hech qanday buyurtma yo'q yoki filtrlar bo'yicha hech narsa topilmadi.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {filteredOrders.slice(0, 20).map(renderOrderCard)}
              {filteredOrders.length > 20 && (
                <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30 w-full">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingBag className="w-8 h-8 text-blue-600 mb-2" />
                    <p className="text-blue-700 font-medium mb-2">+{filteredOrders.length - 20} ta ko'proq</p>
                    <Button
                      onClick={() => setIsFullscreenOrders(true)}
                      variant="outline"
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300"
                    >
                      Barchasini ko'rish
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Fullscreen Orders Modal */}
      <Dialog open={isFullscreenOrders} onOpenChange={setIsFullscreenOrders}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-auto">
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ShoppingBag className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-gray-900">Barcha Buyurtmalar</DialogTitle>
                    <p className="text-gray-600 mt-1">
                      Jami {filteredOrders.length} ta buyurtma • Real vaqt rejimida yangilanadi
                    </p>
                  </div>
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden p-6">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="text-gray-400 text-8xl mb-6">📋</div>
                  <h3 className="text-2xl font-semibold text-gray-700 mb-3">Buyurtmalar topilmadi</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Hozircha hech qanday buyurtma yo'q yoki filtrlar bo'yicha hech narsa topilmadi.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-full overflow-y-auto">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
                    {filteredOrders.map(renderOrderCard)}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Buyurtma tafsilotlari #{selectedOrder?.id.substring(0, 8)}
            </DialogTitle>
            <DialogDescription>Buyurtma haqida to'liq ma'lumot va boshqaruv amallar</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Status and Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedOrder.status)}
                    {isOrderBlocked(selectedOrder) && (
                      <Badge variant="destructive">
                        <Shield className="w-3 h-3 mr-1" />
                        Bloklangan
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {formatDateTime(getOrderDate(selectedOrder)).date}{" "}
                    {formatDateTime(getOrderDate(selectedOrder)).time}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(value) => handleStatusUpdate(selectedOrder.id, value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Kutilmoqda</SelectItem>
                      <SelectItem value="preparing">Tayyorlanmoqda</SelectItem>
                      <SelectItem value="ready">Tayyor</SelectItem>
                      <SelectItem value="completed">Yakunlangan</SelectItem>
                      <SelectItem value="delivered">Yetkazildi</SelectItem>
                      <SelectItem value="paid">To'langan</SelectItem>
                      <SelectItem value="cancelled">Bekor qilingan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Customer Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Mijoz ma'lumotlari
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedOrder.customerName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedOrder.customerName}</span>
                      </div>
                    )}
                    {(selectedOrder.customerPhone || selectedOrder.phoneNumber) && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedOrder.customerPhone || selectedOrder.phoneNumber}</span>
                      </div>
                    )}
                    {selectedOrder.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedOrder.address}</span>
                      </div>
                    )}
                    {selectedOrder.deviceId && (
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm break-all">{selectedOrder.deviceId}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getOrderTypeIcon(selectedOrder.orderType)}
                      Buyurtma ma'lumotlari
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Turi:</span>
                      <span className="font-medium">{getOrderTypeLabel(selectedOrder.orderType)}</span>
                    </div>
                    {selectedOrder.orderType === "table" && (selectedOrder.tableNumber || selectedOrder.roomNumber) && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{selectedOrder.seatingType || "Stol"}:</span>
                        <span className="font-medium">#{selectedOrder.tableNumber || selectedOrder.roomNumber}</span>
                      </div>
                    )}
                    {selectedOrder.waiterId && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Ofitsiant:</span>
                        <span className="font-medium text-blue-600">{getWaiterName(selectedOrder.waiterId)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Buyurtma tarkibi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {item.quantity} x {formatCurrency(item.price)}
                          </div>
                          <div className="text-sm font-bold text-blue-600">
                            {formatCurrency(item.quantity * item.price)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    {selectedOrder.subtotal && selectedOrder.subtotal !== selectedOrder.total && (
                      <div className="flex justify-between">
                        <span>Oraliq jami:</span>
                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold ">
                      <span>Jami:</span>
                      <span className="text-blue-600">{formatCurrency(selectedOrder.total || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => handlePrintReceipt(selectedOrder)} variant="outline" className="flex-1">
                  <Printer className="w-4 h-4 mr-2" />
                  Chek
                </Button>
                {selectedOrder.orderType !== "saboy" && ( // Conditional rendering for Edit button in details modal
                  <Button onClick={() => handleEditOrder(selectedOrder)} variant="outline" className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
                {selectedOrder.status !== "paid" && (
                  <Button
                    onClick={() => handleQuickPayment(selectedOrder.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    To'landi
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal */}
      <Dialog
        open={isEditOrderOpen}
        onOpenChange={setIsEditOrderOpen}
        className="max-w-6xl max-h-[100vh] overflow-hidden"
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[100vh] overflow-y-auto ">
              {/* Current Order Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Joriy buyurtma</h3>
                  <Badge variant="outline">{editOrderItems.length} ta taom</Badge>
                </div>
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <div className="space-y-3">
                    {editOrderItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 border rounded-lg ${
                          item.isNew
                            ? "bg-green-50 border-green-200"
                            : item.isModified
                              ? "bg-yellow-50 border-yellow-200"
                              : "bg-white"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.price)} har biri</p>
                            {item.isNew && (
                              <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-700">
                                Yangi
                              </Badge>
                            )}
                            {item.isModified && !item.isNew && (
                              <Badge variant="outline" className="mt-1 text-xs bg-yellow-100 text-yellow-700">
                                O'zgartirilgan
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateItemQuantity(item.id, 0)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            {editingQuantityId === item.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={tempQuantity}
                                  onChange={(e) => setTempQuantity(e.target.value)}
                                  className="w-16 h-8 text-center"
                                  min="1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleQuantitySubmit(item.id)
                                    } else if (e.key === "Escape") {
                                      handleQuantityCancel()
                                    }
                                  }}
                                />
                                <Button variant="ghost" size="sm" onClick={() => handleQuantitySubmit(item.id)}>
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleQuantityCancel}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                className="min-w-[3rem] h-8 font-medium"
                                onClick={() => handleQuantityClick(item.id, item.quantity)}
                              >
                                {item.quantity}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-blue-600">
                              {formatCurrency(item.quantity * item.price)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {editOrderItems.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Buyurtmada hech qanday taom yo'q</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Jami:</span>
                    <span className="text-blue-600">
                      {formatCurrency(editOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                    </span>
                  </div>
                </div>
              </div>
              {/* Available Menu Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Menyu</h3>
                  <Badge variant="outline">{filteredMenuItems.length} ta taom</Badge>
                </div>
                {/* Search and Category Filter */}
                <div className="space-y-3">
                  {/* Category Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategoryId === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategoryId("all")}
                    >
                      Barchasi
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategoryId === category.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategoryId(category.id)}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3">
                    {filteredMenuItems.map((menuItem) => (
                      <Card
                        key={menuItem.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleAddItemToOrder(menuItem)}
                      >
                        <CardContent className="p-3">
                          <div className="aspect-square relative mb-2 bg-gray-100 rounded-lg overflow-hidden">
                            {menuItem.imageUrl ? (
                              <Image
                                src={menuItem.imageUrl || "/placeholder.svg"}
                                alt={menuItem.name}
                                width={100} // Provide width
                                height={100} // Provide height
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <h4 className="font-medium text-sm mb-1 line-clamp-2">{menuItem.name}</h4>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{menuItem.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-600 text-sm">{formatCurrency(menuItem.price)}</span>
                            <Button size="sm" variant="outline">
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {filteredMenuItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Hech qanday taom topilmadi</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 ">
            <Button variant="outline" onClick={() => setIsEditOrderOpen(false)} disabled={isUpdatingOrder}>
              Bekor qilish
            </Button>
            <Button onClick={handleSaveOrderChanges} disabled={isUpdatingOrder || editOrderItems.length === 0}>
              {isUpdatingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Saqlash
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Order Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Buyurtmani o'chirish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Haqiqatan ham bu buyurtmani o'chirmoqchimisiz? Bu amal bekor qilib bo'lmaydi. Buyurtma tarixga
              ko'chiriladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  O'chirilmoqda...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  O'chirish
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Ommaviy o'chirish
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div>
                {bulkDeleteType === "selected" && (
                  <>{selectedOrders.length} ta tanlangan buyurtmani o'chirmoqchimisiz?</>
                )}
                {bulkDeleteType === "unpaid" && <>Barcha to'lanmagan buyurtmalarni o'chirmoqchimisiz?</>}
                {bulkDeleteType === "device" && (
                  <div className="space-y-3">
                    <div>Quyidagi qurilma ID ga tegishli barcha to'lanmagan buyurtmalarni o'chirmoqchimisiz?</div>
                    <Input
                      placeholder="Qurilma ID ni kiriting..."
                      value={bulkDeleteDeviceId}
                      onChange={(e) => setBulkDeleteDeviceId(e.target.value)}
                    />
                  </div>
                )}
                <div className="mt-2 text-sm">Bu amal bekor qilib bo'lmaydi. Buyurtmalar tarixga ko'chiriladi.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  O'chirilmoqda...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  O'chirish
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User Dialog */}
      <Dialog open={isBlockUserOpen} onOpenChange={setIsBlockUserOpen}>
        <DialogContent>
          <DialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              Foydalanuvchini bloklash
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu foydalanuvchini bloklash uchun quyidagi ma'lumotlarni to'ldiring. Blok 10 kun davom etadi va avtomatik
              ochiladi.
            </AlertDialogDescription>
          </DialogHeader>
          {userToBlock && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Foydalanuvchi ma'lumotlari:</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Ism:</strong> {userToBlock.customerName || "Noma'lum"}
                  </p>
                  <p>
                    <strong>Telefon:</strong> {userToBlock.customerPhone || userToBlock.phoneNumber || "Noma'lum"}
                  </p>
                  {userToBlock.deviceId && (
                    <p>
                      <strong>Qurilma:</strong> {userToBlock.deviceId.substring(0, 20)}...
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="blockPhone" checked={blockPhoneNumber} onCheckedChange={setBlockPhoneNumber} />
                  <label htmlFor="blockPhone" className="text-sm font-medium">
                    Telefon raqamini bloklash
                  </label>
                </div>
                {userToBlock.deviceId && (
                  <div className="flex items-center space-x-2">
                    <Checkbox id="blockDevice" checked={blockDevice} onCheckedChange={setBlockDevice} />
                    <label htmlFor="blockDevice" className="text-sm font-medium">
                      Qurilmani bloklash
                    </label>
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="blockReason" className="text-sm font-medium">
                    Bloklash sababi (ixtiyoriy)
                  </label>
                  <Input
                    id="blockReason"
                    placeholder="Bloklash sababini kiriting..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockUserOpen(false)} disabled={isBlocking}>
              Bekor qilish
            </Button>
            <Button
              onClick={handleBlockConfirm}
              disabled={isBlocking || (!blockPhoneNumber && !blockDevice)}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBlocking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Bloklanmoqda...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4 mr-2" />
                  Bloklash
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Frame */}
      <iframe
        ref={printFrameRef}
        style={{
          position: "fixed",
          right: "0",
          bottom: "0",
          width: "0",
          height: "0",
          border: "0",
        }}
        title="Print Frame"
      />
    </div>
  )
}

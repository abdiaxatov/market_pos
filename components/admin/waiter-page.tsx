"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  collection,
  onSnapshot,
  doc,
  Timestamp,
  updateDoc,
  getDocs,
  addDoc,
  getDoc,
  query,
  where,
  serverTimestamp,
  increment, // Import increment for rejectionCount
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
import { useToast } from "@/components/ui/use-toast"
import { playAudio } from "@/lib/audio-player"
import { useAuth } from "./admin-auth-provider"
import {
  Loader2,
  PlusCircle,
  Trash2,
  Plus,
  Minus,
  Receipt,
  FileEdit,
  LogOut,
  Search,
  X,
  ShoppingCart,
  Home,
  History,
  Clock,
  ArrowLeft,
  Filter,
  ChevronDown,
  LayoutGrid,
  List,
  AlertCircle,
  Coffee,
  Utensils,
  XCircle,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils"
import { useRouter } from "next/navigation"
import type { MenuItem } from "@/types"
import { motion, AnimatePresence } from "framer-motion"

// Add the new interface for SeatingItem
interface SeatingItem {
  id: string
  number: number
  seats?: number
  status: "available" | "occupied" | "reserved"
  type: string
  waiterId?: string
  waiterName?: string
  floor?: number
}

interface Floor {
  id: string
  number: number
  name: string
  description?: string
}

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  totalPrice?: number
  notes?: string // Added notes field
  category?: string
  categoryId?: string
}

interface Order {
  id: string
  orderType: string
  tableNumber: number | null
  roomNumber: number | null
  seatingType: string
  items: OrderItem[]
  subtotal: number
  total: number
  status: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  deliveredAt?: Timestamp
  waiterId?: string // Make optional as it might be null for new user orders
  waiterName?: string // Make optional
  isPaid: boolean
  totalAmount?: number
  claimedBy?: string // New field for waiter claiming
  claimedByName?: string // New field for waiter claiming name
  floor?: number
  orderDate?: string
  rejectionCount?: number // New: How many times this order has been rejected
  lastRejectedBy?: string // New: ID of the last waiter who rejected this order
  lastRejectedAt?: Timestamp // New: Timestamp of when it was last rejected
  hasNewItems?: boolean // New: Flag to indicate if new items were added to an existing order
}

export function WaiterPage() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("tables")
  const { toast } = useToast()
  const { userId, userName, userRole, signOut } = useAuth()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // For New Order tab
  const [seatingItems, setSeatingItems] = useState<SeatingItem[]>([])
  const [selectedSeatingItem, setSelectedSeatingItem] = useState<SeatingItem | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuCategories, setMenuCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cartItems, setCartItems] = useState<{ item: MenuItem; quantity: number; notes?: string }[]>([])
  const [isLoadingSeating, setIsLoadingSeating] = useState(false)
  const [isLoadingMenu, setIsLoadingMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const [currentEditingOrder, setCurrentEditingOrder] = useState<Order | null>(null)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [removedItems, setRemovedItems] = useState<{ orderId: string; items: OrderItem[] }[]>([])
  const [cartBadgeAnimation, setCartBadgeAnimation] = useState(false)
  const cartButtonRef = useRef<HTMLButtonElement>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [seatingTypes, setSeatingTypes] = useState<string[]>([])
  const [selectedSeatingType, setSelectedSeatingType] = useState<string | null>(null)

  // New UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false)
  const [currentEditItem, setCurrentEditItem] = useState<{ id: string; quantity: number } | null>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const [tableStatus, setTableStatus] = useState<"all" | "available" | "occupied" | "reserved">("all")

  // Print confirmation dialog state
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false)
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null)

  // Track original cart items for comparison when editing
  const [originalCartItems, setOriginalCartItems] = useState<
    { id: string; name: string; price: number; quantity: number }[]
  >([])

  // Session timeout refs
  const lastActivityRef = useRef<number>(Date.now())

  // Ref to store auto-reject timers
  const autoRejectTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Determine if user is admin
  const isAdmin = userRole === "admin"

  // Calculate cart total items
  const cartTotalItems = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }, [cartItems])

  // Memoize the status options with more statuses
  const statusOptions = useMemo(
    () => [
      { value: "pending", label: "Yangi", color: "bg-blue-500" },
      { value: "preparing", label: "Tayyorlanmoqda", color: "bg-yellow-500" },
      { value: "ready", label: "Tayyor", color: "bg-purple-500" },
      { value: "delivered", label: "Yetkazildi", color: "bg-green-500" },
    ],
    [],
  )

  // Get floor name from floor number
  const getFloorName = useCallback(
    (floorNumber: number | undefined) => {
      if (!floorNumber) return "1-qavat"
      const floor = floors.find((f) => f.number === floorNumber)
      return floor ? floor.name : `${floorNumber}-qavat`
    },
    [floors],
  )

  // Filter menu items based on search query and selected category
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery && !selectedCategory) {
      return menuItems
    }

    const lowerSearchQuery = searchQuery.toLowerCase()

    return menuItems.filter((item) => {
      const matchesCategory =
        !selectedCategory || item.category === selectedCategory || item.categoryId === selectedCategory

      if (!searchQuery) {
        return matchesCategory
      }

      const matchesName = item.name.toLowerCase().includes(lowerSearchQuery)
      const matchesDescription = item.description && item.description.toLowerCase().includes(lowerSearchQuery)

      return matchesCategory && (matchesName || matchesDescription)
    })
  }, [menuItems, selectedCategory, searchQuery])

  // Group menu items by category
  const menuItemsByCategory = useMemo(() => {
    const grouped = {} as Record<string, MenuItem[]>

    filteredMenuItems.forEach((item) => {
      const categoryId = item.categoryId || item.category || "uncategorized"
      if (!grouped[categoryId]) {
        grouped[categoryId] = []
      }
      grouped[categoryId].push(item)
    })

    return grouped
  }, [filteredMenuItems])

  // Get category name by ID
  const getCategoryName = useCallback(
    (categoryId: string) => {
      const category = menuCategories.find((c) => c.id === categoryId)
      return category ? category.name : "Kategoriyasiz"
    },
    [menuCategories],
  )

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      localStorage.clear()
      sessionStorage.clear()

      toast({
        title: "Chiqish jarayoni",
        description: "Tizimdan chiqilmoqda...",
      })

      await signOut()

      toast({
        title: "Chiqish muvaffaqiyatli",
        description: "Tizimdan muvaffaqiyatli chiqdingiz",
      })

      window.location.href = "/admin/login"

      setTimeout(() => {
        if (document.location.pathname !== "/admin/login") {
          window.location.replace("/admin/login")
        }
      }, 1000)
    } catch (error) {
      console.error("Chiqish xatoligi:", error)

      toast({
        title: "Xatolik",
        description: "Chiqishda xatolik yuz berdi, lekin login sahifasiga yo'naltirilmoqda",
        variant: "destructive",
      })

      window.location.href = "/admin/login"

      setTimeout(() => {
        if (document.location.pathname !== "/admin/login") {
          window.location.replace("/admin/login")
        }
      }, 1000)
    } finally {
      setIsLoggingOut(false)
    }
  }, [signOut, toast])

  // Handle user activity
  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Fetch floors
  useEffect(() => {
    const fetchFloors = async () => {
      try {
        const floorsQuery = query(collection(db, "floors"))
        const snapshot = await getDocs(floorsQuery)

        const floorsData: Floor[] = []

        snapshot.forEach((doc) => {
          const data = doc.data()
          floorsData.push({
            id: doc.id,
            number: data.number,
            name: data.name || `${data.number}-qavat`,
            description: data.description,
          })
        })

        floorsData.sort((a, b) => a.number - b.number)
        setFloors(floorsData)

        if (floorsData.length === 0) {
          setFloors([{ id: "default", number: 1, name: "1-qavat" }])
        }
      } catch (error) {
        console.error("Error fetching floors:", error)
      }
    }

    fetchFloors()
  }, [])

  // Fetch seating types
  useEffect(() => {
    const fetchSeatingTypes = async () => {
      try {
        const typesQuery = query(collection(db, "seatingTypes"))
        const snapshot = await getDocs(typesQuery)

        const types = new Set<string>()
        snapshot.forEach((doc) => {
          const typeData = doc.data()
          if (typeData.name) {
            types.add(typeData.name)
          }
        })

        if (types.size === 0) {
          types.add("Stol")
          types.add("Xona")
        }

        const typesArray = Array.from(types)
        setSeatingTypes(typesArray)
      } catch (error) {
        console.error("Error fetching seating types:", error)
      }
    }

    fetchSeatingTypes()
  }, [])

  // New: handleAutoRejectOrder function
  const handleAutoRejectOrder = useCallback(
    async (orderId: string) => {
      if (!userId || !userName) {
        console.warn("Auto-reject skipped: User not logged in.")
        return
      }

      try {
        const orderRef = doc(db, "orders", orderId)
        const orderSnap = await getDoc(orderRef)

        if (orderSnap.exists()) {
          const orderData = orderSnap.data() as Order
          // Only auto-reject if it's still pending and unclaimed
          if (orderData.status === "pending" && !orderData.claimedBy) {
            await updateDoc(orderRef, {
              claimedBy: null,
              claimedByName: null,
              status: "pending", // Keep status as pending
              updatedAt: serverTimestamp(),
              rejectionCount: increment(1), // Increment rejection count
              lastRejectedBy: userId, // Mark who rejected it
              lastRejectedAt: serverTimestamp(),
            })

            // Log auto-rejection action
            const now = new Date()
            const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(now)

            const modificationData = {
              orderId: orderId,
              modifiedAt: serverTimestamp(),
              modifiedAtString: formattedDate,
              modifiedBy: userId,
              modifiedByName: userName,
              modificationType: "auto-reject",
              tableNumber: orderData.tableNumber,
              roomNumber: orderData.roomNumber,
              floor: orderData.floor,
              notes: `Buyurtma ${userName} tomonidan avtomatik rad etildi (10s timeout).`,
            }
            await addDoc(collection(db, "orderModifications"), modificationData)

            toast({
              title: "Buyurtma o'tkazildi",
              description: `Buyurtma #${orderId.substring(0, 8)}... 10 soniya ichida qabul qilinmagani uchun boshqa ofitsiantga o'tkazildi.`,
            })
          }
        }
      } catch (error) {
        console.error("Error auto-rejecting order:", error)
      }
    },
    [userId, userName, toast],
  )

  // Fetch active orders and manage auto-reject timers
  useEffect(() => {
    setLoading(true)
    setError(null)

    try {
      const ordersCollection = collection(db, "orders")
      const ordersQuery = query(ordersCollection, where("status", "in", ["pending", "preparing", "ready"]))

      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const newActiveOrders: Order[] = []
          let hasNewUnclaimedOrder = false
          const currentOrderIds = new Set<string>()

          snapshot.forEach((doc) => {
            const data = doc.data() as Omit<Order, "id">
            const order = { id: doc.id, ...data } as Order
            currentOrderIds.add(order.id)

            // Check for new unclaimed orders for notification
            if (order.status === "pending" && !order.claimedBy) {
              const isRecent =
                typeof order.createdAt.toMillis === "function" ? Date.now() - order.createdAt.toMillis() < 10000 : false
              if (isRecent) {
                hasNewUnclaimedOrder = true
              }

              // Manage auto-reject timers for pending and unclaimed orders
              // Only set a timer if the current user hasn't rejected it last
              if (userId && order.lastRejectedBy !== userId) {
                if (!autoRejectTimers.current.has(order.id)) {
                  const timer = setTimeout(() => {
                    handleAutoRejectOrder(order.id)
                  }, 10000000000000) // 10 seconds
                  autoRejectTimers.current.set(order.id, timer)
                }
              } else {
                // If current user rejected it, clear any existing timer for this order on this client
                if (autoRejectTimers.current.has(order.id)) {
                  clearTimeout(autoRejectTimers.current.get(order.id)!)
                  autoRejectTimers.current.delete(order.id)
                }
              }
            } else {
              // If order is claimed or not pending, clear any existing timer
              if (autoRejectTimers.current.has(order.id)) {
                clearTimeout(autoRejectTimers.current.get(order.id)!)
                autoRejectTimers.current.delete(order.id)
              }
            }

            if (!order.orderDate && order.createdAt) {
              try {
                let date
                if (order.createdAt.toDate && typeof order.createdAt.toDate === "function") {
                  date = order.createdAt.toDate()
                } else if (order.createdAt instanceof Date) {
                  date = order.createdAt
                } else if (typeof order.createdAt === "number") {
                  date = new Date(order.createdAt)
                } else if (typeof order.createdAt === "string") {
                  date = new Date(order.createdAt)
                } else {
                  throw new Error("Invalid date format")
                }

                if (isNaN(date.getTime())) {
                  throw new Error("Invalid date value")
                }

                order.orderDate = new Intl.DateTimeFormat("uz-UZ", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(date)
              } catch (error) {
                console.error("Error formatting order date:", error)
                order.orderDate = "Sana xato"
              }
            }

            newActiveOrders.push(order)
          })

          // Clear timers for orders that no longer exist in the snapshot
          autoRejectTimers.current.forEach((timer, orderId) => {
            if (!currentOrderIds.has(orderId)) {
              clearTimeout(timer)
              autoRejectTimers.current.delete(orderId)
            }
          })

          // Sort orders: orders with new items first, then unclaimed, then by status priority, then by creation time
          newActiveOrders.sort((a, b) => {
            // Orders with new items first
            if (a.hasNewItems && !b.hasNewItems) return -1
            if (!a.hasNewItems && b.hasNewItems) return 1

            // Unclaimed orders first (if not already handled by hasNewItems)
            if (!a.claimedBy && b.claimedBy) return -1
            if (a.claimedBy && !b.claimedBy) return 1

            const priority = {
              pending: 3, // Pending (claimed or not)
              ready: 2,
              preparing: 1,
            }

            const priorityA = priority[a.status as keyof typeof priority] || 0
            const priorityB = priority[b.status as keyof typeof priority] || 0

            if (priorityA !== priorityB) {
              return priorityB - priorityA
            }

            const dateA = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0
            const dateB = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0
            return dateB - dateA
          })

          setActiveOrders(newActiveOrders)
          setLoading(false)

          if (hasNewUnclaimedOrder) {
            playAudio("/notification.mp3")
            toast({
              title: "Yangi buyurtma!",
              description: "Yangi buyurtma qabul qilindi",
            })
          }
        },
        (error) => {
          console.error("Error fetching active orders:", error)
          setError("Buyurtmalarni yuklashda xatolik yuz berdi: " + error.message)
          toast({
            title: "Xatolik",
            description: "Buyurtmalarni yuklashda xatolik yuz berdi",
            variant: "destructive",
          })
          setLoading(false)
        },
      )

      return () => {
        unsubscribe()
        // Clear all timers on component unmount
        autoRejectTimers.current.forEach((timer) => clearTimeout(timer))
        autoRejectTimers.current.clear()
      }
    } catch (err: any) {
      console.error("Error setting up orders query:", err)
      setError("Buyurtmalar so'rovini o'rnatishda xatolik yuz berdi: " + err.message)
      setLoading(false)
    }
  }, [toast, userId, userName, isAdmin, handleAutoRejectOrder]) // Added handleAutoRejectOrder to dependencies

  // Fetch delivered orders
  useEffect(() => {
    try {
      if (activeTab !== "history") return

      setLoadingHistory(true)

      const fetchDeliveredOrders = async () => {
        try {
          let ordersSnapshot

          if (!isAdmin && userId) {
            const waiterOrdersQuery = query(
              collection(db, "orders"),
              where("waiterId", "==", userId),
              where("status", "==", "delivered"),
            )
            ordersSnapshot = await getDocs(waiterOrdersQuery)
          } else {
            // For admin, fetch all delivered orders
            ordersSnapshot = await getDocs(query(collection(db, "orders"), where("status", "==", "delivered")))
          }

          const deliveredOrdersList: Order[] = []

          ordersSnapshot.forEach((doc) => {
            const data = doc.data() as Omit<Order, "id">
            const order = { id: doc.id, ...data } as Order

            if (order.status === "delivered") {
              if (!order.orderDate && order.createdAt) {
                try {
                  let date
                  if (order.createdAt.toDate && typeof order.createdAt.toDate === "function") {
                    date = order.createdAt.toDate()
                  } else if (order.createdAt instanceof Date) {
                    date = order.createdAt
                  } else if (typeof order.createdAt === "number") {
                    date = new Date(order.createdAt)
                  } else if (typeof order.createdAt === "string") {
                    date = new Date(order.createdAt)
                  } else {
                    throw new Error("Invalid date format")
                  }

                  if (isNaN(date.getTime())) {
                    throw new Error("Invalid date value")
                  }

                  order.orderDate = new Intl.DateTimeFormat("uz-UZ", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(date)
                } catch (error) {
                  console.error("Error formatting order date:", error)
                  order.orderDate = "Sana xato"
                }
              }

              deliveredOrdersList.push(order)
            }
          })

          deliveredOrdersList.sort((a, b) => {
            const dateA =
              a.deliveredAt && typeof a.deliveredAt.toMillis === "function"
                ? a.deliveredAt.toMillis()
                : a.updatedAt && typeof a.updatedAt.toMillis === "function"
                  ? a.updatedAt.toMillis()
                  : 0

            const dateB =
              b.deliveredAt && typeof b.deliveredAt.toMillis === "function"
                ? b.deliveredAt.toMillis()
                : b.updatedAt && typeof b.updatedAt.toMillis === "function"
                  ? b.updatedAt.toMillis()
                  : 0

            return dateB - dateA
          })

          setDeliveredOrders(deliveredOrdersList)
          setLoadingHistory(false)
        } catch (error) {
          console.error("Error fetching delivered orders:", error)
          setLoadingHistory(false)
        }
      }

      fetchDeliveredOrders()

      // Listen for changes to orders collection to re-fetch delivered orders
      const unsubscribe = onSnapshot(
        collection(db, "orders"),
        () => {
          fetchDeliveredOrders()
        },
        (error) => {
          console.error("Error in delivered orders listener:", error)
        },
      )

      return () => unsubscribe()
    } catch (err) {
      console.error("Error setting up delivered orders query:", err)
      setLoadingHistory(false)
    }
  }, [activeTab, userId, isAdmin])

  // Fetch seating items (tables and rooms) for the tables tab
  useEffect(() => {
    if (activeTab !== "tables") return

    const fetchSeatingItems = async () => {
      setIsLoadingSeating(true)
      try {
        const seatingItemsQuery = collection(db, "seatingItems")

        const unsubscribe = onSnapshot(
          seatingItemsQuery,
          async (snapshot) => {
            const items: SeatingItem[] = []

            snapshot.forEach((doc) => {
              items.push({ id: doc.id, ...doc.data() } as SeatingItem)
            })

            // Also check tables collection for backward compatibility
            const tablesSnapshot = await getDocs(collection(db, "tables"))
            tablesSnapshot.forEach((doc) => {
              const data = doc.data()
              items.push({
                id: doc.id,
                number: data.number,
                status: data.status || "available",
                type: "Stol",
                waiterId: data.waiterId,
                waiterName: data.waiterName,
                floor: data.floor || 1,
              })
            })

            // Also check rooms collection for backward compatibility
            const roomsSnapshot = await getDocs(collection(db, "rooms"))
            roomsSnapshot.forEach((doc) => {
              const data = doc.data()
              items.push({
                id: doc.id,
                number: data.number,
                status: data.status || "available",
                type: "Xona",
                waiterId: data.waiterId,
                waiterName: data.waiterName,
                floor: data.floor || 1,
              })
            })

            // Remove duplicates
            const uniqueItems = items.filter(
              (item, index, self) => index === self.findIndex((t) => t.type === item.type && t.number === item.number),
            )

            // Sort by floor, type and number
            uniqueItems.sort((a, b) => {
              if ((a.floor || 1) !== (b.floor || 1)) {
                return (a.floor || 1) - (b.floor || 1)
              }
              if (a.type !== b.type) {
                return a.type.localeCompare(b.type)
              }
              return a.number - b.number
            })

            setSeatingItems(uniqueItems)
            setIsLoadingSeating(false)
          },
          (error) => {
            console.error("Error fetching seating items:", error)
            toast({
              title: "Xatolik",
              description: "Stollarni yuklashda xatolik yuz berdi",
              variant: "destructive",
            })
            setIsLoadingSeating(false)
          },
        )

        return () => unsubscribe()
      } catch (error) {
        console.error("Error setting up seating items listener:", error)
        toast({
          title: "Xatolik",
          description: "Stollarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
        setIsLoadingSeating(false)
      }
    }

    fetchSeatingItems()
  }, [activeTab, toast])

  // Fetch menu items and categories for the menu tab
  useEffect(() => {
    if (activeTab !== "menu" && activeTab !== "cart") return

    const fetchMenuItems = async () => {
      setIsLoadingMenu(true)
      try {
        // Fetch categories first
        const categoriesSnapshot = await getDocs(collection(db, "categories"))
        const categoriesData: { id: string; name: string }[] = []

        categoriesSnapshot.forEach((doc) => {
          categoriesData.push({ id: doc.id, name: doc.data().name })
        })

        setMenuCategories(categoriesData)

        // Fetch menu items
        const menuItemsQuery = query(collection(db, "menuItems"), where("isAvailable", "==", true))

        const menuSnapshot = await getDocs(menuItemsQuery)
        const menuData: MenuItem[] = []

        menuSnapshot.forEach((doc) => {
          menuData.push({ id: doc.id, ...doc.data() } as MenuItem)
        })

        setMenuItems(menuData)
        setIsLoadingMenu(false)
      } catch (error) {
        console.error("Error fetching menu data:", error)
        toast({
          title: "Xatolik",
          description: "Menyu ma'lumotlarini yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
        setIsLoadingMenu(false)
      }
    }

    fetchMenuItems()
  }, [activeTab, toast])

  // Get status badge color
  const getStatusColor = useCallback(
    (status: string) => {
      const statusOption = statusOptions.find((option) => option.value === status)
      return statusOption?.color || "bg-gray-500"
    },
    [statusOptions],
  )

  // Get status label
  const getStatusLabel = useCallback(
    (status: string) => {
      const statusOption = statusOptions.find((option) => option.value === status)
      return statusOption?.label || status
    },
    [statusOptions],
  )

  // Update order status
  const updateOrderStatus = useCallback(
    async (order: Order, newStatus: string) => {
      try {
        // Format current date and time for order
        const now = new Date()
        const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(now)

        const updateData: any = {
          status: newStatus || "pending",
          updatedAt: serverTimestamp(),
          waiterId: userId || order.waiterId || "anonymous",
          waiterName: userName || order.waiterName || "Unknown Waiter",
        }

        if (newStatus === "delivered") {
          updateData.deliveredAt = serverTimestamp()
        }

        // Sanitize data
        const sanitizedData = {}
        Object.keys(updateData).forEach((key) => {
          if (updateData[key] !== undefined) {
            sanitizedData[key] = updateData[key]
          } else {
            sanitizedData[key] = null
          }
        })

        await updateDoc(doc(db, "orders", order.id), sanitizedData)

        // Log status change to orderModifications collection
        const modificationData = {
          orderId: order.id,
          modifiedAt: serverTimestamp(),
          modifiedAtString: formattedDate,
          modifiedBy: userId || "anonymous",
          modifiedByName: userName || "Unknown",
          modificationType: "edit",
          tableNumber: order.tableNumber,
          roomNumber: order.roomNumber,
          floor: order.floor,
          notes: `Buyurtma holati o'zgartirildi: ${getStatusLabel(order.status)} → ${getStatusLabel(newStatus)}`,
          editedItems: [
            {
              before: { id: "status", name: "Holat", price: 0, quantity: 1, notes: order.status },
              after: { id: "status", name: "Holat", price: 0, quantity: 1, notes: newStatus },
            },
          ],
        }

        await addDoc(collection(db, "orderModifications"), modificationData)

        // Play appropriate sound
        if (newStatus === "ready") {
          playAudio("/ready.mp3")
        } else if (newStatus === "preparing") {
          playAudio("/cooking.mp3")
        } else if (newStatus === "delivered") {
          playAudio("/delivery.mp3")
        }

        toast({
          title: "Muvaffaqiyatli",
          description: `Buyurtma holati yangilandi: ${getStatusLabel(newStatus)}`,
        })

        // If marking as delivered, switch to the history tab
        if (newStatus === "delivered") {
          setActiveTab("history")
        }
      } catch (error) {
        console.error("Error updating order status:", error)
        toast({
          title: "Xatolik",
          description: "Buyurtma holatini yangilashda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    },
    [toast, userId, userName, getStatusLabel],
  )

  // Format date
  const formatDate = useCallback((timestamp: Timestamp | undefined | null, existingOrderDate?: string) => {
    if (existingOrderDate) {
      return existingOrderDate
    }

    if (!timestamp) {
      return "Ma'lumot yo'q"
    }

    try {
      let date
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate()
      } else if (timestamp instanceof Date) {
        date = timestamp
      } else if (typeof timestamp === "number") {
        date = new Date(timestamp)
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp)
      } else {
        throw new Error("Invalid date format")
      }

      if (isNaN(date.getTime())) {
        return "Sana xato"
      }

      return new Intl.DateTimeFormat("uz-UZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Sana xato"
    }
  }, [])

  // Calculate item total price
  const calculateItemTotal = useCallback((item: OrderItem) => {
    if (item.totalPrice !== undefined) {
      return item.totalPrice.toLocaleString()
    }

    const total = (item.price || 0) * (item.quantity || 1)
    return total.toLocaleString()
  }, [])

  // Get total amount from order
  const getOrderTotal = useCallback((order: Order) => {
    if (order.total !== undefined) {
      return order.total.toLocaleString()
    }

    if (order.totalAmount !== undefined) {
      return order.totalAmount.toLocaleString()
    }

    const total = order.items.reduce((sum, item) => {
      const itemTotal = item.totalPrice !== undefined ? item.totalPrice : (item.price || 0) * (item.quantity || 1)
      return sum + itemTotal
    }, 0)

    return total.toLocaleString()
  }, [])

  // Get table or room number
  const getTableNumber = useCallback((order: Order) => {
    if (order.tableNumber) {
      return `${order.tableNumber}`
    }
    if (order.roomNumber) {
      return `${order.roomNumber}`
    }
    return "0"
  }, [])

  // Calculate how long the order has been in its current status
  const getOrderTime = useCallback((order: Order) => {
    if (!order.updatedAt && !order.createdAt) return "Yangi"

    const timestamp = order.updatedAt || order.createdAt

    if (!timestamp || typeof timestamp.toMillis !== "function") {
      return "Yangi"
    }

    const orderTime = timestamp.toMillis()
    const now = Date.now()
    const diffMinutes = Math.floor((now - orderTime) / (1000 * 60))

    if (diffMinutes < 1) return "Hozirgina"
    if (diffMinutes === 1) return "1 daqiqa oldin"
    return `${diffMinutes} daqiqa oldin`
  }, [])

  // New Order Tab Handlers
  const handleSelectSeatingItem = (item: SeatingItem) => {
    setSelectedSeatingItem(item)

    // If the table is occupied, try to find the existing order
    if (item.status === "occupied") {
      const existingOrder = activeOrders.find(
        (order) =>
          (order.tableNumber === item.number && item.type.toLowerCase() === "stol") ||
          (order.roomNumber === item.number && item.type.toLowerCase() === "xona"),
      )

      if (existingOrder) {
        handleEditOrder(existingOrder)
      }
    }

    // Automatically switch to menu tab after selecting a table
    setActiveTab("menu")
  }

  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      // Check if item already exists in cart
      const existingItemIndex = prev.findIndex((cartItem) => cartItem.item.id === item.id)

      if (existingItemIndex >= 0) {
        // Item exists, update quantity
        const newCartItems = [...prev]
        newCartItems[existingItemIndex] = {
          ...newCartItems[existingItemIndex],
          quantity: newCartItems[existingItemIndex].quantity + 1,
        }
        return newCartItems
      } else {
        // Item doesn't exist, add new item
        return [...prev, { item, quantity: 1 }]
      }
    })

    // Play click sound
    playAudio("/click.mp3")

    // Animate cart badge
    setCartBadgeAnimation(true)
    setTimeout(() => setCartBadgeAnimation(false), 500)

    // Reset session timeout on user activity
    handleUserActivity()
  }

  const handleUpdateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      // If editing an existing order, record this item as removed
      if (isEditingOrder && currentEditingOrder) {
        const item = cartItems.find((cartItem) => cartItem.item.id === itemId)
        if (item) {
          setRemovedItems((prev) => {
            const existingIndex = prev.findIndex((ri) => ri.orderId === currentEditingOrder.id)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex].items.push({
                id: item.item.id,
                name: item.item.name,
                price: item.item.price,
                quantity: item.quantity,
                notes: item.notes,
              })
              return updated
            } else {
              return [
                ...prev,
                {
                  orderId: currentEditingOrder.id,
                  items: [
                    {
                      id: item.item.id,
                      name: item.item.name,
                      price: item.item.price,
                      quantity: item.quantity,
                      notes: item.notes,
                    },
                  ],
                },
              ]
            }
          })
        }
      }

      // Remove item if quantity is 0 or negative
      setCartItems((prev) => prev.filter((cartItem) => cartItem.item.id !== itemId))
    } else {
      // Update quantity
      setCartItems((prev) =>
        prev.map((cartItem) => (cartItem.item.id === itemId ? { ...cartItem, quantity: newQuantity } : cartItem)),
      )
    }

    // Play click sound for quantity change
    playAudio("/click.mp3")

    // Reset session timeout on user activity
    handleUserActivity()
  }

  const handleOpenQuantityDialog = (itemId: string, currentQuantity: number) => {
    setCurrentEditItem({ id: itemId, quantity: currentQuantity })
    setIsQuantityDialogOpen(true)

    // Focus the input field after dialog opens
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus()
        quantityInputRef.current.select()
      }
    }, 100)
  }

  const handleSaveQuantity = () => {
    if (currentEditItem) {
      handleUpdateCartItemQuantity(currentEditItem.id, currentEditItem.quantity)
      setIsQuantityDialogOpen(false)
      setCurrentEditItem(null)
    }
  }

  const handleClearCart = () => {
    // If editing an existing order, record all items as removed
    if (isEditingOrder && currentEditingOrder) {
      const allRemovedItems = cartItems.map((item) => ({
        id: item.item.id,
        name: item.item.name,
        price: item.item.price,
        quantity: item.quantity,
        notes: item.notes,
      }))

      setRemovedItems((prev) => {
        const existingIndex = prev.findIndex((ri) => ri.orderId === currentEditingOrder.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex].items = [...updated[existingIndex].items, ...allRemovedItems]
          return updated
        } else {
          return [
            ...prev,
            {
              orderId: currentEditingOrder.id,
              items: allRemovedItems,
            },
          ]
        }
      })
    }

    setCartItems([])

    // Play delete sound
    playAudio("/notification.mp3")

    // Reset session timeout on user activity
    handleUserActivity()
  }

  const calculateCartTotal = () => {
    return cartItems.reduce((total, { item, quantity }) => total + item.price * quantity, 0)
  }

  const handleEditOrder = async (order: Order) => {
    // Check if the current user is authorized to edit this order
    if (!isAdmin && order.claimedBy && order.claimedBy !== userId) {
      toast({
        title: "Ruxsat yo'q",
        description: "Bu buyurtma boshqa ofitsiant tomonidan qabul qilingan.",
        variant: "destructive",
      })
      return
    }

    setIsEditingOrder(true)
    setCurrentEditingOrder(order)

    // Convert order items to cart items
    const newCartItems = order.items.map((item) => {
      // Find the menu item in our loaded menu items
      const menuItem = menuItems.find((mi) => mi.id === item.id)

      // If we can't find it in our loaded menu items, create a temporary one
      const itemData = menuItem || {
        id: item.id,
        name: item.name,
        price: item.price,
        category: "unknown",
      }

      return {
        item: itemData as MenuItem,
        quantity: item.quantity,
        notes: item.notes,
      }
    })

    setCartItems(newCartItems)

    // Store original cart items for comparison when saving
    setOriginalCartItems(
      order.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    )

    // Set selected seating item
    const seatingType = order.seatingType || (order.roomNumber ? "Xona" : "Stol")
    const seatingNumber = order.roomNumber || order.tableNumber

    // Find the matching seating item
    const matchingSeatingItem = seatingItems.find(
      (item) => item.type.toLowerCase() === seatingType.toLowerCase() && item.number === Number(seatingNumber),
    )

    // If we found a matching item, select it
    if (matchingSeatingItem) {
      setSelectedSeatingItem(matchingSeatingItem)
    }
    // If we can't find it, create a temporary one
    else {
      const tempSeatingItem = {
        id: `temp-${seatingType}-${seatingNumber}`,
        type: seatingType,
        number: Number(seatingNumber),
        status: "occupied" as const,
        floor: order.floor || 1,
      }
      setSelectedSeatingItem(tempSeatingItem)
    }

    // Reset hasNewItems flag if it was set
    if (order.hasNewItems) {
      try {
        await updateDoc(doc(db, "orders", order.id), {
          hasNewItems: false,
        })
      } catch (error) {
        console.error("Error resetting hasNewItems flag:", error)
      }
    }

    // Switch to cart tab
    setActiveTab("cart")

    // Reset session timeout on user activity
    handleUserActivity()
  }

  const handleCancelEdit = () => {
    setIsEditingOrder(false)
    setCurrentEditingOrder(null)
    setCartItems([])
    setSelectedSeatingItem(null)
    setRemovedItems([])
    setOriginalCartItems([])

    // Reset session timeout on user activity
    handleUserActivity()
  }

  const handleSubmitOrder = async () => {
    // Check if user is authorized to place orders
    if (userRole !== "admin" && userRole !== "waiter") {
      toast({
        title: "Ruxsat yo'q",
        description: "Faqat admin va ofitsiant foydalanuvilar buyurtma bera oladi.",
        variant: "destructive",
      })
      return
    }

    // Deep sanitize function
    const deepSanitize = (obj: any): any => {
      if (obj === undefined) return null
      if (obj === null) return null

      if (Array.isArray(obj)) {
        return obj.map((item) => deepSanitize(item))
      }

      if (
        typeof obj === "object" &&
        obj !== null &&
        !Timestamp.prototype.isPrototypeOf(obj) &&
        !(obj instanceof Date)
      ) {
        const result: { [key: string]: any } = {}
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key]
            result[key] = deepSanitize(value)
          }
        }
        return result
      }

      return obj
    }

    if (!selectedSeatingItem) {
      toast({
        title: "Xatolik",
        description: "Iltimos, stol yoki xona tanlang",
        variant: "destructive",
      })
      return
    }

    if (cartItems.length === 0) {
      toast({
        title: "Xatolik",
        description: "Iltimos, buyurtma uchun taomlar tanlang",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingOrder(true)

    try {
      // Prepare order items
      const orderItems = cartItems.map(({ item, quantity, notes }) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity,
        notes: notes || null,
        category: item.category || null,
        categoryId: item.categoryId || null,
      }))

      // Calculate total
      const total = calculateCartTotal()

      // Format current date and time for order
      const now = new Date()
      const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)

      if (isEditingOrder && currentEditingOrder) {
        // Ensure the current user is authorized to edit this order
        if (!isAdmin && currentEditingOrder.claimedBy && currentEditingOrder.claimedBy !== userId) {
          toast({
            title: "Ruxsat yo'q",
            description: "Bu buyurtma boshqa ofitsiant tomonidan qabul qilingan.",
            variant: "destructive",
          })
          setIsSubmittingOrder(false)
          return
        }

        // Sanitize data
        const updateOrderData = {
          items: orderItems,
          subtotal: total,
          total: total,
          updatedAt: serverTimestamp(),
          orderDate: currentEditingOrder.orderDate || formattedDate,
          // Ensure claimedBy and claimedByName are preserved or updated if admin
          claimedBy: currentEditingOrder.claimedBy || userId,
          claimedByName: currentEditingOrder.claimedByName || userName,
          waiterId: userId, // Always set current waiter as the one who last modified
          waiterName: userName,
          hasNewItems: false, // Reset this flag on edit/submit
        }

        // Apply sanitize
        const sanitizedUpdateData = deepSanitize(updateOrderData)

        // Update existing order
        await updateDoc(doc(db, "orders", currentEditingOrder.id), sanitizedUpdateData)

        // Analyze changes for order modifications

        // 1. Find items that were added (not in the original order)
        const addedItems = cartItems
          .filter(({ item }) => !originalCartItems.some((orderItem) => orderItem.id === item.id))
          .map(({ item, quantity, notes }) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity,
            notes: notes || null,
          }))

        // 2. Find items that were modified (quantity changed)
        const editedItems = cartItems
          .filter(({ item, quantity }) => {
            const originalItem = originalCartItems.find((orderItem) => orderItem.id === item.id)
            return originalItem && originalItem.quantity !== quantity
          })
          .map(({ item, quantity, notes }) => {
            const originalItem = originalCartItems.find((orderItem) => orderItem.id === item.id)
            return {
              before: {
                id: originalItem!.id,
                name: originalItem!.name,
                price: originalItem!.price,
                quantity: originalItem!.quantity,
              },
              after: {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity,
                notes: notes || null,
              },
            }
          })

        // 3. Process removed items
        const removedItemsForOrder = removedItems.find((ri) => ri.orderId === currentEditingOrder.id)
        const removedItemsList = removedItemsForOrder?.items || []

        // 4. Log modifications to orderModifications collection

        // 4.1 Log added items if any
        if (addedItems.length > 0) {
          const addModificationData = {
            orderId: currentEditingOrder.id,
            modifiedAt: serverTimestamp(),
            modifiedAtString: formattedDate,
            modifiedBy: userId || "anonymous",
            modifiedByName: userName || "Unknown",
            modificationType: "add",
            tableNumber: currentEditingOrder.tableNumber,
            roomNumber: currentEditingOrder.roomNumber,
            floor: currentEditingOrder.floor,
            addedItems: addedItems,
            notes: `Buyurtmaga ${addedItems.length} ta yangi taom qo'shildi`,
          }

          await addDoc(collection(db, "orderModifications"), deepSanitize(addModificationData))
        }

        // 4.2 Log removed items if any
        if (removedItemsList.length > 0) {
          const removeModificationData = {
            orderId: currentEditingOrder.id,
            modifiedAt: serverTimestamp(),
            modifiedAtString: formattedDate,
            modifiedBy: userId || "anonymous",
            modifiedByName: userName || "Unknown",
            modificationType: "remove",
            tableNumber: currentEditingOrder.tableNumber,
            roomNumber: currentEditingOrder.roomNumber,
            floor: currentEditingOrder.floor,
            removedItems: removedItemsList,
            notes: `Buyurtmadan ${removedItemsList.length} ta taom o'chirildi`,
          }

          await addDoc(collection(db, "orderModifications"), deepSanitize(removeModificationData))
        }

        // 4.3 Log edited items if any
        if (editedItems.length > 0) {
          const editModificationData = {
            orderId: currentEditingOrder.id,
            modifiedAt: serverTimestamp(),
            modifiedAtString: formattedDate,
            modifiedBy: userId || "anonymous",
            modifiedByName: userName || "Unknown",
            modificationType: "edit",
            tableNumber: currentEditingOrder.tableNumber,
            roomNumber: currentEditingOrder.roomNumber,
            floor: currentEditingOrder.floor,
            editedItems: editedItems,
            notes: `Buyurtmadagi ${editedItems.length} ta taom miqdori o'zgartirildi`,
          }

          await addDoc(collection(db, "orderModifications"), deepSanitize(editModificationData))
        }

        toast({
          title: "Buyurtma yangilandi!",
          description: "Buyurtma muvaffaqiyatli yangilandi",
        })
      } else {
        // Create order data for new order (placed by waiter)
        const orderData = {
          orderType: selectedSeatingItem.type.toLowerCase() === "stol" ? "table" : "xona",
          tableNumber: selectedSeatingItem.type.toLowerCase() === "stol" ? selectedSeatingItem.number : null,
          roomNumber: selectedSeatingItem.type.toLowerCase() === "xona" ? selectedSeatingItem.number : null,
          seatingType: selectedSeatingItem.type || "unknown",
          items: orderItems,
          subtotal: total,
          total: total,
          status: "preparing", // Waiter-placed orders start as preparing and claimed
          createdAt: serverTimestamp(),
          waiterId: userId || "anonymous",
          waiterName: userName || "Unknown Waiter",
          claimedBy: userId, // Waiter placing the order claims it immediately
          claimedByName: userName,
          isPaid: false,
          floor: selectedSeatingItem.floor || 1,
          orderDate: formattedDate,
          rejectionCount: 0, // Initialize rejection count
          lastRejectedBy: null,
          lastRejectedAt: null,
          hasNewItems: false, // New orders don't have new items initially
        }

        const sanitizedOrderData = deepSanitize(orderData)

        // Add order to Firestore
        const orderRef = await addDoc(collection(db, "orders"), sanitizedOrderData)

        // Log new order creation to orderModifications
        const newOrderModificationData = {
          orderId: orderRef.id,
          modifiedAt: serverTimestamp(),
          modifiedAtString: formattedDate,
          modifiedBy: userId || "anonymous",
          modifiedByName: userName || "Unknown",
          modificationType: "add",
          tableNumber: selectedSeatingItem.type.toLowerCase() === "stol" ? selectedSeatingItem.number : null,
          roomNumber: selectedSeatingItem.type.toLowerCase() === "xona" ? selectedSeatingItem.number : null,
          floor: selectedSeatingItem.floor || 1,
          addedItems: orderItems,
          notes: `Yangi buyurtma yaratildi: ${orderItems.length} ta taom`,
        }

        await addDoc(collection(db, "orderModifications"), deepSanitize(newOrderModificationData))

        // Update the seating item to mark it as occupied
        try {
          // Find the seating item document
          let seatingItemRef
          if (selectedSeatingItem.type.toLowerCase() === "stol" || selectedSeatingItem.type.toLowerCase() === "xona") {
            // Check in seatingItems collection first
            const seatingItemsQuery = query(
              collection(db, "seatingItems"),
              where("type", "==", selectedSeatingItem.type),
              where("number", "==", selectedSeatingItem.number),
            )
            const snapshot = await getDocs(seatingItemsQuery)

            if (!snapshot.empty) {
              seatingItemRef = doc(db, "seatingItems", snapshot.docs[0].id)
            } else {
              // Check in legacy collections as fallback
              const collectionName = selectedSeatingItem.type.toLowerCase() === "stol" ? "tables" : "rooms"
              const itemsQuery = query(
                collection(db, collectionName),
                where("number", "==", selectedSeatingItem.number),
              )
              const itemsSnapshot = await getDocs(itemsQuery)

              if (!itemsSnapshot.empty) {
                seatingItemRef = doc(db, collectionName, itemsSnapshot.docs[0].id)
              }
            }
          }

          // Update the seating item if found
          if (seatingItemRef) {
            const seatingUpdateData = {
              status: "occupied",
              updatedAt: serverTimestamp(),
            }
            await updateDoc(seatingItemRef, seatingUpdateData)
          }
        } catch (error) {
          console.error("Error updating seating item status:", error)
          // Continue with the order even if updating the seating item fails
        }

        toast({
          title: "Buyurtma qabul qilindi!",
          description: `${selectedSeatingItem.type} #${selectedSeatingItem.number} uchun buyurtma muvaffaqiyatli qabul qilindi.`,
        })
      }

      // Update remaining servings for each item
      for (const { item, quantity } of cartItems) {
        try {
          const menuItemRef = doc(db, "menuItems", item.id)
          // Fetch the menu item document
          const menuItemSnap = await getDoc(menuItemRef)

          if (menuItemSnap.exists()) {
            const menuItemData = menuItemSnap.data() as MenuItem
            const remainingServings = (menuItemData.remainingServings || menuItemData.servesCount || 0) - quantity

            await updateDoc(menuItemRef, {
              remainingServings: remainingServings > 0 ? remainingServings : 0,
            })
          }
        } catch (error) {
          console.error(`Error updating item ${item.id}:`, error)
          // Continue with the order even if updating an item fails
        }
      }

      // Play success sound
      playAudio("/success.mp3")

      // Reset form
      setCartItems([])
      setSelectedSeatingItem(null)
      setIsEditingOrder(false)
      setCurrentEditingOrder(null)
      setRemovedItems([])
      setOriginalCartItems([])

      // Switch back to active orders tab
      setActiveTab("orders")
    } catch (error) {
      console.error("Error placing order:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmani joylashtirishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingOrder(false)
    }

    // Reset session timeout on user activity
    handleUserActivity()
  }

  const handleClaimOrder = useCallback(
    async (order: Order) => {
      if (!userId || !userName) {
        toast({
          title: "Xatolik",
          description: "Buyurtmani qabul qilish uchun tizimga kiring.",
          variant: "destructive",
        })
        return
      }

      try {
        await updateDoc(doc(db, "orders", order.id), {
          claimedBy: userId,
          claimedByName: userName,
          status: "preparing", // Set status to preparing immediately upon claiming
          updatedAt: serverTimestamp(),
          rejectionCount: 0, // Reset rejection count when claimed
          lastRejectedBy: null,
          lastRejectedAt: null,
          hasNewItems: false, // Reset this flag on claiming
        })

        // Log claiming action
        const now = new Date()
        const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(now)

        const modificationData = {
          orderId: order.id,
          modifiedAt: serverTimestamp(),
          modifiedAtString: formattedDate,
          modifiedBy: userId,
          modifiedByName: userName,
          modificationType: "claim",
          tableNumber: order.tableNumber,
          roomNumber: order.roomNumber,
          floor: order.floor,
          notes: `Buyurtma ${userName} tomonidan qabul qilindi.`,
        }
        await addDoc(collection(db, "orderModifications"), modificationData)

        playAudio("/success.mp3") // Play a success sound for claiming
        toast({
          title: "Buyurtma qabul qilindi!",
          description: `Siz ${order.seatingType} #${getTableNumber(order)} buyurtmasini qabul qildingiz.`,
        })

        // Clear the auto-reject timer for this order if it exists
        if (autoRejectTimers.current.has(order.id)) {
          clearTimeout(autoRejectTimers.current.get(order.id)!)
          autoRejectTimers.current.delete(order.id)
        }
      } catch (error) {
        console.error("Error claiming order:", error)
        toast({
          title: "Xatolik",
          description: "Buyurtmani qabul qilishda xatolik yuz berdi.",
          variant: "destructive",
        })
      }
    },
    [userId, userName, toast, getTableNumber],
  )

  // New: Handle order rejection
  const handleRejectOrder = useCallback(
    async (order: Order) => {
      if (!userId || !userName) {
        toast({
          title: "Xatolik",
          description: "Buyurtmani rad etish uchun tizimga kiring.",
          variant: "destructive",
        })
        return
      }

      try {
        await updateDoc(doc(db, "orders", order.id), {
          claimedBy: null,
          claimedByName: null,
          status: "pending", // Keep status as pending
          updatedAt: serverTimestamp(),
          rejectionCount: increment(1), // Increment rejection count
          lastRejectedBy: userId, // Mark who rejected it
          lastRejectedAt: serverTimestamp(),
        })

        // Log rejection action
        const now = new Date()
        const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(now)

        const modificationData = {
          orderId: order.id,
          modifiedAt: serverTimestamp(),
          modifiedAtString: formattedDate,
          modifiedBy: userId,
          modifiedByName: userName,
          modificationType: "reject",
          tableNumber: order.tableNumber,
          roomNumber: order.roomNumber,
          floor: order.floor,
          notes: `Buyurtma ${userName} tomonidan rad etildi.`,
        }
        await addDoc(collection(db, "orderModifications"), modificationData)

        playAudio("/notification.mp3") // Play a notification sound to alert other waiters
        toast({
          title: "Buyurtma rad etildi",
          description: `Siz ${order.seatingType} #${getTableNumber(order)} buyurtmasini rad etdingiz.`,
        })

        // Clear the auto-reject timer for this order if it exists
        if (autoRejectTimers.current.has(order.id)) {
          clearTimeout(autoRejectTimers.current.get(order.id)!)
          autoRejectTimers.current.delete(order.id)
        }
      } catch (error) {
        console.error("Error rejecting order:", error)
        toast({
          title: "Xatolik",
          description: "Buyurtmani rad etishda xatolik yuz berdi.",
          variant: "destructive",
        })
      }
    },
    [userId, userName, toast, getTableNumber],
  )

  const handlePrintReceipt = useCallback(async () => {
    if (!orderToPrint) return

    try {
      // 1. Update order status to delivered and paid
      await updateDoc(doc(db, "orders", orderToPrint.id), {
        status: "delivered",
        isPaid: true,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        orderDate: orderToPrint.orderDate || formatDate(orderToPrint.createdAt),
      })

      // 2. Log checkout to orderModifications
      const now = new Date()
      const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)

      const checkoutModificationData = {
        orderId: orderToPrint.id,
        modifiedAt: serverTimestamp(),
        modifiedAtString: formattedDate,
        modifiedBy: userId || "anonymous",
        modifiedByName: userName || "Unknown",
        modificationType: "edit",
        tableNumber: orderToPrint.tableNumber,
        roomNumber: orderToPrint.roomNumber,
        floor: orderToPrint.floor,
        notes: "Buyurtma to'landi va chek chiqarish so'rovi yuborildi",
        editedItems: [
          {
            before: {
              id: "payment",
              name: "To'lov holati",
              price: 0,
              quantity: 1,
              notes: orderToPrint.isPaid ? "To'langan" : "To'lanmagan",
            },
            after: {
              id: "payment",
              name: "To'lov holati",
              price: 0,
              quantity: 1,
              notes: "To'langan",
            },
          },
        ],
      }
      await addDoc(collection(db, "orderModifications"), checkoutModificationData)

      // 3. Add to printQueue for admin dashboard to pick up
      await addDoc(collection(db, "printQueue"), {
        orderId: orderToPrint.id,
        status: "pending",
        requestedAt: serverTimestamp(),
        requestedBy: userId || "anonymous",
        requestedByName: userName || "Unknown",
      })

      playAudio("/success.mp3")
      toast({
        title: "Chek so'rovi yuborildi!",
        description: "Chek chop etish uchun admin paneliga yuborildi.",
      })

      // Switch to history tab after sending print request
      setActiveTab("history")
    } catch (error) {
      console.error("Error sending print request:", error)
      toast({
        title: "Xatolik",
        description: "Chekni chop etish so'rovini yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        variant: "destructive",
      })
    } finally {
      setIsPrintConfirmOpen(false)
      setOrderToPrint(null)
      handleUserActivity()
    }
  }, [orderToPrint, userId, userName, toast, formatDate])

  // Filter seating items based on selected floor, type and status
  const filteredSeatingItems = useMemo(() => {
    return seatingItems.filter((item) => {
      const matchesFloor = !selectedFloor || (item.floor || 1) === selectedFloor
      const matchesType = !selectedSeatingType || item.type.toLowerCase() === selectedSeatingType.toLowerCase()
      const matchesStatus = tableStatus === "all" || item.status === tableStatus
      return matchesFloor && matchesType && matchesStatus
    })
  }, [seatingItems, selectedFloor, selectedSeatingType, tableStatus])

  // Calculate remaining servings percentage
  const getRemainingServingsPercentage = (item: MenuItem) => {
    const total = item.servesCount || 100
    const remaining = item.remainingServings !== undefined ? item.remainingServings : total
    return Math.max(0, Math.min(100, (remaining / total) * 100))
  }

  // Get remaining servings color
  const getRemainingServingsColor = (percentage: number) => {
    if (percentage > 60) return "bg-green-500"
    if (percentage > 30) return "bg-amber-500"
    return "bg-red-500"
  }

  // Render Tables Screen
  const renderTablesScreen = () => {
    if (isLoadingSeating) {
      return (
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Stollar yuklanmoqda...</p>
        </div>
      )
    }

    return (
      <div className="p-2">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Stollar</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1"
            >
              <Filter className="h-4 w-4" />
              Filter
              <ChevronDown className={`h-4 w-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
            </Button>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-lg border bg-card p-4 shadow-sm mb-4"
            >
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium">Qavat</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedFloor === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFloor(null)}
                    >
                      Barchasi
                    </Button>
                    {floors.map((floor) => (
                      <Button
                        key={floor.id}
                        variant={selectedFloor === floor.number ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFloor(floor.number)}
                      >
                        {floor.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Tur</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedSeatingType === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSeatingType(null)}
                    >
                      Barchasi
                    </Button>
                    {seatingTypes.map((type) => (
                      <Button
                        key={type}
                        variant={selectedSeatingType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSeatingType(type)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Holat</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={tableStatus === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTableStatus("all")}
                    >
                      Barchasi
                    </Button>
                    <Button
                      variant={tableStatus === "available" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTableStatus("available")}
                      className="bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900"
                    >
                      Bo'sh
                    </Button>
                    <Button
                      variant={tableStatus === "occupied" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTableStatus("occupied")}
                      className="bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900"
                    >
                      Band
                    </Button>
                    <Button
                      variant={tableStatus === "reserved" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTableStatus("reserved")}
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-amber-900"
                    >
                      Bron qilingan
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredSeatingItems.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Hech qanday stol topilmadi</p>
              <p className="text-sm text-muted-foreground">Iltimos, boshqa filter parametrlarini tanlang</p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {filteredSeatingItems.map((item) => {
              const isOccupied = item.status === "occupied"
              const isReserved = item.status === "reserved"

              // Find if there's an active order for this table
              const hasActiveOrder = activeOrders.some(
                (order) =>
                  (order.tableNumber === item.number && item.type.toLowerCase() === "stol") ||
                  (order.roomNumber === item.number && item.type.toLowerCase() === "xona"),
              )

              return (
                <Button
                  key={item.id}
                  variant="outline"
                  className={`h-20 w-full p-0 ${
                    isOccupied || hasActiveOrder
                      ? "bg-red-100 hover:bg-red-200"
                      : isReserved
                        ? "bg-amber-100 hover:bg-amber-200"
                        : "bg-green-100 hover:bg-green-200"
                  }`}
                  onClick={() => handleSelectSeatingItem(item)}
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{item.number}</span>
                    <span className="text-xs">{item.type}</span>
                    {item.seats && <span className="text-xs">{item.seats} o'rin</span>}
                  </div>
                </Button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSeatingItems.map((item) => {
              const isOccupied = item.status === "occupied"
              const isReserved = item.status === "reserved"

              // Find if there's an active order for this table
              const hasActiveOrder = activeOrders.some(
                (order) =>
                  (order.tableNumber === item.number && item.type.toLowerCase() === "stol") ||
                  (order.roomNumber === item.number && item.type.toLowerCase() === "xona"),
              )

              return (
                <Card
                  key={item.id}
                  className={`${
                    isOccupied || hasActiveOrder
                      ? "border-red-200 bg-red-50"
                      : isReserved
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50"
                  }`}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isOccupied || hasActiveOrder
                            ? "bg-red-100 text-red-800"
                            : isReserved
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                        }`}
                      >
                        <span className="text-lg font-bold">{item.number}</span>
                      </div>
                      <div>
                        <p className="font-medium">{item.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {getFloorName(item.floor)} • {item.seats || 4} o'rin
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${
                        isOccupied || hasActiveOrder
                          ? "bg-red-100 text-red-800"
                          : isReserved
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {isOccupied || hasActiveOrder ? "Band" : isReserved ? "Bron qilingan" : "Bo'sh"}
                    </Badge>
                  </CardContent>
                  <CardFooter className="p-3 pt-0">
                    <Button
                      className="w-full"
                      variant={isOccupied || hasActiveOrder ? "outline" : "default"}
                      onClick={() => handleSelectSeatingItem(item)}
                    >
                      {isOccupied || hasActiveOrder ? "Ko'rish" : "Tanlash"}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Render Menu Screen
  const renderMenuScreen = () => {
    if (isLoadingMenu) {
      return (
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Menyu yuklanmoqda...</p>
        </div>
      )
    }

    return (
      <div className="p-2">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("tables")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Menyu</h1>
          </div>
          <Button variant="outline" size="sm" className="relative bg-transparent" onClick={() => setActiveTab("cart")}>
            <ShoppingCart className="h-5 w-5" />
            <AnimatePresence>
              {cartTotalItems > 0 && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: cartBadgeAnimation ? 1.2 : 1,
                    opacity: 1,
                  }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white"
                >
                  {cartTotalItems}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>

        {!selectedSeatingItem && (
          <div className="mb-4 text-center">
            <p className="text-muted-foreground mb-2">Buyurtma berish uchun avval joy tanlang.</p>
            <Button onClick={() => setActiveTab("tables")}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Yangi buyurtma
            </Button>
          </div>
        )}

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Taom nomini kiriting..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="mb-4 h-12 whitespace-nowrap">
          <div className="flex gap-2 pb-1">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
            >
              Barchasi
            </Button>
            {menuCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </ScrollArea>

        <div className="grid grid-cols-2 gap-3 pb-20 md:grid-cols-3 lg:grid-cols-4">
          {filteredMenuItems.map((item) => {
            const remainingPercentage = getRemainingServingsPercentage(item)
            const remainingColor = getRemainingServingsColor(remainingPercentage)
            const cartItem = cartItems.find((cartIt) => cartIt.item.id === item.id)
            const currentQuantity = cartItem ? cartItem.quantity : 0

            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="h-32 w-full overflow-hidden">
                  <img
                    src={item.imageUrl || "/placeholder.svg?height=128&width=128&text=No Image"}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium line-clamp-1">{item.name}</h3>
                  <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(item.price)}</p>
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  )}

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Qolgan: {item.remainingServings !== undefined ? item.remainingServings : "∞"}
                      </span>
                      <span
                        className={`font-medium ${
                          remainingPercentage > 60
                            ? "text-green-600"
                            : remainingPercentage > 30
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {remainingPercentage.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={remainingPercentage} className={`h-1.5 mt-1 ${remainingColor}`} />
                  </div>
                </CardContent>
                <CardFooter className="p-3 pt-0">
                  {currentQuantity > 0 ? (
                    <div className="flex w-full items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 bg-transparent"
                        onClick={() => handleUpdateCartItemQuantity(item.id, currentQuantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleOpenQuantityDialog(item.id, currentQuantity)}
                      >
                        {currentQuantity}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 bg-transparent"
                        onClick={() => handleUpdateCartItemQuantity(item.id, currentQuantity + 1)}
                        disabled={!item.remainingServings && item.remainingServings !== undefined}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => handleAddToCart(item)}
                      disabled={!item.remainingServings && item.remainingServings !== undefined}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {!item.remainingServings && item.remainingServings !== undefined ? "Tugagan" : "Qo'shish"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // Render Cart Screen
  const renderCartScreen = () => {
    return (
      <div className="p-2 flex flex-col h-[calc(100vh-64px)]">
        {" "}
        {/* Adjusted height for sticky footer */}
        <div className="mb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("menu")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Savat</h1>
          </div>
          {cartItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearCart}>
              <Trash2 className="mr-1 h-4 w-4" />
              Tozalash
            </Button>
          )}
        </div>
        {selectedSeatingItem && (
          <div className="mb-4 rounded-lg bg-muted p-3 shrink-0">
            <p className="font-medium">
              {selectedSeatingItem.type} #{selectedSeatingItem.number}
            </p>
          </div>
        )}
        <ScrollArea className="flex-1 pb-4">
          {" "}
          {/* flex-1 to take available space, pb for scroll */}
          {cartItems.length > 0 ? (
            <div className="space-y-3">
              {cartItems.map(({ item, quantity, notes }, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-center">
                    <h3 className="font-medium line-clamp-1">{item.name}</h3>
                    <p className="text-sm font-bold text-primary text-right">{formatCurrency(item.price)}</p>
                    <div className="flex items-center gap-1 col-span-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 bg-transparent"
                        onClick={() => handleUpdateCartItemQuantity(item.id, quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleOpenQuantityDialog(item.id, quantity)}
                      >
                        {quantity}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 bg-transparent"
                        onClick={() => handleUpdateCartItemQuantity(item.id, quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="font-medium text-right shrink-0">{formatCurrency(item.price * quantity)}</p>
                    {notes && <p className="col-span-2 text-xs text-muted-foreground mt-1">Izoh: {notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Savat bo'sh</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 bg-transparent"
                  onClick={() => setActiveTab("menu")}
                >
                  Menyuga qaytish
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
        <div className="mt-auto shrink-0">
          {" "}
          {/* Sticky footer for cart */}
          <div className="mt-4 rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Jami:</p>
              <p className="text-lg font-bold">{formatCurrency(calculateCartTotal())}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {isEditingOrder && (
              <Button variant="outline" className="flex-1 bg-transparent" onClick={handleCancelEdit}>
                Bekor qilish
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={handleSubmitOrder}
              disabled={(!isEditingOrder && !selectedSeatingItem) || cartItems.length === 0 || isSubmittingOrder}
            >
              {isSubmittingOrder ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buyurtma joylashtirilmoqda...
                </>
              ) : (
                "Buyurtma berish"
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Render Orders Screen
  const renderOrdersScreen = () => {
    if (loading) {
      return (
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Buyurtmalar yuklanmoqda...</p>
        </div>
      )
    }

    // Filter orders for the current waiter's view
    const unclaimedOrdersForMe = activeOrders.filter(
      (order) => !order.claimedBy && order.status === "pending" && order.lastRejectedBy !== userId,
    )
    const myActiveOrders = activeOrders.filter(
      (order) => order.claimedBy === userId && ["pending", "preparing", "ready"].includes(order.status),
    )
    const otherActiveOrders = activeOrders.filter(
      (order) =>
        order.claimedBy && order.claimedBy !== userId && ["pending", "preparing", "ready"].includes(order.status),
    )
    // Orders that are pending and unclaimed, but were rejected by the current user
    const rejectedByMeOrders = activeOrders.filter(
      (order) => !order.claimedBy && order.status === "pending" && order.lastRejectedBy === userId,
    )

    return (
      <div className="p-2">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Buyurtmalar</h1>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="space-y-4 pb-20">
            {unclaimedOrdersForMe.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mt-4">Yangi buyurtmalar</h2>
                {unclaimedOrdersForMe.map((order) => {
                  return (
                    <Card key={order.id} className="overflow-hidden border-blue-300 bg-blue-50">
                      <CardHeader className="bg-blue-100 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-500">{getStatusLabel(order.status)}</Badge>
                            <span className="font-bold">
                              {order.seatingType} #{getTableNumber(order)}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">{getOrderTime(order)}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>
                                {item.quantity}x {item.name}
                                {item.notes && (
                                  <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>
                                )}
                              </span>
                              <span>{calculateItemTotal(item)} so'm</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-bold">
                          <span>Jami:</span>
                          <span>{getOrderTotal(order)} so'm</span>
                        </div>
                        {order.rejectionCount && order.rejectionCount > 0 && (
                          <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>{order.rejectionCount} marta rad etilgan</span>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex gap-2 p-3 pt-0">
                        <Button size="sm" className="w-full" onClick={() => handleClaimOrder(order)}>
                          <PlusCircle className="mr-1 h-4 w-4" />
                          Qabul qilish
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-transparent"
                          onClick={() => handleRejectOrder(order)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Rad etish
                        </Button>
                      </CardFooter>
                    </Card>
                  )
                })}
              </>
            )}

            {rejectedByMeOrders.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mt-4">Siz rad etgan buyurtmalar</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  Bu buyurtmalar siz tomonidan rad etilgan va boshqa ofitsiantlarga ko'rinadi.
                </p>
                {rejectedByMeOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden border-red-300 bg-red-50 opacity-70">
                    <CardHeader className="bg-red-100 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-500">{getStatusLabel(order.status)}</Badge>
                          <span className="font-bold">
                            {order.seatingType} #{getTableNumber(order)}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">{getOrderTime(order)}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {item.quantity}x {item.name}
                              {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                            </span>
                            <span>{calculateItemTotal(item)} so'm</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-bold">
                        <span>Jami:</span>
                        <span>{getOrderTotal(order)} so'm</span>
                      </div>
                      {order.rejectionCount && order.rejectionCount > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>{order.rejectionCount} marta rad etilgan</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex gap-2 p-3 pt-0">
                      <Button size="sm" className="w-full" disabled>
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Siz rad etdingiz
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </>
            )}

            {myActiveOrders.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mt-4">Mening faol buyurtmalarim</h2>
                {myActiveOrders.map((order) => (
                  <Card
                    key={order.id}
                    className={`overflow-hidden ${order.hasNewItems ? "border-red-500 animate-pulse" : ""}`}
                  >
                    <CardHeader className="bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</Badge>
                          <span className="font-bold">
                            {order.seatingType} #{getTableNumber(order)}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {order.claimedByName || "Noma'lum"} • {getOrderTime(order)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {item.quantity}x {item.name}
                              {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                            </span>
                            <span>{calculateItemTotal(item)} so'm</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-bold">
                        <span>Jami:</span>
                        <span>{getOrderTotal(order)} so'm</span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 p-3 pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => handleEditOrder(order)}
                      >
                        <FileEdit className="mr-1 h-4 w-4" />
                        Tahrirlash
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setOrderToPrint(order)
                          setIsPrintConfirmOpen(true)
                        }}
                      >
                        <Receipt className="mr-1 h-4 w-4" />
                        Chek chiqarish
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </>
            )}

            {otherActiveOrders.length > 0 &&
              isAdmin && ( // Only show other orders if admin
                <>
                  <h2 className="text-lg font-semibold mt-4">Boshqa ofitsiantlarning buyurtmalari</h2>
                  {otherActiveOrders.map((order) => (
                    <Card key={order.id} className="overflow-hidden border-gray-300 bg-gray-50">
                      <CardHeader className="bg-gray-100 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</Badge>
                            <span className="font-bold">
                              {order.seatingType} #{getTableNumber(order)}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {order.claimedByName || "Noma'lum"} • {getOrderTime(order)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>
                                {item.quantity}x {item.name}
                                {item.notes && (
                                  <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>
                                )}
                              </span>
                              <span>{calculateItemTotal(item)} so'm</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-bold">
                          <span>Jami:</span>
                          <span>{getOrderTotal(order)} so'm</span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex gap-2 p-3 pt-0">
                        <Button variant="outline" size="sm" className="flex-1 bg-transparent" disabled>
                          <FileEdit className="mr-1 h-4 w-4" />
                          Tahrirlash (Band)
                        </Button>
                        <Button size="sm" className="flex-1" disabled>
                          <Receipt className="mr-1 h-4 w-4" />
                          Chek chiqarish (Band)
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </>
              )}

            {activeOrders.length === 0 && (
              <div className="flex h-[calc(100vh-200px)] items-center justify-center p-4">
                <div className="text-center">
                  <Coffee className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">Faol buyurtmalar yo'q</p>
                  <p className="mb-4 text-muted-foreground">Hozircha hech qanday faol buyurtma yo'q</p>
                  <Button onClick={() => setActiveTab("tables")}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Yangi buyurtma
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // Render History Screen
  const renderHistoryScreen = () => {
    if (loadingHistory) {
      return (
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Tarix yuklanmoqda...</p>
        </div>
      )
    }

    if (deliveredOrders.length === 0) {
      return (
        <div className="flex h-[calc(100vh-120px)] items-center justify-center p-4">
          <div className="text-center">
            <History className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Buyurtmalar tarixi bo'sh</p>
            <p className="text-muted-foreground">Hozircha yetkazilgan buyurtmalar yo'q</p>
          </div>
        </div>
      )
    }

    return (
      <div className="p-2">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Buyurtmalar tarixi</h1>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="space-y-4 pb-20">
            {deliveredOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500">Yetkazildi</Badge>
                      <span className="font-bold">
                        {order.seatingType} #{getTableNumber(order)}
                      </span>
                    </div>
                    <span className="text-sm">{order.orderDate || formatDate(order.createdAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-1">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.name}
                          {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                        </span>
                        <span>{calculateItemTotal(item)} so'm</span>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Jami:</span>
                    <span>{getOrderTotal(order)} so'm</span>
                  </div>
                </CardContent>
                {/* Removed "Chekni ko'rish" button from history tab */}
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // Render bottom navigation
  const renderBottomNav = () => {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background shadow-lg">
        <Button
          variant={activeTab === "tables" ? "default" : "ghost"}
          size="sm"
          className="flex h-full w-full flex-col items-center justify-center rounded-none group"
          onClick={() => setActiveTab("tables")}
        >
          <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="mt-1 text-xs group-hover:font-medium">Stollar</span>
        </Button>
        <Button
          variant={activeTab === "menu" ? "default" : "ghost"}
          size="sm"
          className="flex h-full w-full flex-col items-center justify-center rounded-none group"
          onClick={() => {
            if (selectedSeatingItem) {
              setActiveTab("menu")
            } else {
              toast({
                title: "Xatolik",
                description: "Avval stol tanlang",
                variant: "destructive",
              })
            }
          }}
        >
          <Utensils className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="mt-1 text-xs group-hover:font-medium">Menyu</span>
        </Button>
        <Button
          variant={activeTab === "cart" ? "default" : "ghost"}
          size="sm"
          className="flex h-full w-full flex-col items-center justify-center rounded-none relative group"
          onClick={() => {
            if (selectedSeatingItem) {
              setActiveTab("cart")
            } else {
              toast({
                title: "Xatolik",
                description: "Avval stol tanlang",
                variant: "destructive",
              })
            }
          }}
          ref={cartButtonRef}
        >
          <ShoppingCart className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="mt-1 text-xs group-hover:font-medium">Savat</span>
          <AnimatePresence>
            {cartTotalItems > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: cartBadgeAnimation ? 1.2 : 1,
                  opacity: 1,
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white"
              >
                {cartTotalItems}
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
        <Button
          variant={activeTab === "orders" ? "default" : "ghost"}
          size="sm"
          className="flex h-full w-full flex-col items-center justify-center rounded-none relative group"
          onClick={() => setActiveTab("orders")}
        >
          <Clock className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="mt-1 text-xs group-hover:font-medium">Buyurtmalar</span>
          {activeOrders.length > 0 && (
            <Badge className="absolute -right-1 top-1 bg-red-500">{activeOrders.length}</Badge>
          )}
        </Button>
        <Button
          variant={activeTab === "history" ? "default" : "ghost"}
          size="sm"
          className="flex h-full w-full flex-col items-center justify-center rounded-none group"
          onClick={() => setActiveTab("history")}
        >
          <History className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="mt-1 text-xs group-hover:font-medium">Tarix</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-background p-3 shadow-sm">
        <h1 className="text-lg font-bold">Ofitsiant paneli</h1>
        <Button variant="destructive" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LogOut className="mr-1 h-4 w-4" />}
          Chiqish
        </Button>
      </div>

      {activeTab === "tables" && renderTablesScreen()}
      {activeTab === "menu" && renderMenuScreen()}
      {activeTab === "cart" && renderCartScreen()}
      {activeTab === "orders" && renderOrdersScreen()}
      {activeTab === "history" && renderHistoryScreen()}

      {renderBottomNav()}

      {/* Quantity Edit Dialog */}
      <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Miqdorni o'zgartirish</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              ref={quantityInputRef}
              type="number"
              min="1"
              value={currentEditItem?.quantity || 1}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value)
                if (!isNaN(value) && value > 0) {
                  setCurrentEditItem((prev) => (prev ? { ...prev, quantity: value } : null))
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveQuantity()
                }
              }}
              className="text-center text-lg"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuantityDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleSaveQuantity}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Confirmation Dialog */}
      <AlertDialog open={isPrintConfirmOpen} onOpenChange={setIsPrintConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chek chiqarishni tasdiqlaysizmi?</AlertDialogTitle>
            <AlertDialogDescription>
              Buyurtma to'langan deb belgilanadi va chek printerga yuboriladi. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsPrintConfirmOpen(false)}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handlePrintReceipt}>Tasdiqlash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

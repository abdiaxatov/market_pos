"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, Loader2, Home, Sofa, Armchair } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { collection, query, onSnapshot, where, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Define useAuth outside the try-catch block
let useAuth: any = () => ({ user: null })

try {
  // Try to dynamically import the useAuth hook
  const adminAuthProvider = require("@/components/admin/admin-auth-provider")
  if (adminAuthProvider && typeof adminAuthProvider.useAuth === "function") {
    useAuth = adminAuthProvider.useAuth
  }
} catch (error) {
  console.log("Admin auth provider not available in this context")
}

interface TableSelectorProps {
  selectedTable: number | null
  selectedRoom: number | null
  onSelectTable: (
    tableNumber: number | null,
    roomNumber: number | null,
    type?: string | null,
    waiterId?: string | null,
    userRecentlyUsed?: boolean,
    waiterName?: string | null,
  ) => void
  hasError?: boolean
}

type SeatingItem = {
  id: string
  number: number
  seats: number
  status: "available" | "occupied" | "reserved"
  roomId?: string
  type: string
  waiterId?: string
  waiterName?: string
  userRecentlyUsed?: boolean
}

export function TableSelector({ selectedTable, selectedRoom, onSelectTable, hasError = false }: TableSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [seatingItems, setSeatingItems] = useState<SeatingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("stol")
  const [viewingRoom, setViewingRoom] = useState<SeatingItem | null>(null)
  const [tablesInSelectedRoom, setTablesInSelectedRoom] = useState<SeatingItem[]>([])
  const { toast } = useToast()
  const auth = useAuth()
  const user = auth?.user
  const [seatingTypes, setSeatingTypes] = useState<string[]>([])
  const [selectedSeatingType, setSelectedSeatingType] = useState<string | null>(null)
  // First, add a state for storing waiter information
  const [seatingWaiters, setSeatingWaiters] = useState<Record<string, { id: string; name: string }>>({})
  const [waiterNames, setWaiterNames] = useState<Record<string, string>>({})

  // Add this useEffect to fetch all waiter names
  useEffect(() => {
    const fetchWaiterNames = async () => {
      try {
        const waitersQuery = query(collection(db, "users"), where("role", "==", "waiter"))
        const snapshot = await getDocs(waitersQuery)

        const names: Record<string, string> = {}

        snapshot.forEach((doc) => {
          const data = doc.data()
          if (data.name) {
            names[doc.id] = data.name
          }
        })

        setWaiterNames(names)
      } catch (error) {
        console.error("Error fetching waiter names:", error)
      }
    }

    fetchWaiterNames()
  }, [])

  // Add this useEffect to fetch waiter information for all seating items
  useEffect(() => {
    const fetchSeatingWaiters = async () => {
      try {
        const seatingItemsQuery = query(collection(db, "seatingItems"))
        const snapshot = await getDocs(seatingItemsQuery)

        const waiterData: Record<string, { id: string; name: string }> = {}

        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data()
          if (data.waiterId) {
            // Create a key using type and number
            const key = `${data.type}-${data.number}`

            // Get waiter name from our cached names or fetch it
            let waiterName = waiterNames[data.waiterId]

            if (!waiterName) {
              try {
                const waiterDoc = await getDoc(doc(db, "users", data.waiterId))
                if (waiterDoc.exists()) {
                  const waiterInfo = waiterDoc.data()
                  waiterName = waiterInfo.name || "Belgilanmagan"
                } else {
                  waiterName = "Belgilanmagan"
                }
              } catch (error) {
                console.error("Error getting waiter name:", error)
                waiterName = "Belgilanmagan"
              }
            }

            waiterData[key] = {
              id: data.waiterId,
              name: waiterName,
            }
          }
        }

        setSeatingWaiters(waiterData)
      } catch (error) {
        console.error("Error fetching seating waiters:", error)
      }
    }

    if (Object.keys(waiterNames).length > 0) {
      fetchSeatingWaiters()
    }
  }, [waiterNames])

  // Now update the handleSelectItem function to pass the waiterId and waiterName
  const handleSelectItem = (item: SeatingItem) => {
    const isRoom = item.type.toLowerCase() === "xona"

    // Get the waiterId and waiterName for this seating item
    let waiterId = item.waiterId || null
    let waiterName = item.waiterName || null

    // If this is a user-recently-used item, check if we have waiter info in localStorage
    if (item.userRecentlyUsed) {
      const lastOrderInfoStr = localStorage.getItem("lastOrderInfo")
      if (lastOrderInfoStr) {
        const lastOrderInfo = JSON.parse(lastOrderInfoStr)
        if (lastOrderInfo.waiterId) {
          waiterId = lastOrderInfo.waiterId
          waiterName = lastOrderInfo.waiterName || waiterNames[waiterId] || null
        }
      }
    } else {
      // For available items, check if we have waiter info in our state
      const key = `${item.type}-${item.number}`
      const waiterInfo = seatingWaiters[key]
      if (waiterInfo) {
        waiterId = waiterInfo.id
        waiterName = waiterInfo.name
      }
    }

    // If we have a waiterId but no waiterName, try to get it from our cached names
    if (waiterId && !waiterName && waiterNames[waiterId]) {
      waiterName = waiterNames[waiterId]
    }

    // If we still don't have a waiterName, try to get it from Firestore
    if (waiterId && !waiterName) {
      const waiterDocRef = doc(db, "users", waiterId)
      getDoc(waiterDocRef)
        .then((waiterDocSnapshot) => {
          if (waiterDocSnapshot.exists()) {
            waiterName = waiterDocSnapshot.data().name

            // Save to localStorage for future reference
            const lastOrderInfoStr = localStorage.getItem("lastOrderInfo")
            if (lastOrderInfoStr) {
              const lastOrderInfo = JSON.parse(lastOrderInfoStr)
              lastOrderInfo.waiterName = waiterName
              localStorage.setItem("lastOrderInfo", JSON.stringify(lastOrderInfo))
            }

            // Now call onSelectTable with all the info
            if (isRoom) {
              onSelectTable(null, item.number, item.type, waiterId, item.userRecentlyUsed, waiterName)
            } else {
              onSelectTable(item.number, null, item.type, waiterId, item.userRecentlyUsed, waiterName)
            }
          }
        })
        .catch((error) => {
          console.error("Error getting waiter name:", error)
          // Still call onSelectTable even if there's an error
          if (isRoom) {
            onSelectTable(null, item.number, item.type, waiterId, item.userRecentlyUsed, waiterName)
          } else {
            onSelectTable(item.number, null, item.type, waiterId, item.userRecentlyUsed, waiterName)
          }
        })
    } else {
      // We already have all the info, so call onSelectTable directly
      if (isRoom) {
        onSelectTable(null, item.number, item.type, waiterId, item.userRecentlyUsed, waiterName)
      } else {
        onSelectTable(item.number, null, item.type, waiterId, item.userRecentlyUsed, waiterName)
      }
    }

    console.log(
      "Selected item:",
      item.number,
      item.type,
      "Waiter:",
      waiterId,
      waiterName,
      "Recently used:",
      item.userRecentlyUsed,
    )

    setIsOpen(false)
    setViewingRoom(null)
  }

  // Fix the useEffect to prevent automatic selection from changing
  useEffect(() => {
    // Initialize with empty functions to avoid undefined errors
    let itemsUnsubscribe = () => {}
    let typesUnsubscribe = () => {}

    const fetchData = async () => {
      try {
        // Get the user's previous orders from localStorage
        const myOrders = JSON.parse(localStorage.getItem("myOrders") || "[]")
        // Ensure we have string IDs, not objects
        const myOrderIds = myOrders.map((id) => (typeof id === "object" && id.id ? id.id : id))
        const lastOrderInfoStr = localStorage.getItem("lastOrderInfo")
        let lastSelectedTable = null
        let lastSelectedRoom = null
        let lastSelectedType = null
        let lastWaiterId = null
        let lastWaiterName = null

        // Agar oxirgi buyurtma ma'lumotlari saqlangan bo'lsa
        if (lastOrderInfoStr) {
          const lastOrderInfo = JSON.parse(lastOrderInfoStr)
          if (lastOrderInfo.tableNumber) {
            lastSelectedTable = lastOrderInfo.tableNumber
            lastSelectedType = lastOrderInfo.seatingType || "Stol"
            lastWaiterId = lastOrderInfo.waiterId || null
            lastWaiterName = lastOrderInfo.waiterName || null

            // If we have waiterId but no waiterName, try to get it from our cached names
            if (lastWaiterId && !lastWaiterName && waiterNames[lastWaiterId]) {
              lastWaiterName = waiterNames[lastWaiterId]
            }
          } else if (lastOrderInfo.roomNumber) {
            lastSelectedRoom = lastOrderInfo.roomNumber
            lastSelectedType = "Xona"
            lastWaiterId = lastOrderInfo.waiterId || null
            lastWaiterName = lastOrderInfo.waiterName || null

            // If we have waiterId but no waiterName, try to get it from our cached names
            if (lastWaiterId && !lastWaiterName && waiterNames[lastWaiterId]) {
              lastWaiterName = waiterNames[lastWaiterId]
            }
          }
        }

        // Fetch previous orders to get tables/rooms the user has ordered from
        const userPreviousItems = new Map<string, Set<number>>()

        if (myOrders.length > 0) {
          // Fetch order details to get table/room numbers
          for (const orderId of myOrderIds) {
            try {
              const orderDoc = await getDoc(doc(db, "orders", orderId))
              if (orderDoc.exists()) {
                const orderData = orderDoc.data()
                if (orderData.tableNumber) {
                  if (!userPreviousItems.has("table")) {
                    userPreviousItems.set("table", new Set())
                  }
                  userPreviousItems.get("table")?.add(orderData.tableNumber)

                  // Save waiter info if available
                  if (orderData.waiterId && orderData.waiterName) {
                    // Update lastOrderInfo with the latest waiter info
                    if (lastOrderInfoStr) {
                      const lastOrderInfo = JSON.parse(lastOrderInfoStr)
                      if (lastOrderInfo.tableNumber === orderData.tableNumber) {
                        lastOrderInfo.waiterId = orderData.waiterId
                        lastOrderInfo.waiterName = orderData.waiterName
                        localStorage.setItem("lastOrderInfo", JSON.stringify(lastOrderInfo))
                      }
                    }
                  }
                }
                if (orderData.roomNumber) {
                  if (!userPreviousItems.has("xona")) {
                    userPreviousItems.set("xona", new Set())
                  }
                  userPreviousItems.get("xona")?.add(orderData.roomNumber)

                  // Save waiter info if available
                  if (orderData.waiterId && orderData.waiterName) {
                    // Update lastOrderInfo with the latest waiter info
                    if (lastOrderInfoStr) {
                      const lastOrderInfo = JSON.parse(lastOrderInfoStr)
                      if (lastOrderInfo.roomNumber === orderData.roomNumber) {
                        lastOrderInfo.waiterId = orderData.waiterId
                        lastOrderInfo.waiterName = orderData.waiterName
                        localStorage.setItem("lastOrderInfo", JSON.stringify(lastOrderInfo))
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error("Error fetching order:", error)
            }
          }
        }

        // Only set automatic selection if no selection has been made yet
        if (!selectedTable && !selectedRoom) {
          if (lastSelectedTable) {
            onSelectTable(lastSelectedTable, null, lastSelectedType, lastWaiterId, true, lastWaiterName)
            setSelectedSeatingType(lastSelectedType)
          } else if (lastSelectedRoom) {
            onSelectTable(null, lastSelectedRoom, "Xona", lastWaiterId, true, lastWaiterName)
            setSelectedSeatingType("Xona")
          }
        }

        // Fetch seating types
        typesUnsubscribe = onSnapshot(
          collection(db, "seatingTypes"),
          (snapshot) => {
            const types = new Set<string>()
            snapshot.forEach((doc) => {
              const typeData = doc.data()
              if (typeData.name) {
                types.add(typeData.name)
              }
            })

            // If no types are found, add default types
            if (types.size === 0) {
              types.add("Stol")
              types.add("Xona")
            }

            const typesArray = Array.from(types)
            setSeatingTypes(typesArray)

            // Set default active tab if not already set
            if (!activeTab || !typesArray.includes(activeTab.toLowerCase())) {
              setActiveTab(typesArray[0].toLowerCase())
            }
          },
          (error) => {
            console.error("Error fetching seating types:", error)
          },
        )

        // Fetch seating items
        let itemsQuery

        if (user && user.role === "waiter") {
          // If user is a waiter, only show items assigned to them
          itemsQuery = query(
            collection(db, "seatingItems"),
            where("status", "==", "available"),
            where("waiterId", "==", user.id),
          )
        } else {
          // For admin, chef, and customers, show all available items
          itemsQuery = query(collection(db, "seatingItems"), where("status", "==", "available"))
        }

        itemsUnsubscribe = onSnapshot(
          itemsQuery,
          (snapshot) => {
            const itemsData: SeatingItem[] = []
            snapshot.forEach((doc) => {
              const data = doc.data()

              // Add waiter name if we have it in our cache
              let waiterName = null
              if (data.waiterId && waiterNames[data.waiterId]) {
                waiterName = waiterNames[data.waiterId]
              }

              itemsData.push({
                id: doc.id,
                ...data,
                waiterName,
              } as SeatingItem)
            })

            // Also fetch occupied items that the user has previously ordered from
            const fetchOccupiedItems = async () => {
              try {
                const occupiedItemsQuery = query(collection(db, "seatingItems"), where("status", "==", "occupied"))
                const occupiedItemsSnapshot = await getDocs(occupiedItemsQuery)

                // Track items we've already added to prevent duplicates
                const addedItems = new Set()

                occupiedItemsSnapshot.forEach((doc) => {
                  const itemData = doc.data() as SeatingItem
                  // Fix: Add null check for type property
                  const itemType = (itemData.type || "").toLowerCase()
                  const itemNumber = itemData.number

                  // Create a unique key for this item
                  const itemKey = `${itemType}-${itemNumber}`

                  // Check if this is a previously used item
                  let shouldAdd = false

                  if (itemType === "xona" && userPreviousItems.has("xona")) {
                    shouldAdd = userPreviousItems.get("xona")?.has(itemNumber) || false
                  } else if (userPreviousItems.has("table")) {
                    shouldAdd = userPreviousItems.get("table")?.has(itemNumber) || false
                  }

                  // Only add if it's a user's previous item AND we haven't added it yet
                  if (shouldAdd && !addedItems.has(itemKey)) {
                    // Add waiter name if we have it in our cache
                    let waiterName = itemData.waiterName || null
                    if (itemData.waiterId && waiterNames[itemData.waiterId]) {
                      waiterName = waiterNames[itemData.waiterId]
                    }

                    // Mark this item as a user's recently used item
                    itemsData.push({
                      id: doc.id,
                      ...itemData,
                      userRecentlyUsed: true,
                      waiterName,
                    })

                    // Mark this item as added
                    addedItems.add(itemKey)
                  }
                })

                // Sort items by type and number
                itemsData.sort((a, b) => {
                  if (a.type !== b.type) {
                    return (a.type || "").localeCompare(b.type || "")
                  }
                  return a.number - b.number
                })

                setSeatingItems(itemsData)
                setIsLoading(false)
              } catch (error) {
                console.error("Error fetching occupied items:", error)
                setIsLoading(false)
              }
            }

            if (userPreviousItems.size > 0) {
              fetchOccupiedItems()
            } else {
              // Sort items by type and number
              itemsData.sort((a, b) => {
                if (a.type !== b.type) {
                  return (a.type || "").localeCompare(b.type || "")
                }
                return a.number - b.number
              })

              setSeatingItems(itemsData)
              setIsLoading(false)
            }

            // Modify the fetchUserSpecificOccupiedItems function to prevent duplicate entries

            // Replace the fetchUserSpecificOccupiedItems function with this improved version:
            const fetchUserSpecificOccupiedItems = async () => {
              try {
                // Get user's "signature" - we'll use this to track which tables they've used
                let userSignature = localStorage.getItem("userSignature")
                if (!userSignature) {
                  userSignature = Math.random().toString(36).substring(2, 15)
                  localStorage.setItem("userSignature", userSignature)
                }

                // First, fetch occupied items
                const occupiedItemsQuery = query(collection(db, "seatingItems"), where("status", "==", "occupied"))
                const occupiedItemsSnapshot = await getDocs(occupiedItemsQuery)

                // Get the last order info from localStorage
                const lastOrderInfoStr = localStorage.getItem("lastOrderInfo")
                if (lastOrderInfoStr) {
                  const lastOrderInfo = JSON.parse(lastOrderInfoStr)
                  const lastOrderTime = new Date(lastOrderInfo.timestamp || Date.now())
                  const currentTime = new Date()

                  // Calculate the difference in minutes
                  const diffInMinutes = (currentTime.getTime() - lastOrderTime.getTime()) / (1000 * 60)

                  // Track items we've already added to prevent duplicates
                  const addedItems = new Set()

                  // If the last order was within 30 minutes
                  if (diffInMinutes <= 30) {
                    // Add occupied items that match the user's recent order
                    for (const docSnapshot of occupiedItemsSnapshot.docs) {
                      const itemData = docSnapshot.data() as SeatingItem
                      const itemType = (itemData.type || "").toLowerCase()
                      const itemNumber = itemData.number

                      // Create a unique key for this item
                      const itemKey = `${itemType}-${itemNumber}`

                      // Check if this item matches the last order and hasn't been added yet
                      let shouldAdd = false
                      if (itemType === "xona" && lastOrderInfo.roomNumber === itemNumber && !addedItems.has(itemKey)) {
                        shouldAdd = true
                      } else if (
                        itemType !== "xona" &&
                        lastOrderInfo.tableNumber === itemNumber &&
                        !addedItems.has(itemKey)
                      ) {
                        shouldAdd = true
                      }

                      if (shouldAdd) {
                        // Generate a unique ID for this item to avoid duplicate keys
                        const uniqueId = `${docSnapshot.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

                        // Get waiter name from lastOrderInfo or from our cache
                        let waiterName = lastOrderInfo.waiterName || null
                        const waiterId = lastOrderInfo.waiterId || itemData.waiterId || null

                        if (!waiterName && waiterId && waiterNames[waiterId]) {
                          waiterName = waiterNames[waiterId]
                        }

                        // Mark this as a recently used item by this user
                        // Also add waiter information if available
                        itemsData.push({
                          id: uniqueId, // Use the unique ID to avoid duplicate keys
                          ...itemData,
                          userRecentlyUsed: true,
                          waiterId: waiterId,
                          waiterName: waiterName,
                        })

                        // Mark this item as added
                        addedItems.add(itemKey)
                      }
                    }
                  }
                }
              } catch (error) {
                console.error("Error fetching user-specific occupied items:", error)
              }
            }

            // Call this function after setting up the basic listeners
            if (!user || user.role !== "waiter") {
              fetchUserSpecificOccupiedItems()
            }
          },
          (error) => {
            console.error("Error fetching seating items:", error)
            toast({
              title: "Xatolik",
              description: "Joy elementlarini yuklashda xatolik yuz berdi",
              variant: "destructive",
            })
            setIsLoading(false)
          },
        )
      } catch (error) {
        console.error("Error setting up listeners:", error)
        setIsLoading(false)
      }
    }

    fetchData()

    // Clean up function
    return () => {
      try {
        if (typeof itemsUnsubscribe === "function") {
          itemsUnsubscribe()
        }
        if (typeof typesUnsubscribe === "function") {
          typesUnsubscribe()
        }
      } catch (error) {
        console.error("Error unsubscribing:", error)
      }
    }
  }, [toast, user, auth, activeTab, selectedTable, selectedRoom, onSelectTable, waiterNames])

  // When a room is selected for viewing, fetch tables in that room
  useEffect(() => {
    if (!viewingRoom) {
      setTablesInSelectedRoom([])
      return
    }

    const fetchTablesInRoom = async () => {
      try {
        const tablesInRoomQuery = query(
          collection(db, "seatingItems"),
          where("roomId", "==", viewingRoom.id),
          where("status", "==", "available"),
        )

        const tablesSnapshot = await getDocs(tablesInRoomQuery)
        const tablesData: SeatingItem[] = []

        tablesSnapshot.forEach((doc) => {
          const data = doc.data()

          // Add waiter name if we have it in our cache
          let waiterName = null
          if (data.waiterId && waiterNames[data.waiterId]) {
            waiterName = waiterNames[data.waiterId]
          }

          tablesData.push({
            id: doc.id,
            ...data,
            waiterName,
          } as SeatingItem)
        })

        // Sort tables by number
        tablesData.sort((a, b) => a.number - b.number)
        setTablesInSelectedRoom(tablesData)
      } catch (error) {
        console.error("Error fetching tables in room:", error)
        toast({
          title: "Xatolik",
          description: "Xonadagi stollarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    }

    if (viewingRoom) {
      fetchTablesInRoom()
    }
  }, [viewingRoom, toast, waiterNames])

  const handleViewRoom = (room: SeatingItem) => {
    setViewingRoom(room)
  }

  const handleBackToRooms = () => {
    setViewingRoom(null)
  }

  // Get icon for seating type
  const getTypeIcon = (type: string) => {
    switch ((type || "").toLowerCase()) {
      case "stol":
        return <Table className="h-4 w-4" />
      case "xona":
        return <Home className="h-4 w-4" />
      case "divan":
        return <Sofa className="h-4 w-4" />
      case "kreslo":
        return <Armchair className="h-4 w-4" />
      default:
        return <Table className="h-4 w-4" />
    }
  }

  // Get the selected item info for display
  const getSelectionDisplay = () => {
    if (selectedRoom) {
      const room = seatingItems.find(
        (item) => item.number === selectedRoom && (item.type || "").toLowerCase() === "xona",
      )
      return room ? `${room.number}-${room.type} (${room.seats} kishilik)` : `${selectedRoom}-Xona`
    }

    if (selectedTable) {
      const table = seatingItems.find((item) => item.number === selectedTable && item.type === selectedSeatingType)
      return table
        ? `${table.number}-${table.type} (${table.seats} kishilik)`
        : `${selectedTable}-${selectedSeatingType || "Joy"}`
    }

    return "Joy tanlang"
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`w-full justify-start ${hasError ? "border-destructive" : ""}`}>
          {selectedRoom ? (
            <Home className="mr-2 h-4 w-4" />
          ) : selectedSeatingType ? (
            getTypeIcon(selectedSeatingType)
          ) : (
            <Table className="mr-2 h-4 w-4" />
          )}
          {getSelectionDisplay()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {viewingRoom ? `${viewingRoom.number}-${viewingRoom.type} (${viewingRoom.seats} kishilik)` : "Joy tanlash"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewingRoom ? (
          // Show tables in the selected room
          <div>
            <Button variant="ghost" onClick={handleBackToRooms} className="mb-4">
              ← Orqaga qaytish
            </Button>

            <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {tablesInSelectedRoom.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground">Bu xonada bo'sh stollar topilmadi</p>
                </div>
              ) : (
                tablesInSelectedRoom.map((table) => (
                  <Card
                    key={table.id}
                    className="cursor-pointer transition-all hover:bg-muted"
                    onClick={() => handleSelectItem(table)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(table.type)}
                            <span className="text-lg font-medium">
                              {table.number}-{table.type}
                            </span>
                          </div>
                          <Badge variant="outline">{table.seats} kishilik</Badge>
                        </div>
                        {table.waiterId && table.waiterName && (
                          <div className="mt-1 text-xs text-muted-foreground">Ofitsiant: {table.waiterName}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList
              className="mb-4 grid w-full"
              style={{ gridTemplateColumns: `repeat(${seatingTypes.length}, 1fr)` }}
            >
              {seatingTypes.map((type) => (
                <TabsTrigger key={type} value={type.toLowerCase()}>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(type)}
                    {type}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {seatingTypes.map((type) => {
              const typeItems = seatingItems.filter((item) => (item.type || "").toLowerCase() === type.toLowerCase())

              return (
                <TabsContent key={type} value={type.toLowerCase()}>
                  <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                    {typeItems.length === 0 ? (
                      <div className="col-span-full rounded-lg border border-dashed p-8 text-center">
                        <p className="text-muted-foreground">Bo'sh {type.toLowerCase()}lar topilmadi</p>
                      </div>
                    ) : (
                      typeItems.map((item) => (
                        <Card
                          key={item.id}
                          className={`cursor-pointer transition-all hover:bg-muted ${
                            item.status === "occupied" && item.userRecentlyUsed
                              ? "border-green-500 bg-green-50"
                              : item.status === "occupied"
                                ? "border-amber-500"
                                : ""
                          }`}
                          onClick={() => handleSelectItem(item)}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getTypeIcon(item.type)}
                                  <span className="text-lg font-medium">
                                    {item.number}-{item.type}
                                  </span>
                                </div>
                                <Badge variant="outline">{item.seats} kishilik</Badge>
                              </div>
                              {item.waiterId && item.waiterName && (
                                <div className="mt-1 text-xs text-muted-foreground">Ofitsiant: {item.waiterName}</div>
                              )}
                              {item.status === "occupied" && item.userRecentlyUsed && (
                                <Badge className="mt-2 w-fit bg-green-100 text-green-800">Sizning stolingiz</Badge>
                              )}
                              {item.status === "occupied" && !item.userRecentlyUsed && (
                                <Badge className="mt-2 w-fit bg-amber-100 text-amber-800">Band</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

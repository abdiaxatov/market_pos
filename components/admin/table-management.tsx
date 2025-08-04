"use client"

import { useState, useEffect, useMemo } from "react"
import {
  collection,
  doc,
  deleteDoc,
  writeBatch,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  Trash2,
  Plus,
  LayoutGrid,
  Home,
  RefreshCw,
  Search,
  Download,
  TableIcon,
  Sofa,
  Armchair,
  X,
  Building2,
  Grid,
  List,
  MoreHorizontal,
  Edit,
  Loader2,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Define types for seating items
type SeatingItem = {
  id: string
  number: number
  seats: number
  status: "available" | "occupied" | "reserved"
  roomId?: string | null
  createdAt?: any
  updatedAt?: any
  waiterId?: string | null
  type: string // Type of seating (Stol, Xona, Divan, Kreslo, etc.)
  floor?: number // Add floor information
}

// Define type for seating type configuration
type SeatingType = {
  id: string
  name: string
  defaultCapacity: number
  count: number
  icon?: string
}

// Define type for floor configuration
type Floor = {
  id: string
  number: number
  name: string
  description?: string
  count: number
}

type Order = {
  id: string
  orderType: "table" | "delivery"
  tableNumber?: number | null
  roomNumber?: number | null
  status: string
  createdAt: any
  items: any[]
  total: number
  seatingType?: string
}

export function TableManagement() {
  const [seatingItems, setSeatingItems] = useState<SeatingItem[]>([])
  const [seatingTypes, setSeatingTypes] = useState<SeatingType[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("table-view")
  const [activeTypeTab, setActiveTypeTab] = useState<string | null>(null)
  const [activeFloorTab, setActiveFloorTab] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Seating item state
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isEditingItem, setIsEditingItem] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SeatingItem | null>(null)
  const [newItemNumber, setNewItemNumber] = useState<number>(1)
  const [newItemSeats, setNewItemSeats] = useState<number>(4)
  const [newItemType, setNewItemType] = useState<string>("Stol")
  const [newItemStatus, setNewItemStatus] = useState<"available" | "occupied" | "reserved">("available")
  const [newItemFloor, setNewItemFloor] = useState<number>(1)
  const [showOccupiedItems, setShowOccupiedItems] = useState(true)
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null)
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | null>(null)

  // Batch item creation
  const [isBatchAddingItems, setIsBatchAddingItems] = useState(false)
  const [batchItemCount, setBatchItemCount] = useState<number>(10)
  const [batchItemStartNumber, setBatchItemStartNumber] = useState<number>(1)
  const [batchItemSeats, setBatchItemSeats] = useState<number>(4)
  const [batchItemType, setBatchItemType] = useState<string>("Stol")
  const [batchItemFloor, setBatchItemFloor] = useState<number>(1)

  // Seating type management
  const [isAddingType, setIsAddingType] = useState(false)
  const [isEditingType, setIsEditingType] = useState(false)
  const [selectedType, setSelectedType] = useState<SeatingType | null>(null)
  const [newTypeName, setNewTypeName] = useState<string>("")
  const [newTypeCapacity, setNewTypeCapacity] = useState<number>(4)
  const [newTypeCount, setNewTypeCount] = useState<number>(0)

  // Floor management
  const [isAddingFloor, setIsAddingFloor] = useState(false)
  const [isEditingFloor, setIsEditingFloor] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null)
  const [newFloorNumber, setNewFloorNumber] = useState<number>(1)
  const [newFloorName, setNewFloorName] = useState<string>("")
  const [newFloorDescription, setNewFloorDescription] = useState<string>("")

  // Search and filter
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [capacityFilter, setCapacityFilter] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Add a new state for waiters list
  const [waiters, setWaiters] = useState<any[]>([])
  const [newItemWaiterId, setNewItemWaiterId] = useState<string | null>(null)
  const [batchItemWaiterId, setBatchItemWaiterId] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "",
    }).format(amount)
  }

  // Fetch seating items, types, floors, and active orders
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Seating items listener
        const itemsUnsubscribe = onSnapshot(
          collection(db, "seatingItems"),
          (snapshot) => {
            const itemsData: SeatingItem[] = []
            snapshot.forEach((doc) => {
              itemsData.push({ id: doc.id, ...doc.data() } as SeatingItem)
            })

            // Sort items by floor, type and number
            itemsData.sort((a, b) => {
              if ((a.floor || 1) !== (b.floor || 1)) {
                return (a.floor || 1) - (b.floor || 1)
              }
              if (a.type !== b.type) {
                return a.type.localeCompare(b.type)
              }
              return a.number - b.number
            })

            setSeatingItems(itemsData)

            // Set next item number suggestion
            if (itemsData.length > 0) {
              const maxItemNumber = Math.max(...itemsData.map((t) => t.number))
              setNewItemNumber(maxItemNumber + 1)
              setBatchItemStartNumber(maxItemNumber + 1)
            }
          },
          (error) => {
            console.error("Error fetching seating items:", error)
            toast({
              title: "Xatolik",
              description: "Joy elementlarini yuklashda xatolik yuz berdi",
              variant: "destructive",
            })
          },
        )

        // Seating types listener
        const typesUnsubscribe = onSnapshot(
          collection(db, "seatingTypes"),
          (snapshot) => {
            const typesData: SeatingType[] = []
            snapshot.forEach((doc) => {
              typesData.push({ id: doc.id, ...doc.data() } as SeatingType)
            })

            // Sort types alphabetically
            typesData.sort((a, b) => a.name.localeCompare(b.name))
            setSeatingTypes(typesData)

            // Set default item type if not set
            if (typesData.length > 0 && !newItemType) {
              setNewItemType(typesData[0].name)
              setBatchItemType(typesData[0].name)
            }

            // Set active type tab if not set
            if (!activeTypeTab && typesData.length > 0) {
              setActiveTypeTab(typesData[0].name)
            }

            // If no types exist, create default types
            if (typesData.length === 0) {
              createDefaultSeatingTypes()
            }
          },
          (error) => {
            console.error("Error fetching seating types:", error)
            toast({
              title: "Xatolik",
              description: "Joy turlarini yuklashda xatolik yuz berdi",
              variant: "destructive",
            })
          },
        )

        // Floors listener
        const floorsUnsubscribe = onSnapshot(
          collection(db, "floors"),
          (snapshot) => {
            const floorsData: Floor[] = []
            snapshot.forEach((doc) => {
              floorsData.push({ id: doc.id, ...doc.data() } as Floor)
            })

            // Sort floors by number
            floorsData.sort((a, b) => a.number - b.number)
            setFloors(floorsData)

            // Set active floor tab if not set
            if (!activeFloorTab && floorsData.length > 0) {
              setActiveFloorTab(floorsData[0].number)
            }

            // If no floors exist, create default floor
            if (floorsData.length === 0) {
              createDefaultFloor()
            }

            setIsLoading(false)
          },
          (error) => {
            console.error("Error fetching floors:", error)
            toast({
              title: "Xatolik",
              description: "Qavatlarni yuklashda xatolik yuz berdi",
              variant: "destructive",
            })
            setIsLoading(false)
          },
        )

        // Inside the fetchData function, after the typesUnsubscribe setup
        const waitersUnsubscribe = onSnapshot(
          query(collection(db, "users"), where("role", "==", "waiter")),
          (snapshot) => {
            const waitersData: any[] = []
            snapshot.forEach((doc) => {
              waitersData.push({ id: doc.id, ...doc.data() })
            })
            setWaiters(waitersData)
          },
          (error) => {
            console.error("Error fetching waiters:", error)
          },
        )

        // Active orders listener (pending, preparing, ready)
        const ordersUnsubscribe = onSnapshot(
          query(collection(db, "orders"), where("status", "in", ["pending", "preparing", "ready"])),
          (snapshot) => {
            const ordersData: Order[] = []
            snapshot.forEach((doc) => {
              ordersData.push({ id: doc.id, ...doc.data() } as Order)
            })
            setActiveOrders(ordersData)
          },
          (error) => {
            console.error("Error fetching active orders:", error)
          },
        )

        return () => {
          itemsUnsubscribe()
          typesUnsubscribe()
          floorsUnsubscribe()
          if (typeof waitersUnsubscribe === "function") {
            waitersUnsubscribe()
          }
          ordersUnsubscribe()
        }
      } catch (error) {
        console.error("Error setting up listeners:", error)
        setIsLoading(false)
      }
    }

    fetchData()
  }, [toast, activeTypeTab, activeFloorTab, newItemType])

  // Create default seating types if none exist
  const createDefaultSeatingTypes = async () => {
    try {
      // First check if there are any existing types to avoid duplication
      const typesSnapshot = await getDocs(collection(db, "seatingTypes"))
      if (!typesSnapshot.empty) {
        console.log("Seating types already exist, skipping default creation")
        return
      }

      const batch = writeBatch(db)

      const defaultTypes = [
        { name: "Stol", defaultCapacity: 4, count: 0 },
        { name: "Xona", defaultCapacity: 10, count: 0 },
        { name: "Divan", defaultCapacity: 3, count: 0 },
        { name: "Kreslo", defaultCapacity: 1, count: 0 },
      ]

      for (const type of defaultTypes) {
        const typeRef = doc(collection(db, "seatingTypes"))
        batch.set(typeRef, {
          ...type,
          createdAt: new Date(),
        })
      }

      await batch.commit()

      toast({
        title: "Standart turlar yaratildi",
        description: "Standart joy turlari muvaffaqiyatli yaratildi",
      })
    } catch (error) {
      console.error("Error creating default seating types:", error)
      toast({
        title: "Xatolik",
        description: "Standart joy turlarini yaratishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  // Create default floor if none exist
  const createDefaultFloor = async () => {
    try {
      // First check if there are any existing floors to avoid duplication
      const floorsSnapshot = await getDocs(collection(db, "floors"))
      if (!floorsSnapshot.empty) {
        console.log("Floors already exist, skipping default creation")
        return
      }

      await addDoc(collection(db, "floors"), {
        number: 1,
        name: "1-qavat",
        description: "Asosiy qavat",
        count: 0,
        createdAt: new Date(),
      })

      toast({
        title: "Standart qavat yaratildi",
        description: "Standart qavat muvaffaqiyatli yaratildi",
      })
    } catch (error) {
      console.error("Error creating default floor:", error)
      toast({
        title: "Xatolik",
        description: "Standart qavatni yaratishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  // Filter seating items based on selected filters
  const filteredItems = useMemo(() => {
    return seatingItems.filter((item) => {
      const statusMatch = showOccupiedItems ? true : item.status === "available"
      const typeMatch = !selectedTypeFilter || selectedTypeFilter === "all" ? true : item.type === selectedTypeFilter
      const floorMatch =
        !selectedFloorFilter || selectedFloorFilter === 0 ? true : (item.floor || 1) === selectedFloorFilter
      const searchMatch = !searchTerm
        ? true
        : item.number.toString().includes(searchTerm) || item.type.toLowerCase().includes(searchTerm.toLowerCase())
      const capacityMatch = !capacityFilter ? true : item.seats >= capacityFilter
      const statusFilterMatch = !statusFilter ? true : item.status === statusFilter

      return statusMatch && typeMatch && floorMatch && searchMatch && capacityMatch && statusFilterMatch
    })
  }, [
    seatingItems,
    showOccupiedItems,
    selectedTypeFilter,
    selectedFloorFilter,
    searchTerm,
    capacityFilter,
    statusFilter,
  ])

  // Group items by type for statistics
  const itemsByType = useMemo(() => {
    const result: Record<string, { total: number; available: number; occupied: number; reserved: number }> = {}

    seatingItems.forEach((item) => {
      if (!result[item.type]) {
        result[item.type] = { total: 0, available: 0, occupied: 0, reserved: 0 }
      }

      result[item.type].total++

      if (item.status === "available") {
        result[item.type].available++
      } else if (item.status === "occupied") {
        result[item.type].occupied++
      } else if (item.status === "reserved") {
        result[item.type].reserved++
      }
    })

    return result
  }, [seatingItems])

  // Group items by floor for statistics
  const itemsByFloor = useMemo(() => {
    const result: Record<number, { total: number; available: number; occupied: number; reserved: number }> = {}

    seatingItems.forEach((item) => {
      const floor = item.floor || 1
      if (!result[floor]) {
        result[floor] = { total: 0, available: 0, occupied: 0, reserved: 0 }
      }

      result[floor].total++

      if (item.status === "available") {
        result[item.floor].available++
      } else if (item.status === "occupied") {
        result[item.floor].occupied++
      } else if (item.status === "reserved") {
        result[item.floor].reserved++
      }
    })

    return result
  }, [seatingItems])

  // Update seating type counts based on actual items
  useEffect(() => {
    const updateTypeCounts = async () => {
      try {
        // Skip if types or items aren't loaded yet
        if (isLoading || seatingTypes.length === 0) return

        const batch = writeBatch(db)
        let updatesNeeded = false

        // Calculate actual counts for each type
        const actualCounts: Record<string, number> = {}
        seatingItems.forEach((item) => {
          if (!actualCounts[item.type]) {
            actualCounts[item.type] = 0
          }
          actualCounts[item.type]++
        })

        // Update types where count doesn't match
        for (const type of seatingTypes) {
          const actualCount = actualCounts[type.name] || 0
          if (type.count !== actualCount) {
            updatesNeeded = true
            const typeRef = doc(db, "seatingTypes", type.id)
            batch.update(typeRef, {
              count: actualCount,
              updatedAt: new Date(),
            })
          }
        }

        // Only commit if there are updates needed
        if (updatesNeeded) {
          await batch.commit()
          console.log("Updated seating type counts to match actual items")
        }
      } catch (error) {
        console.error("Error updating type counts:", error)
      }
    }

    updateTypeCounts()
  }, [seatingItems, seatingTypes, isLoading])

  // Update floor counts based on actual items
  useEffect(() => {
    const updateFloorCounts = async () => {
      try {
        // Skip if floors or items aren't loaded yet
        if (isLoading || floors.length === 0) return

        const batch = writeBatch(db)
        let updatesNeeded = false

        // Calculate actual counts for each floor
        const actualCounts: Record<number, number> = {}
        seatingItems.forEach((item) => {
          const floor = item.floor || 1
          if (!actualCounts[floor]) {
            actualCounts[floor] = 0
          }
          actualCounts[floor]++
        })

        // Update floors where count doesn't match
        for (const floor of floors) {
          const actualCount = actualCounts[floor.number] || 0
          if (floor.count !== actualCount) {
            updatesNeeded = true
            const floorRef = doc(db, "floors", floor.id)
            batch.update(floorRef, {
              count: actualCount,
              updatedAt: new Date(),
            })
          }
        }

        // Only commit if there are updates needed
        if (updatesNeeded) {
          await batch.commit()
          console.log("Updated floor counts to match actual items")
        }
      } catch (error) {
        console.error("Error updating floor counts:", error)
      }
    }

    updateFloorCounts()
  }, [seatingItems, floors, isLoading])

  // Check if an item has an active order
  const hasActiveOrder = (itemNumber: number, type: string) => {
    if (type.toLowerCase() === "xona") {
      return activeOrders.some((order) => order.roomNumber === itemNumber)
    } else {
      return activeOrders.some((order) => order.tableNumber === itemNumber && order.seatingType === type)
    }
  }

  // Get active orders for an item
  const getActiveOrdersForItem = (itemNumber: number, type: string) => {
    if (type.toLowerCase() === "xona") {
      return activeOrders.filter((order) => order.roomNumber === itemNumber)
    } else {
      return activeOrders.filter((order) => order.tableNumber === itemNumber && order.seatingType === type)
    }
  }

  // Add a single seating item
  const handleAddItem = async () => {
    setIsSubmitting(true)

    try {
      // Get the default capacity from the selected type
      const selectedTypeData = seatingTypes.find((t) => t.name === newItemType)
      const defaultCapacity = selectedTypeData ? selectedTypeData.defaultCapacity : 4

      // Check if an item with this number and type already exists
      const existingItemsQuery = query(
        collection(db, "seatingItems"),
        where("number", "==", newItemNumber),
        where("type", "==", newItemType),
        where("floor", "==", newItemFloor),
      )

      const existingItemsSnapshot = await getDocs(existingItemsQuery)

      if (!existingItemsSnapshot.empty) {
        toast({
          title: "Xatolik",
          description: `${newItemFloor}-qavat, ${newItemType} #${newItemNumber} allaqachon mavjud. Boshqa raqam tanlang.`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const itemData = {
        number: newItemNumber,
        seats: newItemSeats || defaultCapacity,
        status: newItemStatus,
        type: newItemType,
        floor: newItemFloor,
        waiterId: newItemWaiterId === "none" ? null : newItemWaiterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await addDoc(collection(db, "seatingItems"), itemData)

      // Update the count for this type
      if (selectedTypeData) {
        await updateDoc(doc(db, "seatingTypes", selectedTypeData.id), {
          count: (selectedTypeData.count || 0) + 1,
          updatedAt: new Date(),
        })
      }

      // Update the count for this floor
      const selectedFloorData = floors.find((f) => f.number === newItemFloor)
      if (selectedFloorData) {
        await updateDoc(doc(db, "floors", selectedFloorData.id), {
          count: (selectedFloorData.count || 0) + 1,
          updatedAt: new Date(),
        })
      }

      setIsAddingItem(false)
      setNewItemNumber((prev) => prev + 1)
      setNewItemSeats(defaultCapacity)
      setNewItemStatus("available")
      setNewItemWaiterId(null)

      toast({
        title: "Muvaffaqiyatli",
        description: `${newItemFloor}-qavat, ${newItemType} #${newItemNumber} muvaffaqiyatli qo'shildi`,
      })
    } catch (error) {
      console.error("Error adding seating item:", error)
      toast({
        title: "Xatolik",
        description: "Joy elementini qo'shishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add multiple seating items at once
  const handleBatchAddItems = async () => {
    setIsSubmitting(true)

    try {
      // Validatsiya
      if (batchItemCount <= 0) {
        toast({
          title: "Xatolik",
          description: "Qo'shiladigan elementlar soni 0 dan katta bo'lishi kerak",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      if (batchItemStartNumber <= 0) {
        toast({
          title: "Xatolik",
          description: "Boshlang'ich raqam 0 dan katta bo'lishi kerak",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Check if any items with these numbers and type already exist
      const startNumber = batchItemStartNumber
      const endNumber = batchItemStartNumber + batchItemCount - 1

      // Get existing items in the range
      const existingItemsQuery = query(
        collection(db, "seatingItems"),
        where("type", "==", batchItemType),
        where("floor", "==", batchItemFloor),
      )

      const existingItemsSnapshot = await getDocs(existingItemsQuery)

      // Filter existing items that fall within our range
      const conflictingItems = existingItemsSnapshot.docs
        .map((doc) => doc.data().number)
        .filter((num) => num >= startNumber && num <= endNumber)

      if (conflictingItems.length > 0) {
        toast({
          title: "Xatolik",
          description: `Ba'zi raqamlar allaqachon mavjud: ${conflictingItems.join(", ")}. Boshqa boshlang'ich raqam tanlang.`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // Get the default capacity from the selected type
      const selectedTypeData = seatingTypes.find((t) => t.name === batchItemType)
      const defaultCapacity = selectedTypeData ? selectedTypeData.defaultCapacity : 4

      // Create batch
      const batch = writeBatch(db)
      const timestamp = new Date()

      // Add items to batch
      for (let i = 0; i < batchItemCount; i++) {
        const itemData = {
          number: batchItemStartNumber + i,
          seats: batchItemSeats || defaultCapacity,
          status: "available",
          type: batchItemType,
          floor: batchItemFloor,
          waiterId: batchItemWaiterId === "none" ? null : batchItemWaiterId,
          createdAt: timestamp,
          updatedAt: timestamp,
        }

        const newItemRef = doc(collection(db, "seatingItems"))
        batch.set(newItemRef, itemData)
      }

      // Commit the batch
      await batch.commit()

      // Update the count for this type
      if (selectedTypeData) {
        await updateDoc(doc(db, "seatingTypes", selectedTypeData.id), {
          count: (selectedTypeData.count || 0) + batchItemCount,
          updatedAt: new Date(),
        })
      }

      // Update the count for this floor
      const selectedFloorData = floors.find((f) => f.number === batchItemFloor)
      if (selectedFloorData) {
        await updateDoc(doc(db, "floors", selectedFloorData.id), {
          count: (selectedFloorData.count || 0) + batchItemCount,
          updatedAt: new Date(),
        })
      }

      setIsBatchAddingItems(false)
      setBatchItemStartNumber((prev) => prev + batchItemCount)
      setBatchItemWaiterId(null)

      toast({
        title: "Muvaffaqiyatli",
        description: `${batchItemCount} ta ${batchItemFloor}-qavat, ${batchItemType} muvaffaqiyatli qo'shildi`,
      })
    } catch (error) {
      console.error("Error batch adding seating items:", error)
      toast({
        title: "Xatolik",
        description: "Joy elementlarini qo'shishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Edit a seating item
  const handleUpdateItem = async () => {
    if (!selectedItem) return
    setIsSubmitting(true)

    try {
      // Check if type has changed
      const oldType = selectedItem.type
      const newType = newItemType
      const typeChanged = oldType !== newType

      // Check if floor has changed
      const oldFloor = selectedItem.floor || 1
      const newFloor = newItemFloor
      const floorChanged = oldFloor !== newFloor

      const itemData = {
        number: newItemNumber,
        seats: newItemSeats,
        status: newItemStatus,
        type: newItemType,
        floor: newItemFloor,
        waiterId: newItemWaiterId === "none" ? null : newItemWaiterId,
        updatedAt: new Date(),
      }

      await updateDoc(doc(db, "seatingItems", selectedItem.id), itemData)

      // If type has changed, update counts for both old and new types
      if (typeChanged) {
        const batch = writeBatch(db)

        // Decrease count for old type
        const oldTypeData = seatingTypes.find((t) => t.name === oldType)
        if (oldTypeData && oldTypeData.count > 0) {
          const oldTypeRef = doc(db, "seatingTypes", oldTypeData.id)
          batch.update(oldTypeRef, {
            count: oldTypeData.count - 1,
            updatedAt: new Date(),
          })
        }

        // Increase count for new type
        const newTypeData = seatingTypes.find((t) => t.name === newType)
        if (newTypeData) {
          const newTypeRef = doc(db, "seatingTypes", newTypeData.id)
          batch.update(newTypeRef, {
            count: (newTypeData.count || 0) + 1,
            updatedAt: new Date(),
          })
        }

        await batch.commit()
      }

      // If floor has changed, update counts for both old and new floors
      if (floorChanged) {
        const batch = writeBatch(db)

        // Decrease count for old floor
        const oldFloorData = floors.find((f) => f.number === oldFloor)
        if (oldFloorData && oldFloorData.count > 0) {
          const oldFloorRef = doc(db, "floors", oldFloorData.id)
          batch.update(oldFloorRef, {
            count: oldFloorData.count - 1,
            updatedAt: new Date(),
          })
        }

        // Increase count for new floor
        const newFloorData = floors.find((f) => f.number === newFloor)
        if (newFloorData) {
          const newFloorRef = doc(db, "floors", newFloorData.id)
          batch.update(newFloorRef, {
            count: (newFloorData.count || 0) + 1,
            updatedAt: new Date(),
          })
        }

        await batch.commit()
      }

      setIsEditingItem(false)
      setSelectedItem(null)

      toast({
        title: "Muvaffaqiyatli",
        description: `${newItemFloor}-qavat, ${newItemType} #${newItemNumber} muvaffaqiyatli tahrirlandi`,
      })
    } catch (error) {
      console.error("Error editing seating item:", error)
      toast({
        title: "Xatolik",
        description: "Joy elementini tahrirlashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete a seating item
  const handleDeleteItem = async (itemId: string, type: string, floor = 1) => {
    try {
      await deleteDoc(doc(db, "seatingItems", itemId))

      // Update the count for this type
      const selectedTypeData = seatingTypes.find((t) => t.name === type)
      if (selectedTypeData && selectedTypeData.count > 0) {
        await updateDoc(doc(db, "seatingTypes", selectedTypeData.id), {
          count: selectedTypeData.count - 1,
          updatedAt: new Date(),
        })
      }

      // Update the count for this floor
      const selectedFloorData = floors.find((f) => f.number === floor)
      if (selectedFloorData && selectedFloorData.count > 0) {
        await updateDoc(doc(db, "floors", selectedFloorData.id), {
          count: selectedFloorData.count - 1,
          updatedAt: new Date(),
        })
      }

      toast({
        title: "Muvaffaqiyatli",
        description: `${floor}-qavat, ${type} muvaffaqiyatli o'chirildi`,
      })
    } catch (error) {
      console.error("Error deleting seating item:", error)
      toast({
        title: "Xatolik",
        description: "Joy elementini o'chirishda xatolik yuz berdi",
      })
    }
  }

  // Toggle item status
  const handleToggleItemStatus = async (item: SeatingItem) => {
    try {
      const newStatus = item.status === "available" ? "occupied" : "available"

      await updateDoc(doc(db, "seatingItems", item.id), {
        status: newStatus,
        updatedAt: new Date(),
      })

      toast({
        title: "Status yangilandi",
        description: `${item.floor || 1}-qavat, ${item.type} #${item.number} statusi ${newStatus === "available" ? "bo'sh" : "band"} qilindi`,
      })
    } catch (error) {
      console.error("Error toggling item status:", error)
      toast({
        title: "Xatolik",
        description: "Joy elementi statusini yangilashda xatolik yuz berdi",
      })
    }
  }

  // Add a seating type
  const handleAddType = async () => {
    setIsSubmitting(true)

    try {
      // Check if type with this name already exists
      const existingType = seatingTypes.find((t) => t.name.toLowerCase() === newTypeName.toLowerCase())
      if (existingType) {
        toast({
          title: "Xatolik",
          description: `"${newTypeName}" nomli joy turi allaqachon mavjud`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const typeData = {
        name: newTypeName,
        defaultCapacity: newTypeCapacity,
        count: 0,
        createdAt: new Date(),
      }

      await addDoc(collection(db, "seatingTypes"), typeData)

      setIsAddingType(false)
      setNewTypeName("")
      setNewTypeCapacity(4)

      toast({
        title: "Muvaffaqiyatli",
        description: "Joy turi muvaffaqiyatli qo'shildi",
      })
    } catch (error) {
      console.error("Error adding seating type:", error)
      toast({
        title: "Xatolik",
        description: "Joy turini qo'shishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Edit a seating type
  const handleEditType = async () => {
    if (!selectedType) return
    setIsSubmitting(true)

    try {
      // Check if another type with this name already exists
      const existingType = seatingTypes.find(
        (t) => t.name.toLowerCase() === newTypeName.toLowerCase() && t.id !== selectedType.id,
      )

      if (existingType) {
        toast({
          title: "Xatolik",
          description: `"${newTypeName}" nomli joy turi allaqachon mavjud`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const typeData = {
        name: newTypeName,
        defaultCapacity: newTypeCapacity,
        updatedAt: new Date(),
      }

      await updateDoc(doc(db, "seatingTypes", selectedType.id), typeData)

      // Update all items of this type with the new name
      const itemsToUpdate = seatingItems.filter((item) => item.type === selectedType.name)

      if (itemsToUpdate.length > 0) {
        const batch = writeBatch(db)

        itemsToUpdate.forEach((item) => {
          const itemRef = doc(db, "seatingItems", item.id)
          batch.update(itemRef, { type: newTypeName })
        })

        await batch.commit()
      }

      setIsEditingType(false)
      setSelectedType(null)

      toast({
        title: "Muvaffaqiyatli",
        description: "Joy turi muvaffaqiyatli tahrirlandi",
      })
    } catch (error) {
      console.error("Error editing seating type:", error)
      toast({
        title: "Xatolik",
        description: "Joy turini tahrirlashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete a seating type
  const handleDeleteType = async (typeId: string, typeName: string) => {
    try {
      // Check if there are items of this type
      const itemsOfType = seatingItems.filter((item) => item.type === typeName)

      if (itemsOfType.length > 0) {
        toast({
          title: "Xatolik",
          description: `Bu turda ${itemsOfType.length} ta element mavjud. Avval elementlarni o'chiring yoki boshqa turga o'tkazing.`,
          variant: "destructive",
        })
        return
      }

      await deleteDoc(doc(db, "seatingTypes", typeId))

      toast({
        title: "Muvaffaqiyatli",
        description: "Joy turi muvaffaqiyatli o'chirildi",
      })
    } catch (error) {
      console.error("Error deleting seating type:", error)
      toast({
        title: "Xatolik",
        description: "Joy turini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  // Add a floor
  const handleAddFloor = async () => {
    setIsSubmitting(true)

    try {
      // Check if floor with this number already exists
      const existingFloor = floors.find((f) => f.number === newFloorNumber)
      if (existingFloor) {
        toast({
          title: "Xatolik",
          description: `${newFloorNumber}-qavat allaqachon mavjud`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const floorData = {
        number: newFloorNumber,
        name: newFloorName || `${newFloorNumber}-qavat`,
        description: newFloorDescription,
        count: 0,
        createdAt: new Date(),
      }

      await addDoc(collection(db, "floors"), floorData)

      setIsAddingFloor(false)
      setNewFloorNumber(Math.max(...floors.map((f) => f.number), 0) + 1)
      setNewFloorName("")
      setNewFloorDescription("")

      toast({
        title: "Muvaffaqiyatli",
        description: `${newFloorNumber}-qavat muvaffaqiyatli qo'shildi`,
      })
    } catch (error) {
      console.error("Error adding floor:", error)
      toast({
        title: "Xatolik",
        description: "Qavatni qo'shishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Edit a floor
  const handleEditFloor = async () => {
    if (!selectedFloor) return
    setIsSubmitting(true)

    try {
      // Check if another floor with this number already exists
      const existingFloor = floors.find((f) => f.number === newFloorNumber && f.id !== selectedFloor.id)

      if (existingFloor) {
        toast({
          title: "Xatolik",
          description: `${newFloorNumber}-qavat allaqachon mavjud`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const floorData = {
        number: newFloorNumber,
        name: newFloorName || `${newFloorNumber}-qavat`,
        description: newFloorDescription,
        updatedAt: new Date(),
      }

      await updateDoc(doc(db, "floors", selectedFloor.id), floorData)

      // Update all items on this floor with the new floor number
      const itemsToUpdate = seatingItems.filter((item) => (item.floor || 1) === selectedFloor.number)

      if (itemsToUpdate.length > 0) {
        const batch = writeBatch(db)

        itemsToUpdate.forEach((item) => {
          const itemRef = doc(db, "seatingItems", item.id)
          batch.update(itemRef, { floor: newFloorNumber })
        })

        await batch.commit()
      }

      setIsEditingFloor(false)
      setSelectedFloor(null)

      toast({
        title: "Muvaffaqiyatli",
        description: `${newFloorNumber}-qavat muvaffaqiyatli tahrirlandi`,
      })
    } catch (error) {
      console.error("Error editing floor:", error)
      toast({
        title: "Xatolik",
        description: "Qavatni tahrirlashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete a floor
  const handleDeleteFloor = async (floorId: string, floorNumber: number) => {
    try {
      // Check if there are items on this floor
      const itemsOnFloor = seatingItems.filter((item) => (item.floor || 1) === floorNumber)

      if (itemsOnFloor.length > 0) {
        toast({
          title: "Xatolik",
          description: `Bu qavatda ${itemsOnFloor.length} ta element mavjud. Avval elementlarni o'chiring yoki boshqa qavatga o'tkazing.`,
          variant: "destructive",
        })
        return
      }

      await deleteDoc(doc(db, "floors", floorId))

      toast({
        title: "Muvaffaqiyatli",
        description: `${floorNumber}-qavat muvaffaqiyatli o'chirildi`,
      })
    } catch (error) {
      console.error("Error deleting floor:", error)
      toast({
        title: "Xatolik",
        description: "Qavatni o'chirishda xatolik yuz berdi",
      })
    }
  }

  // Reset all items to available
  const handleResetAllItems = async () => {
    setIsSubmitting(true)

    try {
      const batch = writeBatch(db)

      seatingItems.forEach((item) => {
        if (item.status !== "available") {
          const itemRef = doc(db, "seatingItems", item.id)
          batch.update(itemRef, {
            status: "available",
            updatedAt: new Date(),
          })
        }
      })

      await batch.commit()

      toast({
        title: "Muvaffaqiyatli",
        description: "Barcha joy elementlari bo'sh holatga o'tkazildi",
      })
    } catch (error) {
      console.error("Error resetting items:", error)
      toast({
        title: "Xatolik",
        description: "Joy elementlarini qayta o'rnatishda xatolik yuz berdi",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date for order display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return new Intl.DateTimeFormat("uz-UZ", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(date)
  }

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Kutilmoqda"
      case "preparing":
        return "Tayyorlanmoqda"
      case "ready":
        return "Tayyor"
      default:
        return status
    }
  }

  // Add a function to get waiter name by ID
  const getWaiterName = (waiterId: string | null | undefined) => {
    if (!waiterId) return "Belgilanmagan"
    const waiter = waiters.find((w) => w.id === waiterId)
    return waiter ? waiter.name : "Belgilanmagan"
  }

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItems.map((item) => item.id))
    }
    setSelectAll(!selectAll)
  }

  // Handle individual item selection
  const handleSelectItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter((id) => id !== itemId))
    } else {
      setSelectedItems([...selectedItems, itemId])
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return

    try {
      const batch = writeBatch(db)

      // Group items by type and floor to update counts
      const typeCountsToUpdate: Record<string, number> = {}
      const floorCountsToUpdate: Record<number, number> = {}

      selectedItems.forEach((itemId) => {
        const item = seatingItems.find((i) => i.id === itemId)
        if (item) {
          // Add to type counts
          if (!typeCountsToUpdate[item.type]) {
            typeCountsToUpdate[item.type] = 0
          }
          typeCountsToUpdate[item.type]++

          // Add to floor counts
          const floor = item.floor || 1
          if (!floorCountsToUpdate[floor]) {
            floorCountsToUpdate[floor] = 0
          }
          floorCountsToUpdate[floor]++

          // Delete the item
          const itemRef = doc(db, "seatingItems", itemId)
          batch.delete(itemRef)
        }
      })

      // Update type counts
      for (const [typeName, count] of Object.entries(typeCountsToUpdate)) {
        const typeDoc = seatingTypes.find((t) => t.name === typeName)
        if (typeDoc && typeDoc.count >= count) {
          const typeRef = doc(db, "seatingTypes", typeDoc.id)
          batch.update(typeRef, {
            count: typeDoc.count - count,
            updatedAt: new Date(),
          })
        }
      }

      // Update floor counts
      for (const [floorNumber, count] of Object.entries(floorCountsToUpdate)) {
        const floorDoc = floors.find((f) => f.number === Number(floorNumber))
        if (floorDoc && floorDoc.count >= count) {
          const floorRef = doc(db, "floors", floorDoc.id)
          batch.update(floorRef, {
            count: floorDoc.count - count,
            updatedAt: new Date(),
          })
        }
      }

      await batch.commit()

      toast({
        title: "Muvaffaqiyatli",
        description: `${selectedItems.length} ta element muvaffaqiyatli o'chirildi`,
      })

      setSelectedItems([])
      setSelectAll(false)
    } catch (error) {
      console.error("Error bulk deleting items:", error)
      toast({
        title: "Xatolik",
        description: "Elementlarni o'chirishda xatolik yuz berdi",
      })
    }
  }

  // Export data to CSV
  const handleExportData = () => {
    try {
      // Create CSV content
      let csvContent = "Floor,Type,Number,Seats,Status,Waiter\n"

      filteredItems.forEach((item) => {
        csvContent += `${item.floor || 1},${item.type},${item.number},${item.seats},${item.status},${getWaiterName(item.waiterId)}\n`
      })

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `seating-items-${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Muvaffaqiyatli",
        description: "Ma'lumotlar CSV formatida yuklab olindi",
      })
    } catch (error) {
      console.error("Error exporting data:", error)
      toast({
        title: "Xatolik",
        description: "Ma'lumotlarni eksport qilishda xatolik yuz berdi",
      })
    }
  }

  // Get icon for seating type
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "stol":
        return <TableIcon className="h-4 w-4" />
      case "xona":
        return <Home className="h-4 w-4" />
      case "divan":
        return <Sofa className="h-4 w-4" />
      case "kreslo":
        return <Armchair className="h-4 w-4" />
      default:
        return <LayoutGrid className="h-4 w-4" />
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter(null)
    setCapacityFilter(null)
    setSelectedTypeFilter(null)
    setSelectedFloorFilter(null)
  }

  // Update the handleEditItem function to correctly set the initial values
  const handleEditItem = (item: SeatingItem) => {
    // Set the form values with the current item data
    setSelectedItem(item)
    setNewItemNumber(item.number)
    setNewItemSeats(item.seats)
    setNewItemStatus(item.status)
    setNewItemType(item.type)
    setNewItemFloor(item.floor || 1)
    setNewItemWaiterId(item.waiterId || null)
    setIsEditingItem(true)
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500"
      case "occupied":
        return "bg-red-500"
      case "reserved":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  // Get status text color
  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "available":
        return "text-green-500"
      case "occupied":
        return "text-red-500"
      case "reserved":
        return "text-yellow-500"
      default:
        return "text-gray-500"
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Ma'lumotlar yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Joy elementlari boshqaruvi</h1>
          <p className="text-muted-foreground">Stollar, xonalar va boshqa joy elementlarini boshqaring</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
                  {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{viewMode === "grid" ? "Ro'yxat ko'rinishi" : "Jadval ko'rinishi"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Element qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Yangi element qo'shish</DialogTitle>
                <DialogDescription>Joy elementini qo'shish uchun ma'lumotlarni kiriting</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAddItem()
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-item-number" className="text-right">
                      Raqami
                    </Label>
                    <Input
                      id="new-item-number"
                      type="number"
                      min="1"
                      value={newItemNumber}
                      onChange={(e) => setNewItemNumber(Number.parseInt(e.target.value) || 1)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-item-seats" className="text-right">
                      Sig'imi
                    </Label>
                    <Input
                      id="new-item-seats"
                      type="number"
                      min="1"
                      value={newItemSeats}
                      onChange={(e) => setNewItemSeats(Number.parseInt(e.target.value) || 1)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-item-type" className="text-right">
                      Joy turi
                    </Label>
                    <Select
                      value={newItemType}
                      onValueChange={setNewItemType}
                      defaultValue={seatingTypes[0]?.name || "Stol"}
                    >
                      <SelectTrigger id="new-item-type" className="col-span-3">
                        <SelectValue placeholder="Joy turini tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {seatingTypes.map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name} (sig'imi: {type.defaultCapacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-item-status" className="text-right">
                      Status
                    </Label>
                    <Select value={newItemStatus} onValueChange={setNewItemStatus}>
                      <SelectTrigger id="new-item-status" className="col-span-3">
                        <SelectValue placeholder="Statusni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Bo'sh</SelectItem>
                        <SelectItem value="occupied">Band</SelectItem>
                        <SelectItem value="reserved">Rezerv qilingan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-item-floor" className="text-right">
                      Qavat
                    </Label>
                    <Select
                      value={newItemFloor.toString()}
                      onValueChange={(value) => setNewItemFloor(Number.parseInt(value))}
                    >
                      <SelectTrigger id="new-item-floor" className="col-span-3">
                        <SelectValue placeholder="Qavatni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {floors.map((floor) => (
                          <SelectItem key={floor.id} value={floor.number.toString()}>
                            {floor.name || `${floor.number}-qavat`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-item-waiter" className="text-right">
                      Ofitsiant
                    </Label>
                    <Select value={newItemWaiterId || "none"} onValueChange={setNewItemWaiterId}>
                      <SelectTrigger id="new-item-waiter" className="col-span-3">
                        <SelectValue placeholder="Ofitsiantni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {waiters.map((waiter) => (
                          <SelectItem key={waiter.id} value={waiter.id}>
                            {waiter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Qo'shilmoqda...
                      </>
                    ) : (
                      "Qo'shish"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isBatchAddingItems} onOpenChange={setIsBatchAddingItems}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Ko'p elementlar qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Ko'p elementlar qo'shish</DialogTitle>
                <DialogDescription>
                  Bir vaqtning o'zida bir nechta joy elementlarini qo'shish uchun ma'lumotlarni kiriting
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleBatchAddItems()
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batch-item-count" className="text-right">
                      Elementlar soni
                    </Label>
                    <Input
                      id="batch-item-count"
                      type="number"
                      min="1"
                      value={batchItemCount}
                      onChange={(e) => setBatchItemCount(Number.parseInt(e.target.value) || 1)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batch-item-start-number" className="text-right">
                      Boshlang'ich raqam
                    </Label>
                    <Input
                      id="batch-item-start-number"
                      type="number"
                      min="1"
                      value={batchItemStartNumber}
                      onChange={(e) => setBatchItemStartNumber(Number.parseInt(e.target.value) || 1)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batch-item-seats" className="text-right">
                      Sig'imi
                    </Label>
                    <Input
                      id="batch-item-seats"
                      type="number"
                      min="1"
                      value={batchItemSeats}
                      onChange={(e) => setBatchItemSeats(Number.parseInt(e.target.value) || 1)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batch-item-type" className="text-right">
                      Joy turi
                    </Label>
                    <Select
                      value={batchItemType}
                      onValueChange={setBatchItemType}
                      defaultValue={seatingTypes[0]?.name || "Stol"}
                    >
                      <SelectTrigger id="batch-item-type" className="col-span-3">
                        <SelectValue placeholder="Joy turini tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {seatingTypes.map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name} (sig'imi: {type.defaultCapacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batch-item-floor" className="text-right">
                      Qavat
                    </Label>
                    <Select
                      value={batchItemFloor.toString()}
                      onValueChange={(value) => setBatchItemFloor(Number.parseInt(value))}
                    >
                      <SelectTrigger id="batch-item-floor" className="col-span-3">
                        <SelectValue placeholder="Qavatni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {floors.map((floor) => (
                          <SelectItem key={floor.id} value={floor.number.toString()}>
                            {floor.name || `${floor.number}-qavat`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="batch-item-waiter" className="text-right">
                      Ofitsiant
                    </Label>
                    <Select value={batchItemWaiterId || "none"} onValueChange={setBatchItemWaiterId}>
                      <SelectTrigger id="batch-item-waiter" className="col-span-3">
                        <SelectValue placeholder="Ofitsiantni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {waiters.map((waiter) => (
                          <SelectItem key={waiter.id} value={waiter.id}>
                            {waiter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md bg-amber-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-amber-800">Ma'lumot</h3>
                      <div className="mt-2 text-sm text-amber-700">
                        <p>
                          Bu amal {batchItemStartNumber} dan {batchItemStartNumber + batchItemCount - 1} gacha bo'lgan
                          raqamli {batchItemCount} ta {batchItemType} qo'shadi. Agar bu raqamlar allaqachon mavjud
                          bo'lsa, xatolik yuz beradi.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Qo'shilmoqda...
                      </>
                    ) : (
                      "Qo'shish"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Qayta o'rnatish
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Barcha joy elementlarini qayta o'rnatish</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu amal barcha joy elementlarini bo'sh holatga o'tkazadi. Bu amalni qaytarib bo'lmaydi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAllItems}>Qayta o'rnatish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download className="mr-2 h-4 w-4" />
            Eksport
          </Button>
        </div>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid w-full grid-cols-3">
          <TabsTrigger value="table-view" className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            Jadval ko'rinishi
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Joy turlari
          </TabsTrigger>
          <TabsTrigger value="floors" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Qavatlar
          </TabsTrigger>
        </TabsList>

        {/* Table View Tab */}
        <TabsContent value="table-view">
          <div className="mb-6 space-y-4">
            {/* Search and filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Qidirish va filtrlash</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Qidirish..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select
                    value={statusFilter || "all"}
                    onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha statuslar</SelectItem>
                      <SelectItem value="available">Bo'sh</SelectItem>
                      <SelectItem value="occupied">Band</SelectItem>
                      <SelectItem value="reserved">Rezerv qilingan</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedFloorFilter ? selectedFloorFilter.toString() : "all"}
                    onValueChange={(value) => setSelectedFloorFilter(value === "all" ? null : Number.parseInt(value))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Qavat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha qavatlar</SelectItem>
                      {floors.map((floor) => (
                        <SelectItem key={floor.id} value={floor.number.toString()}>
                          {floor.name || `${floor.number}-qavat`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={capacityFilter ? capacityFilter.toString() : "all"}
                    onValueChange={(value) => setCapacityFilter(value === "all" ? null : Number.parseInt(value))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Sig'imi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha sig'imlar</SelectItem>
                      <SelectItem value="1">1+ kishi</SelectItem>
                      <SelectItem value="2">2+ kishi</SelectItem>
                      <SelectItem value="4">4+ kishi</SelectItem>
                      <SelectItem value="6">6+ kishi</SelectItem>
                      <SelectItem value="10">10+ kishi</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="icon" onClick={clearFilters} title="Filtrlarni tozalash">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="show-occupied" checked={showOccupiedItems} onCheckedChange={setShowOccupiedItems} />
                      <Label htmlFor="show-occupied">Band joylarni ko'rsatish</Label>
                    </div>

                    {selectedItems.length > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="ml-4">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {selectedItems.length} ta elementni o'chirish
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(itemsByFloor).map(([floorNum, stats]) => (
                <Card key={`floor-${floorNum}`} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {floors.find((f) => f.number === Number(floorNum))?.name || `${floorNum}-qavat`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Jami</div>
                    <div className="mt-2 flex items-center text-sm">
                      <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                      <div>
                        {stats.available} ta bo'sh
                        <span className="ml-2 text-muted-foreground">
                          ({((stats.available / stats.total) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm">
                      <div className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                      <div>
                        {stats.occupied} ta band
                        <span className="ml-2 text-muted-foreground">
                          ({((stats.occupied / stats.total) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm">
                      <div className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
                      <div>
                        {stats.reserved} ta rezerv qilingan
                        <span className="ml-2 text-muted-foreground">
                          ({((stats.reserved / stats.total) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <div className="h-1 w-full bg-gray-200">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(stats.available / stats.total) * 100}%`, float: "left" }}
                    ></div>
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(stats.occupied / stats.total) * 100}%`, float: "left" }}
                    ></div>
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${(stats.reserved / stats.total) * 100}%`, float: "left" }}
                    ></div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Seating items display */}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <LayoutGrid className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">Joy elementlari topilmadi</h3>
                <p className="text-sm text-muted-foreground">
                  Hech qanday joy elementi topilmadi. Yangi element qo'shish uchun "Element qo'shish" tugmasini bosing.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredItems.map((item) => (
                  <Card
                    key={item.id}
                    className={`overflow-hidden transition-all hover:shadow-md ${
                      item.status === "available"
                        ? "border-green-200 bg-green-50"
                        : item.status === "occupied"
                          ? "border-red-200 bg-red-50"
                          : "border-yellow-200 bg-yellow-50"
                    }`}
                  >
                    <CardHeader className="p-4 pb-0">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`${getStatusTextColor(item.status)} border-current font-normal`}
                        >
                          {item.status === "available" ? "Bo'sh" : item.status === "occupied" ? "Band" : "Rezerv"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditItem(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleItemStatus(item)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Statusni o'zgartirish
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteItem(item.id, item.type, item.floor)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="mb-1 flex items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          {getTypeIcon(item.type)}
                        </div>
                        <div className="ml-3">
                          <div className="text-xl font-bold">{item.number}</div>
                          <div className="text-xs text-muted-foreground">{item.type}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Qavat:</span>{" "}
                          {floors.find((f) => f.number === (item.floor || 1))?.name || `${item.floor || 1}-qavat`}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sig'imi:</span> {item.seats} kishi
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Ofitsiant:</span> {getWaiterName(item.waiterId)}
                        </div>
                      </div>
                      {hasActiveOrder(item.number, item.type) && (
                        <div className="mt-2 rounded-md bg-amber-100 p-1 text-center text-xs text-amber-800">
                          {getActiveOrdersForItem(item.number, item.type).length} ta faol buyurtma
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Qavat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Turi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Raqami
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Sig'imi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Ofitsiant
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Amallar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.status === "available"
                            ? "bg-green-50"
                            : item.status === "occupied"
                              ? "bg-red-50"
                              : "bg-yellow-50"
                        }
                      >
                        <td className="whitespace-nowrap px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {floors.find((f) => f.number === (item.floor || 1))?.name || `${item.floor || 1}-qavat`}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(item.type)}
                            {item.type}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-medium">{item.number}</td>
                        <td className="whitespace-nowrap px-6 py-4">{item.seats}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <Badge
                            variant="outline"
                            className={`${getStatusTextColor(item.status)} border-current font-normal`}
                          >
                            {item.status === "available" ? "Bo'sh" : item.status === "occupied" ? "Band" : "Rezerv"}
                          </Badge>
                          {hasActiveOrder(item.number, item.type) && (
                            <div className="mt-1 text-xs text-red-500">
                              {getActiveOrdersForItem(item.number, item.type).length} ta faol buyurtma
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">{getWaiterName(item.waiterId)}</td>
                        <td className="relative whitespace-nowrap px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEditItem(item)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleItemStatus(item)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Statusni o'zgartirish
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteItem(item.id, item.type, item.floor)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                O'chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Seating Types Tab */}
        <TabsContent value="types">
          <div className="mb-6 space-y-4">
            {/* Actions toolbar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Joy turlari</h2>
              <Button onClick={() => setIsAddingType(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Yangi tur qo'shish
              </Button>
            </div>

            {/* Statistics cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(itemsByType).map(([typeName, stats]) => (
                <Card key={`type-${typeName}`} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{typeName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Jami</div>
                    <div className="mt-2 flex items-center text-sm">
                      <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                      <div>
                        {stats.available} ta bo'sh
                        <span className="ml-2 text-muted-foreground">
                          ({((stats.available / stats.total) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm">
                      <div className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                      <div>
                        {stats.occupied} ta band
                        <span className="ml-2 text-muted-foreground">
                          ({((stats.occupied / stats.total) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm">
                      <div className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
                      <div>
                        {stats.reserved} ta rezerv qilingan
                        <span className="ml-2 text-muted-foreground">
                          ({((stats.reserved / stats.total) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <div className="h-1 w-full bg-gray-200">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(stats.available / stats.total) * 100}%`, float: "left" }}
                    ></div>
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(stats.occupied / stats.total) * 100}%`, float: "left" }}
                    ></div>
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${(stats.reserved / stats.total) * 100}%`, float: "left" }}
                    ></div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Seating types table */}
            {seatingTypes.length === 0 ? (
              <div className="text-center text-muted-foreground">Joy turlari topilmadi</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Nomi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Standart sig'imi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Soni
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Amallar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {seatingTypes.map((type) => (
                      <tr key={type.id}>
                        <td className="whitespace-nowrap px-6 py-4 font-medium">{type.name}</td>
                        <td className="whitespace-nowrap px-6 py-4">{type.defaultCapacity}</td>
                        <td className="whitespace-nowrap px-6 py-4">{type.count}</td>
                        <td className="relative whitespace-nowrap px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedType(type)
                                  setNewTypeName(type.name)
                                  setNewTypeCapacity(type.defaultCapacity)
                                  setIsEditingType(true)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteType(type.id, type.name)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                O'chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Type Modal */}
          {isAddingType && (
            <Dialog open={isAddingType} onOpenChange={setIsAddingType}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Yangi tur qo'shish</DialogTitle>
                  <DialogDescription>Joy turini qo'shish uchun ma'lumotlarni kiriting</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAddType()
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-type-name" className="text-right">
                        Nomi
                      </Label>
                      <Input
                        id="new-type-name"
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-type-capacity" className="text-right">
                        Standart sig'imi
                      </Label>
                      <Input
                        id="new-type-capacity"
                        type="number"
                        min="1"
                        value={newTypeCapacity}
                        onChange={(e) => setNewTypeCapacity(Number.parseInt(e.target.value) || 1)}
                        className="col-span-3"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Qo'shilmoqda...
                        </>
                      ) : (
                        "Qo'shish"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Edit Type Modal */}
          {isEditingType && selectedType && (
            <Dialog open={isEditingType} onOpenChange={setIsEditingType}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Turni tahrirlash</DialogTitle>
                  <DialogDescription>Joy turini tahrirlash uchun ma'lumotlarni kiriting</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleEditType()
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-type-name" className="text-right">
                        Nomi
                      </Label>
                      <Input
                        id="new-type-name"
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-type-capacity" className="text-right">
                        Standart sig'imi
                      </Label>
                      <Input
                        id="new-type-capacity"
                        type="number"
                        min="1"
                        value={newTypeCapacity}
                        onChange={(e) => setNewTypeCapacity(Number.parseInt(e.target.value) || 1)}
                        className="col-span-3"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Yangilanmoqda...
                        </>
                      ) : (
                        "Yangilash"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Floors Tab */}
        <TabsContent value="floors">
          <div className="mb-6 space-y-4">
            {/* Actions toolbar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Qavatlar</h2>
              <Button onClick={() => setIsAddingFloor(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Yangi qavat qo'shish
              </Button>
            </div>

            {/* Floors table */}
            {floors.length === 0 ? (
              <div className="text-center text-muted-foreground">Qavatlar topilmadi</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Raqami
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Nomi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Tavsifi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Soni
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Amallar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {floors.map((floor) => (
                      <tr key={floor.id}>
                        <td className="whitespace-nowrap px-6 py-4 font-medium">{floor.number}</td>
                        <td className="whitespace-nowrap px-6 py-4">{floor.name || `${floor.number}-qavat`}</td>
                        <td className="whitespace-nowrap px-6 py-4">{floor.description}</td>
                        <td className="whitespace-nowrap px-6 py-4">{floor.count}</td>
                        <td className="relative whitespace-nowrap px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedFloor(floor)
                                  setNewFloorNumber(floor.number)
                                  setNewFloorName(floor.name)
                                  setNewFloorDescription(floor.description || "")
                                  setIsEditingFloor(true)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteFloor(floor.id, floor.number)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                O'chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Floor Modal */}
          {isAddingFloor && (
            <Dialog open={isAddingFloor} onOpenChange={setIsAddingFloor}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Yangi qavat qo'shish</DialogTitle>
                  <DialogDescription>Qavatni qo'shish uchun ma'lumotlarni kiriting</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAddFloor()
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-floor-number" className="text-right">
                        Raqami
                      </Label>
                      <Input
                        id="new-floor-number"
                        type="number"
                        min="1"
                        value={newFloorNumber}
                        onChange={(e) => setNewFloorNumber(Number.parseInt(e.target.value) || 1)}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-floor-name" className="text-right">
                        Nomi
                      </Label>
                      <Input
                        id="new-floor-name"
                        type="text"
                        value={newFloorName}
                        onChange={(e) => setNewFloorName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-floor-description" className="text-right">
                        Tavsifi
                      </Label>
                      <Input
                        id="new-floor-description"
                        type="text"
                        value={newFloorDescription}
                        onChange={(e) => setNewFloorDescription(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Qo'shilmoqda...
                        </>
                      ) : (
                        "Qo'shish"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Edit Floor Modal */}
          {isEditingFloor && selectedFloor && (
            <Dialog open={isEditingFloor} onOpenChange={setIsEditingFloor}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Qavatni tahrirlash</DialogTitle>
                  <DialogDescription>Qavatni tahrirlash uchun ma'lumotlarni kiriting</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleEditFloor()
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-floor-number" className="text-right">
                        Raqami
                      </Label>
                      <Input
                        id="new-floor-number"
                        type="number"
                        min="1"
                        value={newFloorNumber}
                        onChange={(e) => setNewFloorNumber(Number.parseInt(e.target.value) || 1)}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-floor-name" className="text-right">
                        Nomi
                      </Label>
                      <Input
                        id="new-floor-name"
                        type="text"
                        value={newFloorName}
                        onChange={(e) => setNewFloorName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="new-floor-description" className="text-right">
                        Tavsifi
                      </Label>
                      <Input
                        id="new-floor-description"
                        type="text"
                        value={newFloorDescription}
                        onChange={(e) => setNewFloorDescription(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Yangilanmoqda...
                        </>
                      ) : (
                        "Yangilash"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Item Modal */}
      {isEditingItem && selectedItem && (
        <Dialog open={isEditingItem} onOpenChange={setIsEditingItem}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Elementni tahrirlash</DialogTitle>
              <DialogDescription>Joy elementini tahrirlash uchun ma'lumotlarni kiriting</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleUpdateItem()
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-item-number" className="text-right">
                    Raqami
                  </Label>
                  <Input
                    id="new-item-number"
                    type="number"
                    min="1"
                    value={newItemNumber}
                    onChange={(e) => setNewItemNumber(Number.parseInt(e.target.value) || 1)}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-item-seats" className="text-right">
                    Sig'imi
                  </Label>
                  <Input
                    id="new-item-seats"
                    type="number"
                    min="1"
                    value={newItemSeats}
                    onChange={(e) => setNewItemSeats(Number.parseInt(e.target.value) || 1)}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-item-type" className="text-right">
                    Joy turi
                  </Label>
                  <Select value={newItemType} onValueChange={setNewItemType}>
                    <SelectTrigger id="new-item-type" className="col-span-3">
                      <SelectValue placeholder="Joy turini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {seatingTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name} (sig'imi: {type.defaultCapacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-item-status" className="text-right">
                    Status
                  </Label>
                  <Select value={newItemStatus} onValueChange={setNewItemStatus}>
                    <SelectTrigger id="new-item-status" className="col-span-3">
                      <SelectValue placeholder="Statusni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Bo'sh</SelectItem>
                      <SelectItem value="occupied">Band</SelectItem>
                      <SelectItem value="reserved">Rezerv qilingan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-item-floor" className="text-right">
                    Qavat
                  </Label>
                  <Select
                    value={newItemFloor.toString()}
                    onValueChange={(value) => setNewItemFloor(Number.parseInt(value))}
                  >
                    <SelectTrigger id="new-item-floor" className="col-span-3">
                      <SelectValue placeholder="Qavatni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {floors.map((floor) => (
                        <SelectItem key={floor.id} value={floor.number.toString()}>
                          {floor.name || `${floor.number}-qavat`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-item-waiter" className="text-right">
                    Ofitsiant
                  </Label>
                  <Select value={newItemWaiterId || "none"} onValueChange={setNewItemWaiterId}>
                    <SelectTrigger id="new-item-waiter" className="col-span-3">
                      <SelectValue placeholder="Ofitsiantni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Belgilanmagan</SelectItem>
                      {waiters.map((waiter) => (
                        <SelectItem key={waiter.id} value={waiter.id}>
                          {waiter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Yangilanmoqda...
                    </>
                  ) : (
                    "Yangilash"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

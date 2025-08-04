"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, getDocs, where, type Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import { useAuth } from "./admin-auth-provider"
import * as XLSX from "xlsx"
import {
  Loader2,
  AlertTriangle,
  Calendar,
  Download,
  User,
  Search,
  Plus,
  Minus,
  Edit,
  History,
  TableIcon,
  Home,
  Building2,
} from "lucide-react"

// Types
interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
  category?: string
  categoryId?: string
}

interface OrderModification {
  id: string
  orderId: string
  modifiedAt: Timestamp
  modifiedAtString?: string
  modifiedBy: string
  modifiedByName: string
  modificationType: "add" | "remove" | "edit"
  tableNumber?: number | null
  roomNumber?: number | null
  floor?: number
  addedItems?: OrderItem[]
  removedItems?: OrderItem[]
  editedItems?: {
    before: OrderItem
    after: OrderItem
  }[]
  notes?: string
  allModifications?: OrderModification[]
}

export function OrderModificationsPage() {
  const [modifications, setModifications] = useState<OrderModification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModification, setSelectedModification] = useState<OrderModification | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>("")
  const [waiterFilter, setWaiterFilter] = useState<string>("all")
  const [orderIdFilter, setOrderIdFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const { toast } = useToast()
  const { userRole } = useAuth()

  // Check if user is admin
  useEffect(() => {
    if (userRole !== "admin" && userRole !== "manager") {
      toast({
        title: "Ruxsat yo'q",
        description: "Bu sahifaga faqat admin va menejerlar kira oladi",
        variant: "destructive",
      })
      window.location.href = "/admin/dashboard"
    }
  }, [userRole, toast])

  // Fetch waiters
  useEffect(() => {
    const fetchWaiters = async () => {
      try {
        const waitersQuery = query(collection(db, "users"), where("role", "==", "waiter"))
        const waitersSnapshot = await getDocs(waitersQuery)
        const waitersList: { id: string; name: string }[] = []

        waitersSnapshot.forEach((doc) => {
          const data = doc.data()
          if (data.name) {
            waitersList.push({ id: doc.id, name: data.name })
          }
        })

        setWaiters(waitersList)
      } catch (error) {
        console.error("Error fetching waiters:", error)
      }
    }

    fetchWaiters()
  }, [])

  // Fetch order modifications
  useEffect(() => {
    const fetchModifications = async () => {
      setLoading(true)
      setError(null)

      try {
        const modificationsQuery = query(collection(db, "orderModifications"), orderBy("modifiedAt", "desc"))
        const snapshot = await getDocs(modificationsQuery)

        const modificationsList: OrderModification[] = []

        snapshot.forEach((doc) => {
          const data = doc.data()

          // Validate required fields
          if (!data.orderId || !data.modifiedBy || !data.modificationType) {
            console.warn("Invalid modification data:", doc.id, data)
            return
          }

          const modification: OrderModification = {
            id: doc.id,
            orderId: data.orderId || "",
            modifiedAt: data.modifiedAt,
            modifiedAtString: data.modifiedAtString,
            modifiedBy: data.modifiedBy || "",
            modifiedByName: data.modifiedByName || "Noma'lum ofitsiant",
            modificationType: data.modificationType || "add",
            tableNumber: data.tableNumber,
            roomNumber: data.roomNumber,
            floor: data.floor,
            addedItems: Array.isArray(data.addedItems) ? data.addedItems.filter((item) => item && item.name) : [],
            removedItems: Array.isArray(data.removedItems) ? data.removedItems.filter((item) => item && item.name) : [],
            editedItems: Array.isArray(data.editedItems)
              ? data.editedItems.filter(
                  (item) => item && item.before && item.after && item.before.name && item.after.name,
                )
              : [],
            notes: data.notes || "",
          }

          modificationsList.push(modification)
        })

        setModifications(modificationsList)
        setLoading(false)
      } catch (err: any) {
        console.error("Error fetching order modifications:", err)
        setError("O'zgartirishlarni yuklashda xatolik: " + err.message)
        setLoading(false)
      }
    }

    fetchModifications()
  }, [])

  // Format date for display
  const formatDate = (timestamp: Timestamp | undefined, dateString?: string) => {
    if (dateString) {
      return dateString
    }

    if (!timestamp) return "Sana noma'lum"

    try {
      if (typeof timestamp === "object" && timestamp !== null) {
        if (timestamp.toDate && typeof timestamp.toDate === "function") {
          return new Intl.DateTimeFormat("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(timestamp.toDate())
        }

        if ("seconds" in timestamp && typeof timestamp.seconds === "number") {
          const milliseconds = timestamp.seconds * 1000 + ((timestamp as any).nanoseconds || 0) / 1000000
          return new Intl.DateTimeFormat("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date(milliseconds))
        }
      }

      if (timestamp instanceof Date) {
        return new Intl.DateTimeFormat("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(timestamp)
      }

      if (typeof timestamp === "number") {
        return new Intl.DateTimeFormat("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(timestamp * 1000))
      }

      if (typeof timestamp === "string") {
        const num = Number(timestamp)
        if (!isNaN(num)) {
          return new Intl.DateTimeFormat("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date(num))
        } else {
          const date = new Date(timestamp)
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat("uz-UZ", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(date)
          }
        }
      }

      return "Sana noma'lum"
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Sana xato"
    }
  }

  // Get modification type text
  const getModificationTypeText = (type: string | undefined) => {
    switch (type) {
      case "add":
        return "Qo'shildi"
      case "remove":
        return "O'chirildi"
      case "edit":
        return "Tahrirlandi"
      default:
        return "O'zgartirildi"
    }
  }

  // Get modification type color
  const getModificationTypeColor = (type: string | undefined) => {
    switch (type) {
      case "add":
        return "bg-green-100 text-green-800 border-green-300"
      case "remove":
        return "bg-red-100 text-red-800 border-red-300"
      case "edit":
        return "bg-blue-100 text-blue-800 border-blue-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  // Handle view details
  const handleViewDetails = (modification: OrderModification) => {
    setSelectedModification(modification)
    setIsDetailsOpen(true)
  }

  // Safe item rendering helper
  const renderItemSafely = (item: OrderItem | null | undefined, prefix = "") => {
    if (!item || !item.name) {
      return <span className="text-muted-foreground">Noma'lum taom</span>
    }

    return (
      <span>
        {prefix}
        {item.quantity || 0}x {item.name}
        {item.price ? ` (${formatCurrency(item.price)})` : ""}
      </span>
    )
  }

  // Filter modifications based on filters
  const filteredModifications = useMemo(() => {
    return modifications.filter((modification) => {
      if (!modification) return false

      // Filter by date
      let dateMatch = true
      if (dateFilter) {
        try {
          let modDate = ""

          if (modification.modifiedAtString) {
            const dateParts = modification.modifiedAtString.split(/[\s,.]+/)
            if (dateParts.length >= 3) {
              const dateOnly = dateParts[0]
              const [day, month, year] = dateOnly.split(".")
              if (day && month && year) {
                modDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              }
            }
          } else if (modification.modifiedAt) {
            if (modification.modifiedAt.toDate && typeof modification.modifiedAt.toDate === "function") {
              const date = modification.modifiedAt.toDate()
              modDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            } else if ("seconds" in modification.modifiedAt) {
              const date = new Date(modification.modifiedAt.seconds * 1000)
              modDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            }
          }

          dateMatch = modDate === dateFilter
        } catch (error) {
          console.error("Error filtering by date:", error)
          dateMatch = false
        }
      }

      // Filter by waiter
      const waiterMatch = waiterFilter === "all" || modification.modifiedBy === waiterFilter

      // Filter by order ID
      const orderIdMatch = !orderIdFilter || (modification.orderId && modification.orderId.includes(orderIdFilter))

      // Filter by modification type
      const typeMatch = typeFilter === "all" || modification.modificationType === typeFilter

      // Filter by search query
      let searchMatch = true
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase()

        const addedItemsMatch =
          modification.addedItems?.some((item) => item && item.name && item.name.toLowerCase().includes(lowerQuery)) ||
          false

        const removedItemsMatch =
          modification.removedItems?.some(
            (item) => item && item.name && item.name.toLowerCase().includes(lowerQuery),
          ) || false

        const editedItemsMatch =
          modification.editedItems?.some(
            (item) =>
              item &&
              item.before &&
              item.after &&
              ((item.before.name && item.before.name.toLowerCase().includes(lowerQuery)) ||
                (item.after.name && item.after.name.toLowerCase().includes(lowerQuery))),
          ) || false

        const waiterNameMatch =
          modification.modifiedByName && modification.modifiedByName.toLowerCase().includes(lowerQuery)
        const orderIdMatch = modification.orderId && modification.orderId.toLowerCase().includes(lowerQuery)
        const notesMatch = modification.notes && modification.notes.toLowerCase().includes(lowerQuery)

        searchMatch =
          addedItemsMatch || removedItemsMatch || editedItemsMatch || waiterNameMatch || orderIdMatch || notesMatch
      }

      // Filter by tab
      let tabMatch = true
      if (activeTab !== "all") {
        tabMatch = modification.modificationType === activeTab
      }

      return dateMatch && waiterMatch && orderIdMatch && typeMatch && searchMatch && tabMatch
    })
  }, [modifications, dateFilter, waiterFilter, orderIdFilter, typeFilter, searchQuery, activeTab])

  // Group modifications by orderId
  const groupedModifications = useMemo(() => {
    const groups: Record<string, OrderModification[]> = {}

    filteredModifications.forEach((mod) => {
      if (!mod || !mod.orderId) return

      if (!groups[mod.orderId]) {
        groups[mod.orderId] = []
      }
      groups[mod.orderId].push(mod)
    })

    // Sort modifications within each group by time
    Object.keys(groups).forEach((orderId) => {
      groups[orderId].sort((a, b) => {
        if (a.modifiedAtString && b.modifiedAtString) {
          return b.modifiedAtString.localeCompare(a.modifiedAtString)
        }

        if (a.modifiedAt && b.modifiedAt) {
          if (a.modifiedAt.toDate && b.modifiedAt.toDate) {
            return b.modifiedAt.toDate().getTime() - a.modifiedAt.toDate().getTime()
          }
          if ("seconds" in a.modifiedAt && "seconds" in b.modifiedAt) {
            return b.modifiedAt.seconds - a.modifiedAt.seconds
          }
        }

        return 0
      })
    })

    return groups
  }, [filteredModifications])

  // Count modifications by type
  const addCount = modifications.filter((m) => m && m.modificationType === "add").length
  const removeCount = modifications.filter((m) => m && m.modificationType === "remove").length
  const editCount = modifications.filter((m) => m && m.modificationType === "edit").length

  // Export to Excel
  const exportToExcel = () => {
    try {
      const exportData = filteredModifications
        .map((mod) => {
          if (!mod) return null

          const modifiedDate = formatDate(mod.modifiedAt, mod.modifiedAtString)
          const addedItemsCount = mod.addedItems?.length || 0
          const removedItemsCount = mod.removedItems?.length || 0
          const editedItemsCount = mod.editedItems?.length || 0

          const addedItemsDetails =
            mod.addedItems
              ?.map((item) =>
                item && item.name
                  ? `${item.quantity || 0}x ${item.name} (${formatCurrency(item.price || 0)})`
                  : "Noma'lum taom",
              )
              .join(", ") || ""

          const removedItemsDetails =
            mod.removedItems
              ?.map((item) =>
                item && item.name
                  ? `${item.quantity || 0}x ${item.name} (${formatCurrency(item.price || 0)})`
                  : "Noma'lum taom",
              )
              .join(", ") || ""

          const editedItemsDetails =
            mod.editedItems
              ?.map((item) =>
                item && item.before && item.after && item.before.name && item.after.name
                  ? `${item.before.quantity || 0}x ${item.before.name} → ${item.after.quantity || 0}x ${item.after.name}`
                  : "Noma'lum o'zgartirish",
              )
              .join(", ") || ""

          return {
            ID: mod.id,
            "Buyurtma ID": mod.orderId || "",
            "O'zgartirilgan vaqt": modifiedDate,
            Ofitsiant: mod.modifiedByName || "Noma'lum",
            "O'zgartirish turi": getModificationTypeText(mod.modificationType),
            "Stol raqami": mod.tableNumber || "-",
            "Xona raqami": mod.roomNumber || "-",
            Qavat: mod.floor || "-",
            "Qo'shilgan taomlar soni": addedItemsCount,
            "O'chirilgan taomlar soni": removedItemsCount,
            "Tahrirlangan taomlar soni": editedItemsCount,
            "Qo'shilgan taomlar": addedItemsDetails,
            "O'chirilgan taomlar": removedItemsDetails,
            "Tahrirlangan taomlar": editedItemsDetails,
            Izoh: mod.notes || "-",
          }
        })
        .filter(Boolean)

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Buyurtma o'zgartirishlari")

      const currentDate = new Date()
      const formattedDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`
      const fileName = dateFilter
        ? `Buyurtma_ozgartirishlari_${dateFilter}.xlsx`
        : `Buyurtma_ozgartirishlari_${formattedDate}.xlsx`

      XLSX.writeFile(workbook, fileName)

      toast({
        title: "Eksport qilindi",
        description: "O'zgartirishlar tarixi Excel formatida eksport qilindi",
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

  // Render modifications list
  const renderModificationsList = () => {
    if (loading) {
      return (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )
    }

    if (filteredModifications.length === 0) {
      return (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed">
          <AlertTriangle className="mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">O'zgartirishlar tarixi topilmadi</p>
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {Object.entries(groupedModifications).map(([orderId, mods]) => {
          if (!mods || mods.length === 0) return null

          const firstMod = mods[0]
          if (!firstMod) return null

          const tableNumber = firstMod.tableNumber
          const roomNumber = firstMod.roomNumber
          const floor = firstMod.floor

          const addCount = mods.filter((m) => m && m.modificationType === "add").length
          const removeCount = mods.filter((m) => m && m.modificationType === "remove").length
          const editCount = mods.filter((m) => m && m.modificationType === "edit").length

          const latestDate = formatDate(mods[0]?.modifiedAt, mods[0]?.modifiedAtString)
          const oldestDate = formatDate(mods[mods.length - 1]?.modifiedAt, mods[mods.length - 1]?.modifiedAtString)

          const waiters = [...new Set(mods.map((m) => m?.modifiedByName).filter(Boolean))]

          return (
            <Card key={orderId} className="overflow-hidden hover:shadow-md transition-all">
              <CardHeader className="pb-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">Buyurtma: {orderId.substring(0, 8)}...</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{mods.length} ta o'zgartirish</div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <div className="mb-3">
                  <div className="text-sm text-muted-foreground">
                    {waiters.length > 1 ? (
                      <span>Ofitsiantlar: {waiters.join(", ")}</span>
                    ) : (
                      <span>Ofitsiant: {waiters[0] || "Noma'lum"}</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Vaqt oralig'i: {oldestDate} - {latestDate}
                  </div>
                </div>

                <div className="mb-3 text-sm">
                  {tableNumber && (
                    <div className="flex items-center gap-1 mb-1">
                      <TableIcon className="h-4 w-4 text-muted-foreground" />
                      Stol #{tableNumber}
                    </div>
                  )}
                  {roomNumber && (
                    <div className="flex items-center gap-1 mb-1">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      Xona #{roomNumber}
                    </div>
                  )}
                  {floor && (
                    <div className="flex items-center gap-1 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {floor}-qavat
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mb-3">
                  {addCount > 0 && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      {addCount} ta qo'shilgan
                    </Badge>
                  )}
                  {removeCount > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                      {removeCount} ta o'chirilgan
                    </Badge>
                  )}
                  {editCount > 0 && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                      {editCount} ta tahrirlangan
                    </Badge>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-sm font-medium mb-2">So'nggi o'zgartirishlar:</div>
                  <div className="space-y-2">
                    {mods.slice(0, 3).map((mod, index) => {
                      if (!mod) return null

                      return (
                        <div
                          key={index}
                          className={`p-2 rounded-md text-sm ${
                            mod.modificationType === "add"
                              ? "bg-green-50"
                              : mod.modificationType === "remove"
                                ? "bg-red-50"
                                : "bg-blue-50"
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{getModificationTypeText(mod.modificationType)}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(mod.modifiedAt, mod.modifiedAtString).split(" ")[1] || ""}
                            </span>
                          </div>

                          {mod.modificationType === "add" && mod.addedItems && mod.addedItems.length > 0 && (
                            <div className="text-xs mt-1">
                              {mod.addedItems.slice(0, 2).map((item, i) => (
                                <div key={i}>
                                  {item && item.name ? `${item.quantity || 0}x ${item.name}` : "Noma'lum taom"}
                                </div>
                              ))}
                              {mod.addedItems.length > 2 && <div>+{mod.addedItems.length - 2} ta boshqa...</div>}
                            </div>
                          )}

                          {mod.modificationType === "remove" && mod.removedItems && mod.removedItems.length > 0 && (
                            <div className="text-xs mt-1">
                              {mod.removedItems.slice(0, 2).map((item, i) => (
                                <div key={i}>
                                  {item && item.name ? `${item.quantity || 0}x ${item.name}` : "Noma'lum taom"}
                                </div>
                              ))}
                              {mod.removedItems.length > 2 && <div>+{mod.removedItems.length - 2} ta boshqa...</div>}
                            </div>
                          )}

                          {mod.modificationType === "edit" && mod.editedItems && mod.editedItems.length > 0 && (
                            <div className="text-xs mt-1">
                              {mod.editedItems.slice(0, 2).map((item, i) => (
                                <div key={i}>
                                  {item && item.before && item.after && item.before.name && item.after.name
                                    ? `${item.before.name} → ${item.after.name}`
                                    : "Noma'lum o'zgartirish"}
                                </div>
                              ))}
                              {mod.editedItems.length > 2 && <div>+{mod.editedItems.length - 2} ta boshqa...</div>}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {mods.length > 3 && (
                      <div className="text-xs text-center text-muted-foreground">
                        +{mods.length - 3} ta boshqa o'zgartirish
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleViewDetails(mods[0])} className="flex-1">
                    Batafsil
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedModification({
                        ...mods[0],
                        allModifications: mods,
                      } as any)
                      setIsDetailsOpen(true)
                    }}
                    className="flex-1"
                  >
                    Barcha o'zgartirishlar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // Render modification details
  const renderModificationDetails = (modification: OrderModification) => {
    if (!modification) return null

    // Show all modifications if available
    if ((modification as any).allModifications) {
      const allMods = (modification as any).allModifications as OrderModification[]

      return (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Buyurtma ID</h4>
              <p className="font-medium">{modification.orderId || "Noma'lum"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">O'zgartirishlar soni</h4>
              <p className="font-medium">{allMods.length}</p>
            </div>
            {modification.tableNumber && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Stol raqami</h4>
                <p className="font-medium">#{modification.tableNumber}</p>
              </div>
            )}
            {modification.roomNumber && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Xona raqami</h4>
                <p className="font-medium">#{modification.roomNumber}</p>
              </div>
            )}
            {modification.floor && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Qavat</h4>
                <p className="font-medium">{modification.floor}-qavat</p>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {allMods.map((mod, index) => {
                if (!mod) return null

                return (
                  <Card
                    key={index}
                    className={`p-3 ${
                      mod.modificationType === "add"
                        ? "bg-green-50 border-green-200"
                        : mod.modificationType === "remove"
                          ? "bg-red-50 border-red-200"
                          : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline" className={getModificationTypeColor(mod.modificationType)}>
                        {getModificationTypeText(mod.modificationType)}
                      </Badge>
                      <div className="text-xs">{formatDate(mod.modifiedAt, mod.modifiedAtString)}</div>
                    </div>

                    <div className="text-sm mb-2">
                      <span className="font-medium">Ofitsiant:</span> {mod.modifiedByName || "Noma'lum"}
                    </div>

                    {mod.modificationType === "add" && mod.addedItems && mod.addedItems.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <div className="text-sm font-medium">Qo'shilgan taomlar:</div>
                        {mod.addedItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item && item.name ? `${item.quantity || 0}x ${item.name}` : "Noma'lum taom"}</span>
                            <span>
                              {item && item.price ? formatCurrency((item.price || 0) * (item.quantity || 0)) : "0 so'm"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {mod.modificationType === "remove" && mod.removedItems && mod.removedItems.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <div className="text-sm font-medium">O'chirilgan taomlar:</div>
                        {mod.removedItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item && item.name ? `${item.quantity || 0}x ${item.name}` : "Noma'lum taom"}</span>
                            <span>
                              {item && item.price ? formatCurrency((item.price || 0) * (item.quantity || 0)) : "0 so'm"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {mod.modificationType === "edit" && mod.editedItems && mod.editedItems.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="text-sm font-medium">Tahrirlangan taomlar:</div>
                        {mod.editedItems.map((item, i) => {
                          if (!item || !item.before || !item.after) return null

                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>
                                  {item.before.name
                                    ? `${item.before.quantity || 0}x ${item.before.name}`
                                    : "Noma'lum taom"}
                                </span>
                                <span>
                                  {item.before.price
                                    ? formatCurrency((item.before.price || 0) * (item.before.quantity || 0))
                                    : "0 so'm"}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm text-blue-600">
                                <span>
                                  →{" "}
                                  {item.after.name
                                    ? `${item.after.quantity || 0}x ${item.after.name}`
                                    : "Noma'lum taom"}
                                </span>
                                <span>
                                  {item.after.price
                                    ? formatCurrency((item.after.price || 0) * (item.after.quantity || 0))
                                    : "0 so'm"}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {mod.notes && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Izoh:</span> {mod.notes}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )
    }

    // Single modification details
    return (
      <div className="mt-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">O'zgartirish vaqti</h4>
            <p className="font-medium">{formatDate(modification.modifiedAt, modification.modifiedAtString)}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">O'zgartirish turi</h4>
            <Badge variant="outline" className={getModificationTypeColor(modification.modificationType)}>
              {getModificationTypeText(modification.modificationType)}
            </Badge>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Buyurtma ID</h4>
            <p className="font-medium">{modification.orderId || "Noma'lum"}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Ofitsiant</h4>
            <p className="font-medium">{modification.modifiedByName || "Noma'lum"}</p>
          </div>
          {modification.tableNumber && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Stol raqami</h4>
              <p className="font-medium">#{modification.tableNumber}</p>
            </div>
          )}
          {modification.roomNumber && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Xona raqami</h4>
              <p className="font-medium">#{modification.roomNumber}</p>
            </div>
          )}
          {modification.floor && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Qavat</h4>
              <p className="font-medium">{modification.floor}-qavat</p>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <ScrollArea className="h-[300px] pr-4">
          {modification.modificationType === "add" && modification.addedItems && modification.addedItems.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <Plus className="h-4 w-4 text-green-600" />
                Qo'shilgan taomlar
              </h4>
              <div className="space-y-2">
                {modification.addedItems.map((item, index) => {
                  if (!item || !item.name) return null

                  return (
                    <Card key={index} className="p-3 bg-green-50 border-green-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity || 0} x {formatCurrency(item.price || 0)} ={" "}
                            {formatCurrency((item.price || 0) * (item.quantity || 0))}
                          </div>
                          {item.notes && <div className="text-xs text-muted-foreground mt-1">Izoh: {item.notes}</div>}
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          Qo'shilgan
                        </Badge>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {modification.modificationType === "remove" &&
            modification.removedItems &&
            modification.removedItems.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Minus className="h-4 w-4 text-red-600" />
                  O'chirilgan taomlar
                </h4>
                <div className="space-y-2">
                  {modification.removedItems.map((item, index) => {
                    if (!item || !item.name) return null

                    return (
                      <Card key={index} className="p-3 bg-red-50 border-red-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.quantity || 0} x {formatCurrency(item.price || 0)} ={" "}
                              {formatCurrency((item.price || 0) * (item.quantity || 0))}
                            </div>
                            {item.notes && <div className="text-xs text-muted-foreground mt-1">Izoh: {item.notes}</div>}
                          </div>
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                            O'chirilgan
                          </Badge>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

          {modification.modificationType === "edit" &&
            modification.editedItems &&
            modification.editedItems.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Edit className="h-4 w-4 text-blue-600" />
                  Tahrirlangan taomlar
                </h4>
                <div className="space-y-4">
                  {modification.editedItems.map((item, index) => {
                    if (!item || !item.before || !item.after || !item.before.name || !item.after.name) return null

                    return (
                      <div key={index} className="space-y-1">
                        <Card className="p-3 bg-red-50 border-red-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{item.before.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.before.quantity || 0} x {formatCurrency(item.before.price || 0)} ={" "}
                                {formatCurrency((item.before.price || 0) * (item.before.quantity || 0))}
                              </div>
                              {item.before.notes && (
                                <div className="text-xs text-muted-foreground mt-1">Izoh: {item.before.notes}</div>
                              )}
                            </div>
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                              Oldingi
                            </Badge>
                          </div>
                        </Card>

                        <div className="flex justify-center">
                          <Edit className="h-4 w-4 text-blue-600" />
                        </div>

                        <Card className="p-3 bg-green-50 border-green-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{item.after.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.after.quantity || 0} x {formatCurrency(item.after.price || 0)} ={" "}
                                {formatCurrency((item.after.price || 0) * (item.after.quantity || 0))}
                              </div>
                              {item.after.notes && (
                                <div className="text-xs text-muted-foreground mt-1">Izoh: {item.after.notes}</div>
                              )}
                            </div>
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                              Yangi
                            </Badge>
                          </div>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          {modification.notes && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Izoh</h4>
              <p className="text-sm">{modification.notes}</p>
            </div>
          )}
        </ScrollArea>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Xatolik</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b bg-white p-4">
        <h1 className="text-2xl font-bold">Buyurtma o'zgartirishlari tarixi</h1>
        <p className="text-muted-foreground">Ofitsiantlar tomonidan qilingan barcha o'zgartirishlar</p>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jami o'zgartirishlar</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modifications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sana bo'yicha</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-8" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ofitsiant bo'yicha</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Select value={waiterFilter} onValueChange={(value) => setWaiterFilter(value)}>
              <SelectTrigger className="h-8">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">O'zgartirish turi</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Tur tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha turlar</SelectItem>
                <SelectItem value="add">Qo'shilgan</SelectItem>
                <SelectItem value="remove">O'chirilgan</SelectItem>
                <SelectItem value="edit">Tahrirlangan</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <div className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                Barchasi{" "}
                <Badge variant="secondary" className="ml-1">
                  {modifications.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="add">
                Qo'shilgan{" "}
                <Badge variant="secondary" className="ml-1">
                  {addCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="remove">
                O'chirilgan{" "}
                <Badge variant="secondary" className="ml-1">
                  {removeCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="edit">
                Tahrirlangan{" "}
                <Badge variant="secondary" className="ml-1">
                  {editCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px] md:w-[300px]"
              />
            </div>
            <Button onClick={exportToExcel} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Excel ga eksport
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Buyurtma ID bo'yicha qidirish"
            value={orderIdFilter}
            onChange={(e) => setOrderIdFilter(e.target.value)}
            className="max-w-md"
          />
        </div>

        {renderModificationsList()}
      </div>

      {/* Modification Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">O'zgartirish tafsilotlari</DialogTitle>
          </DialogHeader>
          {selectedModification && renderModificationDetails(selectedModification)}
        </DialogContent>
      </Dialog>
    </div>
  )
}

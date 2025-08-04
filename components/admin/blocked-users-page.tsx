"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Ban,
  UserX,
  Clock,
  User,
  Trash2,
  Search,
  Calendar,
  CheckCircle,
  Filter,
  RotateCcw,
  Users,
  ShieldCheck,
  Timer,
  Smartphone,
  Phone,
  Monitor,
  Loader2,
} from "lucide-react"
import { formatDateTime } from "@/lib/date-utils"

interface BlockedItem {
  id: string
  type: "user" | "device"
  customerPhone?: string
  customerName?: string
  deviceId?: string
  blockedAt: Date | any
  blockedBy: string
  blockedByName: string
  reason?: string
  orderId?: string
  orderType?: string
  autoUnblockAt?: Date | any
  unblocked: boolean
  unblockedAt?: Date | any
  unblockedBy?: string
}

export function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedItem[]>([])
  const [blockedDevices, setBlockedDevices] = useState<BlockedItem[]>([])
  const [allBlockedItems, setAllBlockedItems] = useState<BlockedItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedItem, setSelectedItem] = useState<BlockedItem | null>(null)
  const [isUnblockDialogOpen, setIsUnblockDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkUnblockDialogOpen, setIsBulkUnblockDialogOpen] = useState(false)
  const [itemToUnblock, setItemToUnblock] = useState<BlockedItem | null>(null)
  const [itemToDelete, setItemToDelete] = useState<BlockedItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filterBy, setFilterBy] = useState<string>("all")
  const [blockTypeFilter, setBlockTypeFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const { toast } = useToast()

  // Fetch blocked users
  useEffect(() => {
    const blockedUsersQuery = query(collection(db, "blockedUsers"), orderBy("blockedAt", "desc"))

    const unsubscribe = onSnapshot(blockedUsersQuery, (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        type: "user" as const,
        ...doc.data(),
      })) as BlockedItem[]
      setBlockedUsers(users)
    })

    return () => unsubscribe()
  }, [])

  // Fetch blocked devices
  useEffect(() => {
    const blockedDevicesQuery = query(collection(db, "blockedDevices"), orderBy("blockedAt", "desc"))

    const unsubscribe = onSnapshot(blockedDevicesQuery, (snapshot) => {
      const devices = snapshot.docs.map((doc) => ({
        id: doc.id,
        type: "device" as const,
        ...doc.data(),
      })) as BlockedItem[]
      setBlockedDevices(devices)
    })

    return () => unsubscribe()
  }, [])

  // Combine and sort all blocked items
  useEffect(() => {
    const combined = [...blockedUsers, ...blockedDevices].sort((a, b) => {
      const dateA = new Date(a.blockedAt?.toDate?.() || a.blockedAt)
      const dateB = new Date(b.blockedAt?.toDate?.() || b.blockedAt)
      return dateB.getTime() - dateA.getTime()
    })
    setAllBlockedItems(combined)
  }, [blockedUsers, blockedDevices])

  // Auto-unblock expired items
  useEffect(() => {
    const checkExpiredBlocks = () => {
      const now = new Date()
      allBlockedItems.forEach(async (item) => {
        if (
          !item.unblocked &&
          item.autoUnblockAt &&
          new Date(item.autoUnblockAt.toDate?.() || item.autoUnblockAt) <= now
        ) {
          try {
            const collection_name = item.type === "user" ? "blockedUsers" : "blockedDevices"
            await updateDoc(doc(db, collection_name, item.id), {
              unblocked: true,
              unblockedAt: new Date(),
              unblockedBy: "system",
            })
          } catch (error) {
            console.error("Error auto-unblocking item:", error)
          }
        }
      })
    }

    const interval = setInterval(checkExpiredBlocks, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [allBlockedItems])

  const filteredItems = allBlockedItems.filter((item) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      item.customerName?.toLowerCase().includes(query) ||
      item.customerPhone?.toLowerCase().includes(query) ||
      item.deviceId?.toLowerCase().includes(query) ||
      item.reason?.toLowerCase().includes(query) ||
      item.blockedByName?.toLowerCase().includes(query) ||
      item.orderId?.toLowerCase().includes(query)

    if (!matchesSearch) return false

    // Filter by block type
    if (blockTypeFilter !== "all") {
      if (blockTypeFilter !== item.type) return false
    }

    const now = new Date()
    const isExpired = item.autoUnblockAt && new Date(item.autoUnblockAt.toDate?.() || item.autoUnblockAt) <= now

    switch (filterBy) {
      case "active":
        return !item.unblocked && !isExpired
      case "expired":
        return !item.unblocked && isExpired
      case "unblocked":
        return item.unblocked
      default:
        return true
    }
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return (
          new Date(b.blockedAt?.toDate?.() || b.blockedAt).getTime() -
          new Date(a.blockedAt?.toDate?.() || a.blockedAt).getTime()
        )
      case "oldest":
        return (
          new Date(a.blockedAt?.toDate?.() || a.blockedAt).getTime() -
          new Date(b.blockedAt?.toDate?.() || b.blockedAt).getTime()
        )
      case "name":
        const nameA = a.customerName || a.customerPhone || a.deviceId || ""
        const nameB = b.customerName || b.customerPhone || b.deviceId || ""
        return nameA.localeCompare(nameB)
      case "type":
        return a.type.localeCompare(b.type)
      default:
        return 0
    }
  })

  const activeBlocks = allBlockedItems.filter((item) => {
    const now = new Date()
    const isExpired = item.autoUnblockAt && new Date(item.autoUnblockAt.toDate?.() || item.autoUnblockAt) <= now
    return !item.unblocked && !isExpired
  })

  const expiredBlocks = allBlockedItems.filter((item) => {
    const now = new Date()
    const isExpired = item.autoUnblockAt && new Date(item.autoUnblockAt.toDate?.() || item.autoUnblockAt) <= now
    return !item.unblocked && isExpired
  })

  const unblockedItems = allBlockedItems.filter((item) => item.unblocked)

  const activeUserBlocks = activeBlocks.filter((item) => item.type === "user")
  const activeDeviceBlocks = activeBlocks.filter((item) => item.type === "device")

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId])
    } else {
      setSelectedItems(selectedItems.filter((id) => id !== itemId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeItemIds = activeBlocks.map((item) => item.id)
      setSelectedItems(activeItemIds)
    } else {
      setSelectedItems([])
    }
  }

  const handleUnblockItem = async (item: BlockedItem) => {
    setItemToUnblock(item)
    setIsUnblockDialogOpen(true)
  }

  const handleUnblockConfirm = async () => {
    if (!itemToUnblock) return

    setIsLoading(true)
    try {
      const collection_name = itemToUnblock.type === "user" ? "blockedUsers" : "blockedDevices"
      await updateDoc(doc(db, collection_name, itemToUnblock.id), {
        unblocked: true,
        unblockedAt: new Date(),
        unblockedBy: "admin",
      })

      const itemName =
        itemToUnblock.type === "user"
          ? itemToUnblock.customerName || itemToUnblock.customerPhone
          : `Qurilma (${itemToUnblock.deviceId?.substring(0, 8)}...)`

      toast({
        title: "✅ Blok ochildi",
        description: `${itemName} endi buyurtma bera oladi.`,
      })
      setIsUnblockDialogOpen(false)
      setItemToUnblock(null)
    } catch (error) {
      console.error("Error unblocking item:", error)
      toast({
        title: "❌ Xatolik",
        description: "Blokni ochishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkUnblock = async () => {
    if (selectedItems.length === 0) return

    setIsLoading(true)
    try {
      const batch = writeBatch(db)

      selectedItems.forEach((itemId) => {
        const item = allBlockedItems.find((i) => i.id === itemId)
        if (item) {
          const collection_name = item.type === "user" ? "blockedUsers" : "blockedDevices"
          const itemRef = doc(db, collection_name, itemId)
          batch.update(itemRef, {
            unblocked: true,
            unblockedAt: new Date(),
            unblockedBy: "admin",
          })
        }
      })

      await batch.commit()

      toast({
        title: "✅ Bloklar ochildi",
        description: `${selectedItems.length} ta blok ochildi.`,
      })

      setSelectedItems([])
      setIsBulkUnblockDialogOpen(false)
    } catch (error) {
      console.error("Error bulk unblocking items:", error)
      toast({
        title: "❌ Xatolik",
        description: "Blokni ochishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteBlock = async (item: BlockedItem) => {
    setItemToDelete(item)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    setIsLoading(true)
    try {
      const collection_name = itemToDelete.type === "user" ? "blockedUsers" : "blockedDevices"
      await deleteDoc(doc(db, collection_name, itemToDelete.id))

      toast({
        title: "🗑️ Blok o'chirildi",
        description: "Blok yozuvi o'chirildi",
      })
      setIsDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error("Error deleting block:", error)
      toast({
        title: "❌ Xatolik",
        description: "Blokni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getBlockTypeIcon = (type: string) => {
    return type === "user" ? <Phone className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />
  }

  const getBlockTypeLabel = (type: string) => {
    return type === "user" ? "Telefon" : "Qurilma"
  }

  const getBlockTypeBadge = (type: string) => {
    return type === "user" ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Phone className="w-3 h-3 mr-1" />
        Telefon
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
        <Smartphone className="w-3 h-3 mr-1" />
        Qurilma
      </Badge>
    )
  }

  const renderItemCard = (item: BlockedItem) => {
    const now = new Date()
    const isExpired = item.autoUnblockAt && new Date(item.autoUnblockAt.toDate?.() || item.autoUnblockAt) <= now
    const isActive = !item.unblocked && !isExpired

    const blockedDate = formatDateTime(item.blockedAt?.toDate?.() || new Date(item.blockedAt))
    const autoUnblockDate = item.autoUnblockAt
      ? formatDateTime(item.autoUnblockAt?.toDate?.() || new Date(item.autoUnblockAt))
      : null
    const unblockedDate = item.unblockedAt
      ? formatDateTime(item.unblockedAt?.toDate?.() || new Date(item.unblockedAt))
      : null

    const displayName =
      item.type === "user"
        ? item.customerName || item.customerPhone || "Noma'lum"
        : `Qurilma ${item.deviceId?.substring(0, 12)}...`

    const displaySubtitle = item.type === "user" ? item.customerPhone : item.deviceId

    return (
      <Card
        key={item.id}
        className={`transition-all duration-200 hover:shadow-md ${
          !isActive ? "opacity-75" : ""
        } ${selectedItems.includes(item.id) ? "ring-2 ring-blue-500" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {isActive && (
                <Checkbox
                  checked={selectedItems.includes(item.id)}
                  onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                />
              )}
              <div
                className={`p-2 rounded-full ${
                  isActive ? "bg-red-100" : item.unblocked ? "bg-green-100" : "bg-yellow-100"
                }`}
              >
                {isActive ? (
                  <Ban className="w-5 h-5 text-red-600" />
                ) : item.unblocked ? (
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                ) : (
                  <Timer className="w-5 h-5 text-yellow-600" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {displayName}
                  {getBlockTypeBadge(item.type)}
                </CardTitle>
                <p className="text-sm text-muted-foreground font-mono">{displaySubtitle}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {isActive ? (
                <Badge variant="destructive" className="animate-pulse">
                  <Ban className="w-3 h-3 mr-1" />
                  Bloklangan
                </Badge>
              ) : item.unblocked ? (
                <Badge variant="default" className="bg-green-600">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Ochildi
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  <Timer className="w-3 h-3 mr-1" />
                  Muddati tugagan
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>
                  Bloklagan: <strong>{item.blockedByName}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  Sana: <strong>{blockedDate.date}</strong>
                </span>
              </div>
            </div>

            {item.type === "user" && item.customerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-blue-600" />
                <span>
                  Mijoz: <strong>{item.customerName}</strong>
                </span>
              </div>
            )}

            {item.orderId && (
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span>
                  Buyurtma: <strong>#{item.orderId.substring(0, 8)}</strong>
                </span>
              </div>
            )}

            {item.reason && (
              <div className="p-3 bg-muted/50 rounded-lg border-l-4 border-red-500">
                <p className="text-sm font-medium mb-1 text-red-700">Sabab:</p>
                <p className="text-sm text-muted-foreground">{item.reason}</p>
              </div>
            )}

            {autoUnblockDate && !item.unblocked && (
              <div className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>
                  Avtomatik ochilish:{" "}
                  <strong>
                    {autoUnblockDate.date} {autoUnblockDate.time}
                  </strong>
                </span>
              </div>
            )}

            {unblockedDate && (
              <div className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span>
                  Ochildi:{" "}
                  <strong>
                    {unblockedDate.date} {unblockedDate.time}
                  </strong>
                </span>
                {item.unblockedBy && <span className="text-muted-foreground">({item.unblockedBy})</span>}
              </div>
            )}

            <div className="flex gap-2 pt-2 flex-wrap">
              {isActive && (
                <Button
                  onClick={() => handleUnblockItem(item)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Blokni ochish
                </Button>
              )}
              <Button onClick={() => setSelectedItem(item)} variant="outline" size="sm">
                <User className="w-4 h-4 mr-1" />
                Tafsilotlar
              </Button>
              <Button
                onClick={() => handleDeleteBlock(item)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                O'chirish
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8" />
            Bloklangan foydalanuvchilar va qurilmalar
          </h1>
          <p className="text-muted-foreground">Bloklangan telefon raqamlari va qurilmalarni boshqaring</p>
        </div>

        {selectedItems.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => setIsBulkUnblockDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              {selectedItems.length} ta blokni ochish
            </Button>
            <Button onClick={() => setSelectedItems([])} variant="outline">
              Bekor qilish
            </Button>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ism, telefon, qurilma ID, sabab bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={blockTypeFilter} onValueChange={setBlockTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Monitor className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Blok turi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="user">Telefon raqamlari</SelectItem>
                <SelectItem value="device">Qurilmalar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="active">Faol bloklar</SelectItem>
                <SelectItem value="expired">Muddati tugagan</SelectItem>
                <SelectItem value="unblocked">Ochildi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <RotateCcw className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Saralash" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Yangi birinchi</SelectItem>
                <SelectItem value="oldest">Eski birinchi</SelectItem>
                <SelectItem value="name">Ism bo'yicha</SelectItem>
                <SelectItem value="type">Tur bo'yicha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-6">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Faol bloklar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">{activeBlocks.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Telefon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{activeUserBlocks.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Qurilma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{activeDeviceBlocks.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-700 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Tugagan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900">{expiredBlocks.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Ochildi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{unblockedItems.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Jami
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{allBlockedItems.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {activeBlocks.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox checked={selectedItems.length === activeBlocks.length} onCheckedChange={handleSelectAll} />
                <span className="font-medium">Barcha faol bloklarni tanlash ({activeBlocks.length} ta)</span>
              </div>
              {selectedItems.length > 0 && <Badge variant="secondary">{selectedItems.length} ta tanlandi</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <Tabs value={filterBy} onValueChange={setFilterBy}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Barchasi ({allBlockedItems.length})</TabsTrigger>
          <TabsTrigger value="active">Faol ({activeBlocks.length})</TabsTrigger>
          <TabsTrigger value="expired">Tugagan ({expiredBlocks.length})</TabsTrigger>
          <TabsTrigger value="unblocked">Ochildi ({unblockedItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {sortedItems.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {sortedItems.map((item) => renderItemCard(item))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <UserX className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Hech narsa topilmadi</h3>
                <p className="text-muted-foreground">Qidiruv shartlariga mos element yo'q</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeBlocks.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {activeBlocks.map((item) => renderItemCard(item))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Faol bloklar yo'q</h3>
                <p className="text-muted-foreground">Hozirda hech kim va hech qanday qurilma bloklanmagan</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          {expiredBlocks.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {expiredBlocks.map((item) => renderItemCard(item))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Timer className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Muddati tugagan bloklar yo'q</h3>
                <p className="text-muted-foreground">Barcha bloklar hali faol</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="unblocked" className="space-y-4">
          {unblockedItems.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {unblockedItems.map((item) => renderItemCard(item))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ochildi bloklar yo'q</h3>
                <p className="text-muted-foreground">Hali hech qanday blok ochilmagan</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Details Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem && getBlockTypeIcon(selectedItem.type)}
              {selectedItem?.type === "user" ? "Foydalanuvchi" : "Qurilma"} tafsilotlari
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">{getBlockTypeBadge(selectedItem.type)}</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedItem.type === "user" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Ism</label>
                      <p className="text-lg font-semibold">{selectedItem.customerName || "Noma'lum"}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Telefon</label>
                      <p className="text-lg font-mono">{selectedItem.customerPhone || "N/A"}</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Qurilma ID</label>
                    <p className="text-lg font-mono break-all">{selectedItem.deviceId || "N/A"}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Bloklangan sana</label>
                  <p className="text-sm">
                    {formatDateTime(selectedItem.blockedAt?.toDate?.() || new Date(selectedItem.blockedAt)).date}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Bloklagan</label>
                  <p className="text-sm font-semibold">{selectedItem.blockedByName}</p>
                </div>
              </div>

              {selectedItem.reason && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Sabab</label>
                  <div className="p-3 bg-muted/50 rounded-lg border-l-4 border-red-500">
                    <p className="text-sm">{selectedItem.reason}</p>
                  </div>
                </div>
              )}

              {selectedItem.orderId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Buyurtma ID</label>
                  <p className="text-sm font-mono">{selectedItem.orderId}</p>
                </div>
              )}

              {selectedItem.orderType && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Buyurtma turi</label>
                  <p className="text-sm">{selectedItem.orderType}</p>
                </div>
              )}

              {selectedItem.autoUnblockAt && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Avtomatik ochilish</label>
                  <p className="text-sm">
                    {
                      formatDateTime(selectedItem.autoUnblockAt?.toDate?.() || new Date(selectedItem.autoUnblockAt))
                        .date
                    }
                  </p>
                </div>
              )}

              {selectedItem.unblockedAt && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Ochildi</label>
                  <p className="text-sm">
                    {formatDateTime(selectedItem.unblockedAt?.toDate?.() || new Date(selectedItem.unblockedAt)).date}
                    {selectedItem.unblockedBy && ` (${selectedItem.unblockedBy})`}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Unblock Confirmation */}
      <AlertDialog open={isUnblockDialogOpen} onOpenChange={setIsUnblockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Blokni ochish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Haqiqatan ham{" "}
              <strong>
                {itemToUnblock?.type === "user"
                  ? itemToUnblock?.customerName || itemToUnblock?.customerPhone
                  : `Qurilma (${itemToUnblock?.deviceId?.substring(0, 8)}...)`}
              </strong>{" "}
              ning blokini ochmoqchimisiz? {itemToUnblock?.type === "user" ? "U" : "Bu qurilma"} yana buyurtma bera
              oladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnblockConfirm}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ochilmoqda...
                </>
              ) : (
                "Blokni ochish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Unblock Confirmation */}
      <AlertDialog open={isBulkUnblockDialogOpen} onOpenChange={setIsBulkUnblockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Ko'p blokni ochish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Haqiqatan ham <strong>{selectedItems.length} ta</strong> blokni ochmoqchimisiz? Ular yana buyurtma bera
              oladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkUnblock}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ochilmoqda...
                </>
              ) : (
                `${selectedItems.length} ta blokni ochish`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Blok yozuvini o'chirish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Haqiqatan ham{" "}
              <strong>
                {itemToDelete?.type === "user"
                  ? itemToDelete?.customerName || itemToDelete?.customerPhone
                  : `Qurilma (${itemToDelete?.deviceId?.substring(0, 8)}...)`}
              </strong>{" "}
              ning blok yozuvini o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  O'chirilmoqda...
                </>
              ) : (
                "O'chirish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

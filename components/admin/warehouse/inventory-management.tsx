"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Search,
  QrCode,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Barcode,
  DollarSign,
} from "lucide-react"
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  manufactureDate?: string
  expiryDate?: string
  barcode?: string
  batchNumber?: string
  qrCode?: string
  reorderLevel: number
  location: {
    zone: string
    shelf: number
  }
  status: "normal" | "low_stock" | "expired" | "critical"
  wastageProfile?: {
    peeled?: number
    boiled?: number
    cooked?: number
  }
  createdAt: Date
  updatedAt: Date
}

interface InventoryManagementProps {
  inventory: InventoryItem[]
}

const categories = [
  "Meva",
  "Sabzavot",
  "Go'sht mahsulotlari",
  "Sut mahsulotlari",
  "Ichimliklar",
  "Yog'-moy",
  "Ziravorlar",
  "Non mahsulotlari",
  "Tozalash vositalari",
]

const units = ["kg", "litr", "dona", "qop", "quti", "metr", "paket", "gramm"]

const zones = ["A", "B", "C", "D", "E"]

export function InventoryManagement({ inventory }: InventoryManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    quantity: 0,
    unit: "kg",
    unitPrice: 0,
    manufactureDate: "",
    expiryDate: "",
    barcode: "",
    batchNumber: "",
    reorderLevel: 10,
    location: {
      zone: "A",
      shelf: 1,
    },
    wastageProfile: {
      peeled: 0,
      boiled: 0,
      cooked: 0,
    },
  })
  const { toast } = useToast()

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode?.includes(searchTerm) ||
      item.batchNumber?.includes(searchTerm)
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-green-100 text-green-800 border-green-200"
      case "low_stock":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "expired":
        return "bg-red-100 text-red-800 border-red-200"
      case "critical":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "normal":
        return <CheckCircle className="h-4 w-4" />
      case "low_stock":
        return <AlertTriangle className="h-4 w-4" />
      case "expired":
        return <Clock className="h-4 w-4" />
      case "critical":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const generateBatchNumber = () => {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "")
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `BCH-${random}-${date}`
  }

  const generateQRCode = (itemName: string) => {
    return `https://restoran.uz/qr/inventory/${itemName.toLowerCase().replace(/\s+/g, "-")}`
  }

  const calculateStatus = (item: any) => {
    if (item.expiryDate) {
      const expiryDate = new Date(item.expiryDate)
      const today = new Date()
      if (expiryDate <= today) return "expired"
    }

    if (item.quantity <= item.reorderLevel * 0.5) return "critical"
    if (item.quantity <= item.reorderLevel) return "low_stock"
    return "normal"
  }

  const saveItem = async () => {
    if (!newItem.name || !newItem.category || newItem.quantity < 0 || newItem.unitPrice < 0) {
      toast({
        title: "Xatolik",
        description: "Barcha majburiy maydonlarni to'ldiring",
        variant: "destructive",
      })
      return
    }

    const totalPrice = newItem.quantity * newItem.unitPrice
    const batchNumber = newItem.batchNumber || generateBatchNumber()
    const qrCode = generateQRCode(newItem.name)
    const status = calculateStatus({ ...newItem, totalPrice })

    const itemData = {
      ...newItem,
      totalPrice,
      batchNumber,
      qrCode,
      status,
      updatedAt: new Date(),
    }

    try {
      if (editingItem) {
        await updateDoc(doc(db, "warehouse_inventory", editingItem.id), itemData)
        toast({
          title: "Muvaffaqiyat",
          description: "Mahsulot yangilandi",
        })
      } else {
        await addDoc(collection(db, "warehouse_inventory"), {
          ...itemData,
          createdAt: new Date(),
        })
        toast({
          title: "Muvaffaqiyat",
          description: "Yangi mahsulot qo'shildi",
        })
      }

      closeDialog()
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Mahsulotni saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "warehouse_inventory", itemId))
      toast({
        title: "Muvaffaqiyat",
        description: "Mahsulot o'chirildi",
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Mahsulotni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const editItem = (item: InventoryItem) => {
    setEditingItem(item)
    setNewItem({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      manufactureDate: item.manufactureDate || "",
      expiryDate: item.expiryDate || "",
      barcode: item.barcode || "",
      batchNumber: item.batchNumber || "",
      reorderLevel: item.reorderLevel,
      location: item.location,
      wastageProfile: item.wastageProfile || { peeled: 0, boiled: 0, cooked: 0 },
    })
    setIsAddDialogOpen(true)
  }

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingItem(null)
    setNewItem({
      name: "",
      category: "",
      quantity: 0,
      unit: "kg",
      unitPrice: 0,
      manufactureDate: "",
      expiryDate: "",
      barcode: "",
      batchNumber: "",
      reorderLevel: 10,
      location: { zone: "A", shelf: 1 },
      wastageProfile: { peeled: 0, boiled: 0, cooked: 0 },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventar Boshqaruvi</h2>
          <p className="text-muted-foreground">Omborxona inventarini batafsil boshqaring</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Yangi Mahsulot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Mahsulotni Tahrirlash" : "Yangi Mahsulot Qo'shish"}</DialogTitle>
              <DialogDescription>Mahsulot ma'lumotlarini batafsil kiriting</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Asosiy Ma'lumotlar</h3>

                <div className="space-y-2">
                  <Label htmlFor="name">Mahsulot Nomi *</Label>
                  <Input
                    id="name"
                    value={newItem.name}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Mahsulot nomini kiriting"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Kategoriya *</Label>
                  <Select
                    value={newItem.category}
                    onValueChange={(value) => setNewItem((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategoriyani tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Miqdor *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.1"
                      value={newItem.quantity || ""}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, quantity: Number.parseFloat(e.target.value) || 0 }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">O'lchov Birligi</Label>
                    <Select
                      value={newItem.unit}
                      onValueChange={(value) => setNewItem((prev) => ({ ...prev, unit: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Birlik Narxi (so'm) *</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    value={newItem.unitPrice || ""}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, unitPrice: Number.parseInt(e.target.value) || 0 }))
                    }
                    placeholder="0"
                  />
                </div>

                {newItem.quantity > 0 && newItem.unitPrice > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">
                        Jami Narx: {formatCurrency(newItem.quantity * newItem.unitPrice)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Qo'shimcha Ma'lumotlar</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufactureDate">Ishlab Chiqarilgan Sana</Label>
                    <Input
                      id="manufactureDate"
                      type="date"
                      value={newItem.manufactureDate}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, manufactureDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Yaroqlilik Muddati</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={newItem.expiryDate}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Shtrix-kod</Label>
                  <Input
                    id="barcode"
                    value={newItem.barcode}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, barcode: e.target.value }))}
                    placeholder="Shtrix-kod kiriting"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchNumber">Partiya Raqami</Label>
                  <div className="flex gap-2">
                    <Input
                      id="batchNumber"
                      value={newItem.batchNumber}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, batchNumber: e.target.value }))}
                      placeholder="Avtomatik yaratiladi"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewItem((prev) => ({ ...prev, batchNumber: generateBatchNumber() }))}
                    >
                      Yaratish
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorderLevel">Qayta Buyurtma Darajasi</Label>
                  <Input
                    id="reorderLevel"
                    type="number"
                    value={newItem.reorderLevel || ""}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, reorderLevel: Number.parseInt(e.target.value) || 10 }))
                    }
                    placeholder="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Joylashuv</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={newItem.location.zone}
                      onValueChange={(value) =>
                        setNewItem((prev) => ({
                          ...prev,
                          location: { ...prev.location, zone: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            Zona {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={newItem.location.shelf || ""}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          location: { ...prev.location, shelf: Number.parseInt(e.target.value) || 1 },
                        }))
                      }
                      placeholder="Rafa raqami"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Yo'qotish Profili (%)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Tozalash</Label>
                      <Input
                        type="number"
                        value={newItem.wastageProfile.peeled || ""}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            wastageProfile: {
                              ...prev.wastageProfile,
                              peeled: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Qaynatish</Label>
                      <Input
                        type="number"
                        value={newItem.wastageProfile.boiled || ""}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            wastageProfile: {
                              ...prev.wastageProfile,
                              boiled: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Pishirish</Label>
                      <Input
                        type="number"
                        value={newItem.wastageProfile.cooked || ""}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            wastageProfile: {
                              ...prev.wastageProfile,
                              cooked: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Bekor qilish
              </Button>
              <Button onClick={saveItem}>{editingItem ? "Yangilash" : "Saqlash"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mahsulot, shtrix-kod yoki partiya raqami bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Kategoriya" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha kategoriyalar</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low_stock">Kam qolgan</SelectItem>
            <SelectItem value="expired">Muddati o'tgan</SelectItem>
            <SelectItem value="critical">Kritik</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredInventory.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Mahsulot topilmadi</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || categoryFilter !== "all" || statusFilter !== "all"
                  ? "Qidiruv shartlariga mos mahsulot yo'q"
                  : "Birinchi mahsulotingizni qo'shing"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredInventory.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{item.category}</Badge>
                      <Badge className={getStatusColor(item.status)}>
                        {getStatusIcon(item.status)}
                        <span className="ml-1">
                          {item.status === "normal" && "Normal"}
                          {item.status === "low_stock" && "Kam qolgan"}
                          {item.status === "expired" && "Muddati o'tgan"}
                          {item.status === "critical" && "Kritik"}
                        </span>
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => editItem(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Mahsulotni o'chirish</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{item.name}" mahsulotini o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteItem(item.id)}>O'chirish</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Miqdor</div>
                    <div className="font-medium">
                      {item.quantity} {item.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Birlik Narxi</div>
                    <div className="font-medium">{formatCurrency(item.unitPrice)}</div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-600">Jami Narx</div>
                  <div className="text-lg font-bold text-blue-800">{formatCurrency(item.totalPrice)}</div>
                </div>

                {item.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      Zona {item.location.zone}, Rafa {item.location.shelf}
                    </span>
                  </div>
                )}

                {item.barcode && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Barcode className="h-4 w-4" />
                    <span>{item.barcode}</span>
                  </div>
                )}

                {item.batchNumber && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{item.batchNumber}</span>
                  </div>
                )}

                {item.expiryDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Yaroqlilik: {formatDate(item.expiryDate)}</span>
                  </div>
                )}

                {item.qrCode && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="h-4 w-4" />
                    <span className="truncate">QR kod mavjud</span>
                  </div>
                )}

                <Separator />

                <div className="text-xs text-muted-foreground">Yaratilgan: {formatDateTime(item.createdAt)}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

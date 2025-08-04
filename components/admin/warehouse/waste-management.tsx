"use client"

import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Search, Calendar, AlertTriangle, TrendingDown, DollarSign, Package } from "lucide-react"
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency, formatDate, getDateString } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface WasteRecord {
  id: string
  productId: string
  product: string
  wastedQuantity: number
  unit: string
  date: string
  reason: string
  totalLoss: number
  category: string
  createdAt: Date
}

interface WasteManagementProps {
  inventory: any[]
}

const wasteReasons = [
  "Chirik",
  "Muddati o'tgan",
  "Buzilgan",
  "Shikastlangan",
  "Noto'g'ri saqlash",
  "Harorat buzilishi",
  "Kontaminatsiya",
  "Boshqa",
]

export function WasteManagement({ inventory }: WasteManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [reasonFilter, setReasonFilter] = useState<string>("all")
  const [newWaste, setNewWaste] = useState({
    date: getDateString(),
    productId: "",
    wastedQuantity: 0,
    reason: "",
    customReason: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    const wasteQuery = query(collection(db, "warehouse_waste"), orderBy("date", "desc"), orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(wasteQuery, (snapshot) => {
      const wasteData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WasteRecord[]
      setWasteRecords(wasteData)
    })

    return unsubscribe
  }, [])

  const filteredWaste = wasteRecords.filter((record) => {
    const matchesSearch =
      record.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.reason.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDate = !dateFilter || record.date === dateFilter
    const matchesReason = reasonFilter === "all" || record.reason === reasonFilter
    return matchesSearch && matchesDate && matchesReason
  })

  const saveWaste = async () => {
    if (!newWaste.productId || newWaste.wastedQuantity <= 0 || (!newWaste.reason && !newWaste.customReason)) {
      toast({
        title: "Xatolik",
        description: "Barcha majburiy maydonlarni to'ldiring",
        variant: "destructive",
      })
      return
    }

    const selectedProduct = inventory.find((item) => item.id === newWaste.productId)
    if (!selectedProduct) {
      toast({
        title: "Xatolik",
        description: "Mahsulot topilmadi",
        variant: "destructive",
      })
      return
    }

    const totalLoss = newWaste.wastedQuantity * selectedProduct.unitPrice
    const reason = newWaste.reason === "Boshqa" ? newWaste.customReason : newWaste.reason

    const wasteData = {
      date: newWaste.date,
      productId: newWaste.productId,
      product: selectedProduct.name,
      wastedQuantity: newWaste.wastedQuantity,
      unit: selectedProduct.unit,
      reason,
      totalLoss,
      category: selectedProduct.category,
      createdAt: new Date(),
    }

    try {
      await addDoc(collection(db, "warehouse_waste"), wasteData)

      toast({
        title: "Muvaffaqiyat",
        description: "Chiqindi yozuvi qo'shildi",
      })

      setIsAddDialogOpen(false)
      setNewWaste({
        date: getDateString(),
        productId: "",
        wastedQuantity: 0,
        reason: "",
        customReason: "",
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Chiqindi yozuvini saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const getWasteStats = () => {
    const today = getDateString()
    const thisWeek = new Date()
    thisWeek.setDate(thisWeek.getDate() - 7)
    const weekStart = thisWeek.toISOString().split("T")[0]

    const todayWaste = wasteRecords.filter((record) => record.date === today)
    const weekWaste = wasteRecords.filter((record) => record.date >= weekStart)

    const todayLoss = todayWaste.reduce((sum, record) => sum + record.totalLoss, 0)
    const weekLoss = weekWaste.reduce((sum, record) => sum + record.totalLoss, 0)
    const totalLoss = wasteRecords.reduce((sum, record) => sum + record.totalLoss, 0)

    const topReasons = wasteRecords.reduce(
      (acc, record) => {
        acc[record.reason] = (acc[record.reason] || 0) + record.totalLoss
        return acc
      },
      {} as Record<string, number>,
    )

    const sortedReasons = Object.entries(topReasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)

    return {
      todayLoss,
      weekLoss,
      totalLoss,
      todayCount: todayWaste.length,
      weekCount: weekWaste.length,
      totalCount: wasteRecords.length,
      topReasons: sortedReasons,
    }
  }

  const wasteStats = getWasteStats()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chiqindi Boshqaruvi</h2>
          <p className="text-muted-foreground">Mahsulot yo'qotishlari va chiqindilarni kuzating</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Chiqindi Qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yangi Chiqindi Yozuvi</DialogTitle>
              <DialogDescription>Yo'qotilgan mahsulot ma'lumotlarini kiriting</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Sana</Label>
                <Input
                  id="date"
                  type="date"
                  value={newWaste.date}
                  onChange={(e) => setNewWaste((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Mahsulot</Label>
                <Select
                  value={newWaste.productId}
                  onValueChange={(value) => setNewWaste((prev) => ({ ...prev, productId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mahsulotni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Mavjud: {item.quantity} {item.unit} • {formatCurrency(item.unitPrice)}/{item.unit}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wastedQuantity">Yo'qotilgan Miqdor</Label>
                <Input
                  id="wastedQuantity"
                  type="number"
                  step="0.1"
                  value={newWaste.wastedQuantity || ""}
                  onChange={(e) =>
                    setNewWaste((prev) => ({ ...prev, wastedQuantity: Number.parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Yo'qotish Sababi</Label>
                <Select
                  value={newWaste.reason}
                  onValueChange={(value) => setNewWaste((prev) => ({ ...prev, reason: value, customReason: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sababni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {wasteReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newWaste.reason === "Boshqa" && (
                <div className="space-y-2">
                  <Label htmlFor="customReason">Boshqa Sabab</Label>
                  <Textarea
                    id="customReason"
                    value={newWaste.customReason}
                    onChange={(e) => setNewWaste((prev) => ({ ...prev, customReason: e.target.value }))}
                    placeholder="Yo'qotish sababini yozing..."
                    rows={3}
                  />
                </div>
              )}

              {newWaste.wastedQuantity > 0 && newWaste.productId && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Hisoblangan Yo'qotish:</h4>
                  <div className="text-lg font-bold text-red-900">
                    {formatCurrency(
                      newWaste.wastedQuantity * (inventory.find((i) => i.id === newWaste.productId)?.unitPrice || 0),
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button onClick={saveWaste} className="bg-red-600 hover:bg-red-700">
                Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Bugungi Yo'qotish</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{formatCurrency(wasteStats.todayLoss)}</div>
            <p className="text-xs text-red-600">{wasteStats.todayCount} ta yozuv</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Haftalik Yo'qotish</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-800">{formatCurrency(wasteStats.weekLoss)}</div>
            <p className="text-xs text-orange-600">{wasteStats.weekCount} ta yozuv</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Jami Yo'qotish</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-800">{formatCurrency(wasteStats.totalLoss)}</div>
            <p className="text-xs text-purple-600">{wasteStats.totalCount} ta yozuv</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Eng Ko'p Sabab</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-gray-800">{wasteStats.topReasons[0]?.[0] || "Ma'lumot yo'q"}</div>
            <p className="text-xs text-gray-600">
              {wasteStats.topReasons[0] ? formatCurrency(wasteStats.topReasons[0][1]) : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {wasteStats.topReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eng Ko'p Yo'qotish Sabablari</CardTitle>
            <CardDescription>Eng ko'p zarar keltirgan sabablar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {wasteStats.topReasons.map(([reason, amount], index) => (
                <div key={reason} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <span className="font-medium">{reason}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">{formatCurrency(amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {((amount / wasteStats.totalLoss) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mahsulot yoki sabab bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Sabab" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha sabablar</SelectItem>
            {wasteReasons.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {reason}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label htmlFor="dateFilter" className="text-sm">
            Sana:
          </Label>
          <Input
            id="dateFilter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" onClick={() => setDateFilter("")} size="sm">
            Barcha sanalar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredWaste.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Chiqindi yozuvlari yo'q</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || dateFilter || reasonFilter !== "all"
                  ? "Qidiruv shartlariga mos yozuv topilmadi"
                  : "Chiqindi yozuvlari mavjud emas"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWaste.map((record) => (
              <Card key={record.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{record.product}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(record.date)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      <Package className="h-3 w-3 mr-1" />
                      {record.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Yo'qotilgan</div>
                      <div className="font-medium">
                        {record.wastedQuantity} {record.unit}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Sabab</div>
                      <div className="font-medium text-red-600">{record.reason}</div>
                    </div>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-600">Jami Yo'qotish</div>
                    <div className="text-lg font-bold text-red-800">{formatCurrency(record.totalLoss)}</div>
                  </div>

                  <Separator />

                  <div className="text-xs text-muted-foreground">Qo'shilgan: {formatDate(record.createdAt)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

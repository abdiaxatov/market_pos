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
import { Plus, Activity, Search, Calendar, ChefHat, Scale, Calculator, TrendingDown } from "lucide-react"
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency, formatDate, getDateString } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface DailyUsage {
  id: string
  date: string
  productId: string
  product: string
  usedQuantity: number
  unit: string
  usedFor: string
  calculatedWaste: number
  wasteUnit: string
  wasteMethod: string
  totalCost: number
  createdAt: Date
}

interface DailyUsageTrackingProps {
  inventory: any[]
  menuItems: any[]
}

const wasteMethods = [
  { value: "peeled", label: "Tozalash (po'st olish)", percentage: 15 },
  { value: "boiled", label: "Qaynatish", percentage: 5 },
  { value: "cooked", label: "Pishirish", percentage: 8 },
  { value: "trimmed", label: "Kesish", percentage: 10 },
  { value: "cleaned", label: "Yuvish", percentage: 3 },
]

export function DailyUsageTracking({ inventory, menuItems }: DailyUsageTrackingProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [usageRecords, setUsageRecords] = useState<DailyUsage[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState(getDateString())
  const [newUsage, setNewUsage] = useState({
    date: getDateString(),
    productId: "",
    usedQuantity: 0,
    usedFor: "",
    wasteMethod: "peeled",
  })
  const { toast } = useToast()

  useEffect(() => {
    const usageQuery = query(
      collection(db, "warehouse_daily_usage"),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc"),
    )

    const unsubscribe = onSnapshot(usageQuery, (snapshot) => {
      const usageData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DailyUsage[]
      setUsageRecords(usageData)
    })

    return unsubscribe
  }, [])

  const filteredUsage = usageRecords.filter((record) => {
    const matchesSearch =
      record.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.usedFor.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDate = !dateFilter || record.date === dateFilter
    return matchesSearch && matchesDate
  })

  const getWastePercentage = (method: string) => {
    const wasteMethod = wasteMethods.find((m) => m.value === method)
    return wasteMethod ? wasteMethod.percentage : 0
  }

  const calculateWaste = (quantity: number, method: string) => {
    const percentage = getWastePercentage(method)
    return (quantity * percentage) / 100
  }

  const saveUsage = async () => {
    if (!newUsage.productId || newUsage.usedQuantity <= 0 || !newUsage.usedFor) {
      toast({
        title: "Xatolik",
        description: "Barcha majburiy maydonlarni to'ldiring",
        variant: "destructive",
      })
      return
    }

    const selectedProduct = inventory.find((item) => item.id === newUsage.productId)
    if (!selectedProduct) {
      toast({
        title: "Xatolik",
        description: "Mahsulot topilmadi",
        variant: "destructive",
      })
      return
    }

    const calculatedWaste = calculateWaste(newUsage.usedQuantity, newUsage.wasteMethod)
    const totalCost = newUsage.usedQuantity * selectedProduct.unitPrice

    const usageData = {
      date: newUsage.date,
      productId: newUsage.productId,
      product: selectedProduct.name,
      usedQuantity: newUsage.usedQuantity,
      unit: selectedProduct.unit,
      usedFor: newUsage.usedFor,
      calculatedWaste,
      wasteUnit: selectedProduct.unit,
      wasteMethod: newUsage.wasteMethod,
      totalCost,
      createdAt: new Date(),
    }

    try {
      await addDoc(collection(db, "warehouse_daily_usage"), usageData)

      toast({
        title: "Muvaffaqiyat",
        description: "Sarfiyot yozuvi qo'shildi",
      })

      setIsAddDialogOpen(false)
      setNewUsage({
        date: getDateString(),
        productId: "",
        usedQuantity: 0,
        usedFor: "",
        wasteMethod: "peeled",
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Sarfiyot yozuvini saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const getTodayStats = () => {
    const today = getDateString()
    const todayUsage = usageRecords.filter((record) => record.date === today)

    const totalUsed = todayUsage.reduce((sum, record) => sum + record.usedQuantity, 0)
    const totalWaste = todayUsage.reduce((sum, record) => sum + record.calculatedWaste, 0)
    const totalCost = todayUsage.reduce((sum, record) => sum + record.totalCost, 0)
    const uniqueProducts = new Set(todayUsage.map((record) => record.productId)).size

    return { totalUsed, totalWaste, totalCost, uniqueProducts }
  }

  const todayStats = getTodayStats()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kunlik Sarfiyot Kuzatuvi</h2>
          <p className="text-muted-foreground">Mahsulotlarning kunlik sarfiyoti va yo'qotishlarini kuzating</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Sarfiyot Qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yangi Sarfiyot Yozuvi</DialogTitle>
              <DialogDescription>Mahsulot sarfiyoti ma'lumotlarini kiriting</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Sana</Label>
                <Input
                  id="date"
                  type="date"
                  value={newUsage.date}
                  onChange={(e) => setNewUsage((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Mahsulot</Label>
                <Select
                  value={newUsage.productId}
                  onValueChange={(value) => setNewUsage((prev) => ({ ...prev, productId: value }))}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usedQuantity">Sarflangan Miqdor</Label>
                  <Input
                    id="usedQuantity"
                    type="number"
                    step="0.1"
                    value={newUsage.usedQuantity || ""}
                    onChange={(e) =>
                      setNewUsage((prev) => ({ ...prev, usedQuantity: Number.parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wasteMethod">Yo'qotish Usuli</Label>
                  <Select
                    value={newUsage.wasteMethod}
                    onValueChange={(value) => setNewUsage((prev) => ({ ...prev, wasteMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wasteMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <div className="flex flex-col">
                            <span>{method.label}</span>
                            <span className="text-xs text-muted-foreground">{method.percentage}% yo'qotish</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usedFor">Nima uchun ishlatildi</Label>
                <div className="flex gap-2">
                  <Select
                    value={newUsage.usedFor}
                    onValueChange={(value) => setNewUsage((prev) => ({ ...prev, usedFor: value }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Menyu taomini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.map((item) => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Yoki boshqa maqsad yozing"
                    value={newUsage.usedFor}
                    onChange={(e) => setNewUsage((prev) => ({ ...prev, usedFor: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              {newUsage.usedQuantity > 0 && newUsage.productId && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <h4 className="font-medium text-blue-800">Hisoblangan Ma'lumotlar:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600">Yo'qotish miqdori:</span>
                      <div className="font-medium">
                        {calculateWaste(newUsage.usedQuantity, newUsage.wasteMethod).toFixed(2)}{" "}
                        {inventory.find((i) => i.id === newUsage.productId)?.unit}
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-600">Jami narx:</span>
                      <div className="font-medium">
                        {formatCurrency(
                          newUsage.usedQuantity * (inventory.find((i) => i.id === newUsage.productId)?.unitPrice || 0),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button onClick={saveUsage}>Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Bugungi Sarfiyot</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{todayStats.totalUsed.toFixed(1)}</div>
            <p className="text-xs text-green-600">{todayStats.uniqueProducts} xil mahsulot</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Bugungi Yo'qotish</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-800">{todayStats.totalWaste.toFixed(1)}</div>
            <p className="text-xs text-orange-600">Hisoblangan yo'qotish</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Bugungi Xarajat</CardTitle>
            <Calculator className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{formatCurrency(todayStats.totalCost)}</div>
            <p className="text-xs text-blue-600">Sarflangan mahsulotlar</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Yo'qotish Foizi</CardTitle>
            <Scale className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-800">
              {todayStats.totalUsed > 0 ? ((todayStats.totalWaste / todayStats.totalUsed) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-purple-600">Bugungi o'rtacha</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mahsulot yoki taom nomi bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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
        {filteredUsage.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sarfiyot yozuvlari yo'q</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || dateFilter
                  ? "Qidiruv shartlariga mos yozuv topilmadi"
                  : "Birinchi sarfiyot yozuvingizni qo'shing"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredUsage.map((record) => (
              <Card key={record.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{record.product}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(record.date)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <ChefHat className="h-3 w-3 mr-1" />
                      {record.usedFor}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Sarflangan</div>
                      <div className="font-medium">
                        {record.usedQuantity} {record.unit}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Yo'qotish</div>
                      <div className="font-medium text-orange-600">
                        {record.calculatedWaste.toFixed(2)} {record.wasteUnit}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-green-600">Jami Xarajat</div>
                    <div className="text-lg font-bold text-green-800">{formatCurrency(record.totalCost)}</div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Scale className="h-4 w-4" />
                    <span>
                      {wasteMethods.find((m) => m.value === record.wasteMethod)?.label}(
                      {getWastePercentage(record.wasteMethod)}%)
                    </span>
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

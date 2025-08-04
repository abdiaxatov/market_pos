"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Clock,
  Search,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Trash2,
  Activity,
  Calendar,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

interface StockHistoryRecord {
  id: string
  productId: string
  product: string
  date: string
  type: "input" | "usage" | "waste" | "adjustment"
  quantity: number
  unit: string
  reason: string
  supplier?: string
  usedFor?: string
  previousStock: number
  newStock: number
  unitPrice: number
  totalValue: number
  createdAt: Date
}

interface StockHistoryProps {
  inventory: any[]
}

const historyTypes = [
  { value: "input", label: "Kirim", icon: ShoppingCart, color: "green" },
  { value: "usage", label: "Sarfiyot", icon: Activity, color: "blue" },
  { value: "waste", label: "Chiqindi", icon: Trash2, color: "red" },
  { value: "adjustment", label: "Tuzatish", icon: Package, color: "yellow" },
]

export function StockHistory({ inventory }: StockHistoryProps) {
  const [historyRecords, setHistoryRecords] = useState<StockHistoryRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [productFilter, setProductFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<string>("")

  useEffect(() => {
    const historyQuery = query(
      collection(db, "warehouse_stock_history"),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc"),
    )

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const historyData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StockHistoryRecord[]
      setHistoryRecords(historyData)
    })

    return unsubscribe
  }, [])

  const filteredHistory = historyRecords.filter((record) => {
    const matchesSearch =
      record.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.usedFor?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesProduct = productFilter === "all" || record.productId === productFilter
    const matchesType = typeFilter === "all" || record.type === typeFilter
    const matchesDate = !dateFilter || record.date === dateFilter
    return matchesSearch && matchesProduct && matchesType && matchesDate
  })

  const getProductHistory = (productId: string) => {
    return historyRecords
      .filter((record) => record.productId === productId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const getChartData = (productId: string) => {
    const productHistory = getProductHistory(productId)
    return productHistory.map((record, index) => ({
      date: record.date,
      stock: record.newStock,
      change: record.quantity * (record.type === "input" ? 1 : -1),
      type: record.type,
    }))
  }

  const getStockStats = () => {
    const today = new Date().toISOString().split("T")[0]
    const thisWeek = new Date()
    thisWeek.setDate(thisWeek.getDate() - 7)
    const weekStart = thisWeek.toISOString().split("T")[0]

    const todayRecords = historyRecords.filter((record) => record.date === today)
    const weekRecords = historyRecords.filter((record) => record.date >= weekStart)

    const todayInput = todayRecords.filter((r) => r.type === "input").reduce((sum, r) => sum + r.totalValue, 0)
    const todayUsage = todayRecords.filter((r) => r.type === "usage").reduce((sum, r) => sum + r.totalValue, 0)
    const todayWaste = todayRecords.filter((r) => r.type === "waste").reduce((sum, r) => sum + r.totalValue, 0)

    const weekInput = weekRecords.filter((r) => r.type === "input").reduce((sum, r) => sum + r.totalValue, 0)
    const weekUsage = weekRecords.filter((r) => r.type === "usage").reduce((sum, r) => sum + r.totalValue, 0)
    const weekWaste = weekRecords.filter((r) => r.type === "waste").reduce((sum, r) => sum + r.totalValue, 0)

    return {
      today: { input: todayInput, usage: todayUsage, waste: todayWaste },
      week: { input: weekInput, usage: weekUsage, waste: weekWaste },
    }
  }

  const stockStats = getStockStats()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stok Tarixi</h2>
          <p className="text-muted-foreground">Mahsulotlar stokining batafsil tarixi</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Bugungi Kirim</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{formatCurrency(stockStats.today.input)}</div>
            <p className="text-xs text-green-600">Bugun</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Bugungi Sarfiyot</CardTitle>
            <ArrowDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{formatCurrency(stockStats.today.usage)}</div>
            <p className="text-xs text-blue-600">Bugun</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Bugungi Chiqindi</CardTitle>
            <Trash2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{formatCurrency(stockStats.today.waste)}</div>
            <p className="text-xs text-red-600">Bugun</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Haftalik Kirim</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{formatCurrency(stockStats.week.input)}</div>
            <p className="text-xs text-green-600">So'nggi hafta</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Haftalik Sarfiyot</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{formatCurrency(stockStats.week.usage)}</div>
            <p className="text-xs text-blue-600">So'nggi hafta</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Haftalik Chiqindi</CardTitle>
            <Trash2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{formatCurrency(stockStats.week.waste)}</div>
            <p className="text-xs text-red-600">So'nggi hafta</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Mahsulot Stok Grafigi
          </CardTitle>
          <CardDescription>Tanlangan mahsulotning stok o'zgarishi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Mahsulotni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {inventory.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.quantity} {item.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={getChartData(selectedProduct)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "stock" ? `${value} birlik` : `${value > 0 ? "+" : ""}${value}`,
                    name === "stock" ? "Stok" : "O'zgarish",
                  ]}
                  labelFormatter={(label) => `Sana: ${label}`}
                />
                <Area type="monotone" dataKey="stock" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mahsulot, sabab yoki ta'minotchi bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Mahsulot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha mahsulotlar</SelectItem>
            {inventory.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Tur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha turlar</SelectItem>
            {historyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </div>
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
        {filteredHistory.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tarix yozuvlari yo'q</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || productFilter !== "all" || typeFilter !== "all" || dateFilter
                  ? "Qidiruv shartlariga mos yozuv topilmadi"
                  : "Hali stok tarixi yozuvlari mavjud emas"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((record) => {
              const historyType = historyTypes.find((t) => t.value === record.type)
              if (!historyType) return null

              const IconComponent = historyType.icon
              const isPositive = record.type === "input"
              const isNegative = record.type === "usage" || record.type === "waste"

              return (
                <Card
                  key={record.id}
                  className={`hover:shadow-lg transition-shadow border-l-4 border-l-${historyType.color}-500`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg bg-${historyType.color}-100`}>
                          <IconComponent className={`h-4 w-4 text-${historyType.color}-600`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{record.product}</h4>
                            <Badge
                              className={`bg-${historyType.color}-100 text-${historyType.color}-800 border-${historyType.color}-200`}
                            >
                              {historyType.label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {formatDate(record.date)}
                            </div>
                          </div>
                          <div className="text-sm">
                            <strong>Sabab:</strong> {record.reason}
                          </div>
                          {record.supplier && (
                            <div className="text-sm">
                              <strong>Ta'minotchi:</strong> {record.supplier}
                            </div>
                          )}
                          {record.usedFor && (
                            <div className="text-sm">
                              <strong>Ishlatildi:</strong> {record.usedFor}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"}`}
                        >
                          {isPositive ? "+" : isNegative ? "-" : ""}
                          {record.quantity} {record.unit}
                        </div>
                        <div className="text-sm text-muted-foreground">{formatCurrency(record.totalValue)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {record.previousStock} → {record.newStock} {record.unit}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Zap, Flame, Droplets, TrendingUp, BarChart3, Calculator } from "lucide-react"
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

interface UtilityRecord {
  id: string
  type: "electricity" | "gas" | "water"
  month: string
  usedAmount: number
  unit: string
  unitPrice: number
  totalCost: number
  meterReading?: number
  previousReading?: number
  createdAt: Date
}

const utilityTypes = [
  { value: "electricity", label: "Elektr energiyasi", unit: "kWh", icon: Zap, color: "yellow" },
  { value: "gas", label: "Tabiiy gaz", unit: "m³", icon: Flame, color: "blue" },
  { value: "water", label: "Suv", unit: "litr", icon: Droplets, color: "cyan" },
]

export function UtilitiesTracking() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [utilityRecords, setUtilityRecords] = useState<UtilityRecord[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [newRecord, setNewRecord] = useState({
    type: "electricity" as "electricity" | "gas" | "water",
    month: new Date().toISOString().slice(0, 7),
    usedAmount: 0,
    unitPrice: 0,
    meterReading: 0,
    previousReading: 0,
  })
  const { toast } = useToast()

  useEffect(() => {
    const utilitiesQuery = query(
      collection(db, "warehouse_utilities"),
      orderBy("month", "desc"),
      orderBy("createdAt", "desc"),
    )

    const unsubscribe = onSnapshot(utilitiesQuery, (snapshot) => {
      const utilitiesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UtilityRecord[]
      setUtilityRecords(utilitiesData)
    })

    return unsubscribe
  }, [])

  const saveUtilityRecord = async () => {
    if (newRecord.usedAmount <= 0 || newRecord.unitPrice <= 0) {
      toast({
        title: "Xatolik",
        description: "Sarflangan miqdor va narxni kiriting",
        variant: "destructive",
      })
      return
    }

    const utilityType = utilityTypes.find((t) => t.value === newRecord.type)
    if (!utilityType) return

    const totalCost = newRecord.usedAmount * newRecord.unitPrice

    const recordData = {
      type: newRecord.type,
      month: newRecord.month,
      usedAmount: newRecord.usedAmount,
      unit: utilityType.unit,
      unitPrice: newRecord.unitPrice,
      totalCost,
      meterReading: newRecord.meterReading || undefined,
      previousReading: newRecord.previousReading || undefined,
      createdAt: new Date(),
    }

    try {
      await addDoc(collection(db, "warehouse_utilities"), recordData)

      toast({
        title: "Muvaffaqiyat",
        description: "Kommunal xarajat qo'shildi",
      })

      setIsAddDialogOpen(false)
      setNewRecord({
        type: "electricity",
        month: new Date().toISOString().slice(0, 7),
        usedAmount: 0,
        unitPrice: 0,
        meterReading: 0,
        previousReading: 0,
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Kommunal xarajatni saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const getMonthlyStats = (month: string) => {
    const monthRecords = utilityRecords.filter((record) => record.month === month)

    const stats = utilityTypes.map((type) => {
      const record = monthRecords.find((r) => r.type === type.value)
      return {
        type: type.value,
        label: type.label,
        icon: type.icon,
        color: type.color,
        usedAmount: record?.usedAmount || 0,
        unit: type.unit,
        totalCost: record?.totalCost || 0,
        unitPrice: record?.unitPrice || 0,
      }
    })

    const totalCost = monthRecords.reduce((sum, record) => sum + record.totalCost, 0)

    return { stats, totalCost }
  }

  const getChartData = () => {
    const months = [...new Set(utilityRecords.map((r) => r.month))].sort().slice(-6)

    return months.map((month) => {
      const monthRecords = utilityRecords.filter((r) => r.month === month)
      const data: any = { month }

      utilityTypes.forEach((type) => {
        const record = monthRecords.find((r) => r.type === type.value)
        data[type.value] = record?.totalCost || 0
      })

      data.total = monthRecords.reduce((sum, r) => sum + r.totalCost, 0)
      return data
    })
  }

  const currentMonthStats = getMonthlyStats(selectedMonth)
  const chartData = getChartData()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kommunal Xarajatlar Kuzatuvi</h2>
          <p className="text-muted-foreground">Elektr, gaz va suv xarajatlarini kuzating</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date()
                date.setMonth(date.getMonth() - i)
                const monthStr = date.toISOString().slice(0, 7)
                return (
                  <SelectItem key={monthStr} value={monthStr}>
                    {date.toLocaleDateString("uz-UZ", { year: "numeric", month: "long" })}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Xarajat Qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Yangi Kommunal Xarajat</DialogTitle>
                <DialogDescription>Oylik kommunal xarajat ma'lumotlarini kiriting</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Xarajat Turi</Label>
                    <Select
                      value={newRecord.type}
                      onValueChange={(value: "electricity" | "gas" | "water") =>
                        setNewRecord((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {utilityTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="month">Oy</Label>
                    <Input
                      id="month"
                      type="month"
                      value={newRecord.month}
                      onChange={(e) => setNewRecord((prev) => ({ ...prev, month: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usedAmount">
                      Sarflangan Miqdor ({utilityTypes.find((t) => t.value === newRecord.type)?.unit})
                    </Label>
                    <Input
                      id="usedAmount"
                      type="number"
                      step="0.1"
                      value={newRecord.usedAmount || ""}
                      onChange={(e) =>
                        setNewRecord((prev) => ({ ...prev, usedAmount: Number.parseFloat(e.target.value) || 0 }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">
                      Birlik Narxi (so'm/{utilityTypes.find((t) => t.value === newRecord.type)?.unit})
                    </Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      value={newRecord.unitPrice || ""}
                      onChange={(e) =>
                        setNewRecord((prev) => ({ ...prev, unitPrice: Number.parseInt(e.target.value) || 0 }))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="previousReading">Oldingi Ko'rsatkich</Label>
                    <Input
                      id="previousReading"
                      type="number"
                      value={newRecord.previousReading || ""}
                      onChange={(e) =>
                        setNewRecord((prev) => ({ ...prev, previousReading: Number.parseInt(e.target.value) || 0 }))
                      }
                      placeholder="0 (ixtiyoriy)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meterReading">Joriy Ko'rsatkich</Label>
                    <Input
                      id="meterReading"
                      type="number"
                      value={newRecord.meterReading || ""}
                      onChange={(e) =>
                        setNewRecord((prev) => ({ ...prev, meterReading: Number.parseInt(e.target.value) || 0 }))
                      }
                      placeholder="0 (ixtiyoriy)"
                    />
                  </div>
                </div>

                {newRecord.usedAmount > 0 && newRecord.unitPrice > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Hisoblangan Xarajat:</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatCurrency(newRecord.usedAmount * newRecord.unitPrice)}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button onClick={saveUtilityRecord}>Saqlash</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {currentMonthStats.stats.map((stat) => {
          const IconComponent = stat.icon
          return (
            <Card
              key={stat.type}
              className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 border-${stat.color}-200`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium text-${stat.color}-700`}>{stat.label}</CardTitle>
                <IconComponent className={`h-4 w-4 text-${stat.color}-600`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold text-${stat.color}-800`}>
                  {stat.usedAmount > 0 ? `${stat.usedAmount} ${stat.unit}` : "Ma'lumot yo'q"}
                </div>
                <p className={`text-xs text-${stat.color}-600`}>
                  {stat.totalCost > 0 ? formatCurrency(stat.totalCost) : "Xarajat kiritilmagan"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {new Date(selectedMonth).toLocaleDateString("uz-UZ", { year: "numeric", month: "long" })} - Jami Xarajat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-900 mb-2">{formatCurrency(currentMonthStats.totalCost)}</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {currentMonthStats.stats.map((stat) => (
              <div key={stat.type} className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-purple-600" />
                <span className="text-purple-700">
                  {stat.totalCost > 0 ? formatCurrency(stat.totalCost) : "0 so'm"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Xarajatlar Tendensiyasi
              </CardTitle>
              <CardDescription>So'nggi 6 oylik kommunal xarajatlar</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    labelFormatter={(label) => `Oy: ${label}`}
                  />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Xarajatlar Taqsimoti
              </CardTitle>
              <CardDescription>Har bir kommunal xizmat bo'yicha</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    labelFormatter={(label) => `Oy: ${label}`}
                  />
                  <Bar dataKey="electricity" fill="#fbbf24" name="Elektr" />
                  <Bar dataKey="gas" fill="#3b82f6" name="Gaz" />
                  <Bar dataKey="water" fill="#06b6d4" name="Suv" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>So'nggi Yozuvlar</CardTitle>
          <CardDescription>Oxirgi qo'shilgan kommunal xarajatlar</CardDescription>
        </CardHeader>
        <CardContent>
          {utilityRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Hali kommunal xarajatlar qo'shilmagan</div>
          ) : (
            <div className="space-y-3">
              {utilityRecords.slice(0, 5).map((record) => {
                const utilityType = utilityTypes.find((t) => t.value === record.type)
                if (!utilityType) return null

                const IconComponent = utilityType.icon

                return (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${utilityType.color}-100`}>
                        <IconComponent className={`h-4 w-4 text-${utilityType.color}-600`} />
                      </div>
                      <div>
                        <div className="font-medium">{utilityType.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.month} • {record.usedAmount} {record.unit}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(record.totalCost)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(record.unitPrice)}/{record.unit}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { TrendingUp, TrendingDown, Package, DollarSign, Calendar, Award } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { DailyEntry, Product } from "@/types/warehouse"

interface WarehouseReportsProps {
  entries: DailyEntry[]
  products: Product[]
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"]

export function WarehouseReports({ entries, products }: WarehouseReportsProps) {
  const analytics = useMemo(() => {
    if (entries.length === 0) return null

    // Basic stats
    const totalExpense = entries.reduce((sum, entry) => sum + entry.jami_summa, 0)
    const totalProducts = entries.flatMap((entry) => entry.mahsulotlar).length
    const averageDaily = totalExpense / Math.max(entries.length, 1)

    // Product analysis
    const productStats = new Map<string, { count: number; totalKg: number; totalCost: number }>()

    entries.forEach((entry) => {
      entry.mahsulotlar.forEach((product) => {
        const existing = productStats.get(product.nomi) || { count: 0, totalKg: 0, totalCost: 0 }
        productStats.set(product.nomi, {
          count: existing.count + 1,
          totalKg: existing.totalKg + product.kg,
          totalCost: existing.totalCost + product.puli,
        })
      })
    })

    // Top products by cost
    const topProductsByCost = Array.from(productStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)

    // Top products by quantity
    const topProductsByQuantity = Array.from(productStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalKg - a.totalKg)
      .slice(0, 10)

    // Daily trend (last 30 days)
    const dailyTrend = entries
      .slice(0, 30)
      .reverse()
      .map((entry) => ({
        date: formatDate(entry.sana),
        amount: entry.jami_summa,
        products: entry.mahsulotlar.length,
      }))

    // Category analysis
    const categoryStats = new Map<string, number>()
    products.forEach((product) => {
      const category = product.kategoriya || "Boshqa"
      categoryStats.set(category, (categoryStats.get(category) || 0) + 1)
    })

    const categoryData = Array.from(categoryStats.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Monthly comparison
    const monthlyData = new Map<string, number>()
    entries.forEach((entry) => {
      const month = new Date(entry.sana).toLocaleDateString("uz-UZ", { year: "numeric", month: "long" })
      monthlyData.set(month, (monthlyData.get(month) || 0) + entry.jami_summa)
    })

    const monthlyComparison = Array.from(monthlyData.entries())
      .map(([month, amount]) => ({ month, amount }))
      .slice(0, 6)

    return {
      totalExpense,
      totalProducts,
      averageDaily,
      uniqueProducts: productStats.size,
      topProductsByCost,
      topProductsByQuantity,
      dailyTrend,
      categoryData,
      monthlyComparison,
    }
  }, [entries, products])

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hisobot uchun ma'lumot yo'q</h3>
          <p className="text-muted-foreground text-center">Birinchi kirimlaringizni qo'shing</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Hisobotlar va Tahlil</h2>
        <p className="text-muted-foreground">Omborxona faoliyati bo'yicha batafsil tahlil</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami Xarajat</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalExpense)}</div>
            <p className="text-xs text-muted-foreground">Barcha vaqt davomida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kunlik O'rtacha</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.averageDaily)}</div>
            <p className="text-xs text-muted-foreground">Har kunlik xarajat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mahsulot Turlari</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueProducts}</div>
            <p className="text-xs text-muted-foreground">Turli mahsulotlar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami Kirimlar</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
            <p className="text-xs text-muted-foreground">Kunlik yozuvlar</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Kunlik Xarajatlar Dinamikasi</CardTitle>
            <CardDescription>So'nggi 30 kunlik xarajatlar</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Xarajat"]}
                  labelFormatter={(label) => `Sana: ${label}`}
                />
                <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products by Cost */}
        <Card>
          <CardHeader>
            <CardTitle>Eng Qimmat Mahsulotlar</CardTitle>
            <CardDescription>Xarajat bo'yicha eng yuqori mahsulotlar</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topProductsByCost.slice(0, 8)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "Jami xarajat"]} />
                <Bar dataKey="totalCost" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Kategoriya Bo'yicha Taqsimot</CardTitle>
            <CardDescription>Mahsulot kategoriyalari</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products by Quantity */}
        <Card>
          <CardHeader>
            <CardTitle>Eng Ko'p Ishlatilgan Mahsulotlar</CardTitle>
            <CardDescription>Miqdor bo'yicha eng yuqori mahsulotlar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topProductsByQuantity.slice(0, 8).map((product, index) => (
                <div key={product.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.count} marta</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{product.totalKg.toFixed(1)} kg</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(product.totalCost)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison */}
      {analytics.monthlyComparison.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Oylik Taqqoslash</CardTitle>
            <CardDescription>Oxirgi oylar bo'yicha xarajatlar</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "Xarajat"]} />
                <Bar dataKey="amount" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Eng Qimmat Kun
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length > 0 && (
              <div>
                <p className="text-2xl font-bold">{formatCurrency(Math.max(...entries.map((e) => e.jami_summa)))}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(
                    entries.find((e) => e.jami_summa === Math.max(...entries.map((e) => e.jami_summa)))?.sana || "",
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-500" />
              Eng Arzon Kun
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length > 0 && (
              <div>
                <p className="text-2xl font-bold">{formatCurrency(Math.min(...entries.map((e) => e.jami_summa)))}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(
                    entries.find((e) => e.jami_summa === Math.min(...entries.map((e) => e.jami_summa)))?.sana || "",
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              O'rtacha Mahsulot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-2xl font-bold">{(analytics.totalProducts / Math.max(entries.length, 1)).toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Har kunlik o'rtacha</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

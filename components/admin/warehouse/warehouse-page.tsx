"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Package,
  Calendar,
  BarChart3,
  Download,
  AlertTriangle,
  Clock,
  Zap,
  Calculator,
  Trash2,
  ChefHat,
  ShoppingCart,
  Activity,
} from "lucide-react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency } from "@/lib/utils"
import { DailyEntriesManagement } from "./daily-entries-management"
import { ProductsManagement } from "./products-management"
import { WarehouseReports } from "./warehouse-reports"
import { ExportManager } from "./export-manager"
import { InventoryManagement } from "./inventory-management"
import { DailyUsageTracking } from "./daily-usage-tracking"
import { WasteManagement } from "./waste-management"
import { MenuIntegration } from "./menu-integration"
import { UtilitiesTracking } from "./utilities-tracking"
import { StockHistory } from "./stock-history"
import { AutoConsumption } from "./auto-consumption"
import { AlertsManagement } from "./alerts-management"
import type { DailyEntry, Product, WarehouseStats } from "@/types/warehouse"

export function WarehousePage() {
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [stats, setStats] = useState<WarehouseStats>({
    jami_xarajat: 0,
    kunlik_ortacha: 0,
    mahsulot_turlari: 0,
    tasdiqlangan_kirimlar: 0,
    tasdiqlanmagan_kirimlar: 0,
  })
  const [dashboardStats, setDashboardStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    expiredProducts: 0,
    weeklyLoss: 0,
    weeklyPurchases: 0,
    activeAlerts: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const entriesQuery = query(collection(db, "warehouse_entries"), orderBy("sana", "desc"))
    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      const entriesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DailyEntry[]
      setEntries(entriesData)
      calculateStats(entriesData)
    })

    const productsQuery = query(collection(db, "warehouse_products"), orderBy("nomi", "asc"))
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[]
      setProducts(productsData)
    })

    const inventoryQuery = query(collection(db, "warehouse_inventory"), orderBy("name", "asc"))
    const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const inventoryData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setInventory(inventoryData)
      // Recalculate dashboard stats when inventory changes
      calculateDashboardStats(inventoryData, alerts)
    })

    const menuQuery = query(collection(db, "menuItems"), orderBy("name", "asc"))
    const unsubscribeMenu = onSnapshot(menuQuery, (snapshot) => {
      const menuData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMenuItems(menuData)
    })

    const alertsQuery = query(collection(db, "warehouse_alerts"), orderBy("createdAt", "desc"))
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const alertsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setAlerts(alertsData)
      // Recalculate dashboard stats when alerts change
      calculateDashboardStats(inventory, alertsData)
      setLoading(false)
    })

    return () => {
      unsubscribeEntries()
      unsubscribeProducts()
      unsubscribeInventory()
      unsubscribeMenu()
      unsubscribeAlerts()
    }
  }, []) // Empty dependency array to run once on mount

  // Effect to re-calculate dashboard stats when inventory or alerts change
  useEffect(() => {
    calculateDashboardStats(inventory, alerts)
  }, [inventory, alerts])

  const calculateStats = (entriesData: DailyEntry[]) => {
    const jami_xarajat = entriesData.reduce((sum, entry) => sum + entry.jami_summa, 0)
    const kunlik_ortacha = entriesData.length > 0 ? jami_xarajat / entriesData.length : 0

    const allProducts = entriesData.flatMap((entry) => entry.mahsulotlar)
    const uniqueProducts = new Set(allProducts.map((p) => p.nomi))
    const mahsulot_turlari = uniqueProducts.size

    const tasdiqlangan_kirimlar = allProducts.filter((p) => p.tasdiqlangan).length
    const tasdiqlanmagan_kirimlar = allProducts.filter((p) => !p.tasdiqlangan).length

    setStats({
      jami_xarajat,
      kunlik_ortacha,
      mahsulot_turlari,
      tasdiqlangan_kirimlar,
      tasdiqlanmagan_kirimlar,
    })
  }

  const calculateDashboardStats = (inventoryData: any[], alertsData: any[]) => {
    const totalProducts = inventoryData.length
    const lowStock = inventoryData.filter((item) => item.quantity <= (item.reorderLevel || 10)).length

    const expiredProducts = inventoryData.filter((item) => {
      if (!item.expiryDate) return false
      const expiryDate = new Date(item.expiryDate)
      const today = new Date()
      return expiryDate <= today
    }).length

    const weeklyLoss = inventoryData.reduce((sum, item) => sum + (item.weeklyWaste || 0), 0)
    const weeklyPurchases = inventoryData.reduce((sum, item) => sum + (item.weeklyPurchases || 0), 0)
    const activeAlerts = alertsData.filter((alert) => alert.status === "active").length

    setDashboardStats({
      totalProducts,
      lowStock,
      expiredProducts,
      weeklyLoss,
      weeklyPurchases,
      activeAlerts,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Omborxona ma'lumotlari yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Ideal Restoran Omborxonasi
          </h1>
          <p className="text-muted-foreground">Professional omborxona boshqaruv tizimi</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700 border-blue-200">
            <Package className="h-3 w-3 mr-1" />
            {dashboardStats.totalProducts} mahsulot
          </Badge>
          <Badge variant="outline" className="text-sm bg-green-50 text-green-700 border-green-200">
            <Activity className="h-3 w-3 mr-1" />
            {menuItems.length} menyu
          </Badge>
          {dashboardStats.activeAlerts > 0 && (
            <Badge variant="destructive" className="text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {dashboardStats.activeAlerts} ogohlantirish
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Jami Mahsulotlar</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{dashboardStats.totalProducts}</div>
            <p className="text-xs text-blue-600">Omborxonada mavjud</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Kam Qolgan</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-800">{dashboardStats.lowStock}</div>
            <p className="text-xs text-orange-600">Qayta buyurtma kerak</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Muddati O'tgan</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{dashboardStats.expiredProducts}</div>
            <p className="text-xs text-red-600">Tekshirish kerak</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Haftalik Yo'qotish</CardTitle>
            <Trash2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-800">{formatCurrency(dashboardStats.weeklyLoss)}</div>
            <p className="text-xs text-purple-600">So'nggi hafta</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Haftalik Xarid</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{formatCurrency(dashboardStats.weeklyPurchases)}</div>
            <p className="text-xs text-green-600">So'nggi hafta</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Faol Ogohlantirishlar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-800">{dashboardStats.activeAlerts}</div>
            <p className="text-xs text-yellow-600">Diqqat talab qiladi</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-12">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventar</span>
          </TabsTrigger>
          <TabsTrigger value="entries" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Kirimlar</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Sarfiyot</span>
          </TabsTrigger>
          <TabsTrigger value="waste" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Chiqindi</span>
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            <span className="hidden sm:inline">Menyu</span>
          </TabsTrigger>
          <TabsTrigger value="utilities" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Kommunal</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Tarix</span>
          </TabsTrigger>
          <TabsTrigger value="auto" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Avto</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Ogohlantirishlar</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Mahsulotlar</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Hisobotlar</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Eksport</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <InventoryManagement inventory={inventory} />
        </TabsContent>
        <TabsContent value="entries" className="space-y-4">
          <DailyEntriesManagement entries={entries} />
        </TabsContent>
        <TabsContent value="usage" className="space-y-4">
          <DailyUsageTracking inventory={inventory} menuItems={menuItems} />
        </TabsContent>
        <TabsContent value="waste" className="space-y-4">
          <WasteManagement inventory={inventory} />
        </TabsContent>
        <TabsContent value="menu" className="space-y-4">
          <MenuIntegration menuItems={menuItems} inventory={inventory} />
        </TabsContent>
        <TabsContent value="utilities" className="space-y-4">
          <UtilitiesTracking />
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <StockHistory inventory={inventory} />
        </TabsContent>
        <TabsContent value="auto" className="space-y-4">
          <AutoConsumption menuItems={menuItems} inventory={inventory} />
        </TabsContent>
        <TabsContent value="alerts" className="space-y-4">
          <AlertsManagement alerts={alerts} inventory={inventory} />
        </TabsContent>
        <TabsContent value="products" className="space-y-4">
          <ProductsManagement products={products} />
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <WarehouseReports entries={entries} products={products} />
        </TabsContent>
        <TabsContent value="export" className="space-y-4">
          <ExportManager entries={entries} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

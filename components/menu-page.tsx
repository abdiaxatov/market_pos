"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, onSnapshot, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"
import { SearchBar } from "@/components/search-bar"
import { CategoryFilter } from "@/components/category-filter"
import { MenuGrid } from "@/components/menu-grid"
import { CartButton } from "@/components/cart-button"
import { ViewMyOrdersButton } from "@/components/view-my-orders-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { OrderHistory } from "@/components/order-history"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Clock, Star, MapPin, Gift, X } from "lucide-react"
import type { MenuItem, Category } from "@/types"

interface DeliverySettings {
  deliveryAvailable: boolean
  deliveryFee: number
  deliveryTime: string
  deliveryRadius: string
  deliveryPhone: string
}

export function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu")
  const [showDeliveryAd, setShowDeliveryAd] = useState(false)
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({
    deliveryAvailable: false,
    deliveryFee: 15000,
    deliveryTime: "30-45 daqiqa",
    deliveryRadius: "5km radiusda",
    deliveryPhone: "+998 90 123 45 67",
  })
  const { toast } = useToast()

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        setIsLoading(true)
        console.log("Fetching menu items...")

        // Fetch categories first
        const categoriesSnapshot = await getDocs(collection(db, "categories"))
        const categoriesData: Category[] = []
        categoriesSnapshot.forEach((doc) => {
          categoriesData.push({ id: doc.id, ...doc.data() } as Category)
        })
        console.log("Categories fetched:", categoriesData.length)
        setCategories(categoriesData)

        // Fetch all menu items without any filter first
        const menuSnapshot = await getDocs(collection(db, "menuItems"))
        const menuData: MenuItem[] = []
        menuSnapshot.forEach((doc) => {
          const data = doc.data()
          console.log("Menu item data:", data)

          // Create menu item with proper structure
          const menuItem: MenuItem = {
            id: doc.id,
            name: data.name || "",
            description: data.description || "",
            price: data.price || 0,
            category: data.category || "",
            categoryId: data.categoryId || "",
            image: data.imageUrl || data.image,
            imageUrl: data.imageUrl || data.image,
            available: data.isAvailable !== false && data.available !== false,
            isAvailable: data.isAvailable !== false && data.available !== false,
            preparationTime: data.preparationTime,
            ingredients: data.ingredients,
            allergens: data.allergens,
            remainingServings: data.remainingServings,
            servesCount: data.servesCount,
            needsContainer: data.needsContainer,
            containerPrice: data.containerPrice,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            modelUrl: data.modelUrl,
          }

          // Only add available items
          if (menuItem.available && menuItem.isAvailable) {
            menuData.push(menuItem)
          }
        })

        console.log("Menu items processed:", menuData.length)
        console.log("Sample menu item:", menuData[0])
        setMenuItems(menuData)
        setFilteredItems(menuData)
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching menu items:", error)
        toast({
          title: "Xatolik",
          description: "Menyu elementlarini yuklashda xatolik yuz berdi.",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchMenuItems()
  }, [toast])

  // Listen to delivery settings changes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "orderSettings"),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          const newSettings: DeliverySettings = {
            deliveryAvailable: data.deliveryAvailable === true,
            deliveryFee: data.deliveryFee || 15000,
            deliveryTime: data.deliveryTime || "30-45 daqiqa",
            deliveryRadius: data.deliveryRadius || "5km radiusda",
            deliveryPhone: data.deliveryPhone || "+998 90 123 45 67",
          }
          setDeliverySettings(newSettings)
          setShowDeliveryAd(newSettings.deliveryAvailable)
        } else {
          setShowDeliveryAd(false)
        }
      },
      (error) => {
        console.error("Error fetching delivery settings:", error)
        setShowDeliveryAd(false)
      },
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Filter items based on search query and selected category
    let filtered = menuItems

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter((item) => item.categoryId === selectedCategory)
    }

    console.log("Filtered items:", filtered.length)
    setFilteredItems(filtered)
  }, [searchQuery, selectedCategory, menuItems])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId)
  }

  // Check if user has orders
  const hasOrders = (() => {
    try {
      const orders = JSON.parse(localStorage.getItem("myOrders") || "[]")
      return orders.length > 0
    } catch {
      return false
    }
  })()

  return (
    <div className="flex min-h-screen flex-col pb-20">
      {/* Delivery Advertisement Banner - Only show if delivery is available */}
      {showDeliveryAd && deliverySettings.deliveryAvailable && (
        <div className="relative">
          <Card className="m-4 bg-gradient-to-r from-green-500 to-emerald-600 border-0 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20 h-8 w-8"
                onClick={() => setShowDeliveryAd(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-between text-white pr-8">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className=" bg-white/10 rounded-full">
                    <img src="/Logo.png" alt="Logo" className="sm:h-12 sm:w-12 h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold mb-1">🚚 Yetkazib berish xizmati!</h2>
                    <p className="text-green-100 mb-2 text-sm sm:text-base">Endi uyingizgacha yetkazib beramiz</p>
                    <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        <span>{deliverySettings.deliveryPhone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{deliverySettings.deliveryTime}</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{deliverySettings.deliveryRadius}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <Badge className="bg-yellow-400 text-black font-bold text-lg px-3 py-1 mb-2">
                    <Gift className="w-4 h-4 mr-1" />
                    CHEGIRMA 15%
                  </Badge>
                  <p className="text-sm text-green-100">Birinchi buyurtma uchun</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="ml-1 text-sm">4.9 (2,340 baho)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header with search and tabs */}
      <header className="sticky top-0 z-10 bg-white p-4">
        <div className="mb-4">
          <SearchBar onSearch={handleSearch} />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "menu" | "orders")}>
          <TabsList className="w-full">
            <TabsTrigger value="menu" className="flex-1">
              Menyu
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1">
              Buyurtmalarim
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="mt-4">
            {isLoading ? (
              <MenuLoadingSkeleton />
            ) : filteredItems.length > 0 ? (
              <MenuGrid items={filteredItems} />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {menuItems.length === 0 ? "Hech qanday taom mavjud emas" : "Qidiruv bo'yicha hech narsa topilmadi"}
                </p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery("")} className="mt-2">
                    Qidiruvni tozalash
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <OrderHistory />
          </TabsContent>
        </Tabs>
      </header>

      {/* Bottom category filter - only show in menu tab */}
      {activeTab === "menu" && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-10 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
            <div className="overflow-x-auto p-2">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={handleCategorySelect}
              />
            </div>
            <div className="flex items-center justify-center text-xs text-muted-foreground pb-2">
              <p>
                © 2025{" "}
                <a className="text-primary font-bold" href="http://abdiaxatov.uz">
                  Abdiaxatov
                </a>{" "}
                IT xizmatlar
              </p>
            </div>
          </div>
          <div className="fixed bottom-16 pb-10 right-4 z-50">
            <CartButton />
          </div>
        </>
      )}

      {/* View my orders button */}
      {!hasOrders && <ViewMyOrdersButton />}
    </div>
  )
}

function MenuLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

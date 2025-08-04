"use client"

import { useState, useEffect } from "react"
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { MenuItemForm } from "@/components/menu-item-form"
import { CategoryManagement } from "@/components/admin/category-management"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Search, Trash2, Edit, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import Image from "next/image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MenuItem, Category } from "@/types"

export function MenuManagement() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Fetch categories
    const categoriesQuery = query(collection(db, "categories"), orderBy("name"))

    const categoriesUnsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const categoriesData: Category[] = []
        snapshot.forEach((doc) => {
          categoriesData.push({ id: doc.id, ...doc.data() } as Category)
        })
        setCategories(categoriesData)
      },
      (error) => {
        console.error("Error fetching categories:", error)
        toast({
          title: "Xatolik",
          description: "Kategoriyalarni yuklashda xatolik yuz berdi.",
          variant: "destructive",
        })
      },
    )

    // Fetch menu items
    const menuQuery = query(collection(db, "menuItems"))

    const menuUnsubscribe = onSnapshot(
      menuQuery,
      (snapshot) => {
        const items: MenuItem[] = []
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as MenuItem)
        })
        // Sort by newest first
        items.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0
          return b.createdAt.seconds - a.createdAt.seconds
        })
        setMenuItems(items)
        setFilteredItems(items)
        setIsLoading(false)
      },
      (error) => {
        console.error("Error fetching menu items:", error)
        toast({
          title: "Xatolik",
          description: "Menyu elementlarini yuklashda xatolik yuz berdi.",
          variant: "destructive",
        })
        setIsLoading(false)
      },
    )

    return () => {
      categoriesUnsubscribe()
      menuUnsubscribe()
    }
  }, [toast])

  useEffect(() => {
    // Filter items based on search query and category filter
    let filtered = menuItems

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (categoryFilter) {
      filtered = filtered.filter((item) => item.categoryId === categoryFilter)
    }

    setFilteredItems(filtered)
  }, [searchQuery, categoryFilter, menuItems])

  const handleAddItem = () => {
    setSelectedItem(null)
    setIsFormOpen(true)
  }

  const handleEditItem = (item: MenuItem) => {
    setSelectedItem(item)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedItem(null)
  }

  const handleDeleteClick = (item: MenuItem) => {
    setItemToDelete(item)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, "menuItems", itemToDelete.id))
      toast({
        title: "Taom o'chirildi",
        description: `${itemToDelete.name} muvaffaqiyatli o'chirildi`,
      })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting menu item:", error)
      toast({
        title: "Xatolik",
        description: "Taomni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : "Kategoriya topilmadi"
  }

  return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Menyu boshqaruvi</h1>

        <Tabs defaultValue="menu-items">
          <TabsList className="mb-4">
            <TabsTrigger value="menu-items">Taomlar</TabsTrigger>
            <TabsTrigger value="categories">Kategoriyalar</TabsTrigger>
          </TabsList>

          <TabsContent value="menu-items" className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Taomlarni qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter || "all"} onValueChange={(value) => setCategoryFilter(value || null)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Barcha kategoriyalar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha kategoriyalar</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddItem} className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Yangi taom qo'shish
              </Button>
            </div>

            {isLoading ? (
              <div className="flex h-60 items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">Taomlar topilmadi</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="relative aspect-video bg-muted">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl || "/placeholder.svg"}
                          alt={item.name}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg?height=200&width=200"
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-sm text-muted-foreground">Rasm yo'q</span>
                        </div>
                      )}
                      <Badge className="absolute right-2 top-2 bg-primary">{formatCurrency(item.price)}</Badge>
                      {item.remainingServings !== undefined && item.remainingServings < item.servesCount && (
                        <Badge className="absolute left-2 top-2 bg-primary text-white">
                          {item.remainingServings} porsiya qoldi
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="font-medium">{item.name}</h3>
                        <Badge variant="outline">{getCategoryName(item.categoryId)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={item.isAvailable ? "default" : "destructive"} className="px-2 py-0 text-xs">
                          {item.isAvailable ? "Mavjud" : "Mavjud emas"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.servesCount} kishi uchun</span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 p-4 pt-0">
                      <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                        <Edit className="mr-1 h-3 w-3" />
                        Tahrirlash
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(item)}>
                        <Trash2 className="mr-1 h-3 w-3" />
                        O'chirish
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManagement />
          </TabsContent>
        </Tabs>

        {/* Delete confirmation dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Taomni o'chirishni tasdiqlaysizmi?</DialogTitle>
              <DialogDescription>
                Bu amal qaytarib bo'lmaydi. {itemToDelete?.name} menyu ro'yxatidan butunlay o'chiriladi.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                Bekor qilish
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    O'chirilmoqda...
                  </>
                ) : (
                  "O'chirish"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Menu item form dialog */}
        {isFormOpen && (
          <MenuItemForm item={selectedItem} categories={categories} open={isFormOpen} onClose={handleCloseForm} />
        )}
      </div>

  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Edit, Trash2, Package, Search } from "lucide-react"
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import type { Product } from "@/types/warehouse"

interface ProductsManagementProps {
  products: Product[]
}

const categories = ["Go'sht mahsulotlari", "Un va xamir", "Sabzavot", "Ziravorlar", "Sut mahsulotlari", "Boshqa"]

const units = ["kg", "litr", "dona", "paket", "qop"]

export function ProductsManagement({ products }: ProductsManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [newProduct, setNewProduct] = useState({
    nomi: "",
    kategoriya: "",
    olchov_birligi: "kg",
    minimal_zaxira: 0,
    hozirgi_zaxira: 0,
  })
  const { toast } = useToast()

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.nomi.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || product.kategoriya === selectedCategory
    return matchesSearch && matchesCategory
  })

  const saveProduct = async () => {
    if (!newProduct.nomi || !newProduct.kategoriya) {
      toast({
        title: "Xatolik",
        description: "Mahsulot nomi va kategoriyasini kiriting",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingProduct) {
        await updateDoc(doc(db, "warehouse_products", editingProduct.id), {
          ...newProduct,
          updatedAt: new Date(),
        })
        toast({
          title: "Muvaffaqiyat",
          description: "Mahsulot yangilandi",
        })
      } else {
        await addDoc(collection(db, "warehouse_products"), {
          ...newProduct,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        toast({
          title: "Muvaffaqiyat",
          description: "Yangi mahsulot qo'shildi",
        })
      }

      setIsAddDialogOpen(false)
      setEditingProduct(null)
      setNewProduct({
        nomi: "",
        kategoriya: "",
        olchov_birligi: "kg",
        minimal_zaxira: 0,
        hozirgi_zaxira: 0,
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Mahsulotni saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const deleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, "warehouse_products", productId))
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

  const editProduct = (product: Product) => {
    setEditingProduct(product)
    setNewProduct({
      nomi: product.nomi,
      kategoriya: product.kategoriya,
      olchov_birligi: product.olchov_birligi,
      minimal_zaxira: product.minimal_zaxira || 0,
      hozirgi_zaxira: product.hozirgi_zaxira || 0,
    })
    setIsAddDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mahsulotlar Boshqaruvi</h2>
          <p className="text-muted-foreground">Omborxona mahsulotlarini boshqaring</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yangi Mahsulot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Mahsulotni Tahrirlash" : "Yangi Mahsulot Qo'shish"}</DialogTitle>
              <DialogDescription>Mahsulot ma'lumotlarini kiriting</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nomi">Nomi</Label>
                <Input
                  id="nomi"
                  value={newProduct.nomi}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, nomi: e.target.value }))}
                  className="col-span-3"
                  placeholder="Mahsulot nomini kiriting"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="kategoriya">Kategoriya</Label>
                <Select
                  value={newProduct.kategoriya}
                  onValueChange={(value) => setNewProduct((prev) => ({ ...prev, kategoriya: value }))}
                >
                  <SelectTrigger className="col-span-3">
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

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="olchov_birligi">O'lchov Birligi</Label>
                <Select
                  value={newProduct.olchov_birligi}
                  onValueChange={(value) => setNewProduct((prev) => ({ ...prev, olchov_birligi: value }))}
                >
                  <SelectTrigger className="col-span-3">
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

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="minimal_zaxira">Minimal Zaxira</Label>
                <Input
                  id="minimal_zaxira"
                  type="number"
                  value={newProduct.minimal_zaxira || ""}
                  onChange={(e) =>
                    setNewProduct((prev) => ({ ...prev, minimal_zaxira: Number.parseInt(e.target.value) || 0 }))
                  }
                  className="col-span-3"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="hozirgi_zaxira">Hozirgi Zaxira</Label>
                <Input
                  id="hozirgi_zaxira"
                  type="number"
                  value={newProduct.hozirgi_zaxira || ""}
                  onChange={(e) =>
                    setNewProduct((prev) => ({ ...prev, hozirgi_zaxira: Number.parseInt(e.target.value) || 0 }))
                  }
                  className="col-span-3"
                  placeholder="0"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button onClick={saveProduct}>{editingProduct ? "Yangilash" : "Saqlash"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mahsulot qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
      </div>

      {/* Products Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Mahsulot topilmadi</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || selectedCategory !== "all"
                  ? "Qidiruv shartlariga mos mahsulot yo'q"
                  : "Birinchi mahsulotingizni qo'shing"}
              </p>
              {!searchTerm && selectedCategory === "all" && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yangi Mahsulot Qo'shish
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredProducts.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{product.nomi}</CardTitle>
                    <CardDescription>{product.kategoriya}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => editProduct(product)}>
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
                            "{product.nomi}" mahsulotini o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteProduct(product.id)}>O'chirish</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">O'lchov birligi:</span>
                    <Badge variant="outline">{product.olchov_birligi}</Badge>
                  </div>

                  {product.hozirgi_zaxira !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Hozirgi zaxira:</span>
                      <span className="font-medium">
                        {product.hozirgi_zaxira} {product.olchov_birligi}
                      </span>
                    </div>
                  )}

                  {product.minimal_zaxira !== undefined && product.minimal_zaxira > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Minimal zaxira:</span>
                      <span className="font-medium">
                        {product.minimal_zaxira} {product.olchov_birligi}
                      </span>
                    </div>
                  )}

                  {product.oxirgi_narx && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Oxirgi narx:</span>
                      <span className="font-medium">{formatCurrency(product.oxirgi_narx)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Yaratilgan: {formatDateTime(product.createdAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

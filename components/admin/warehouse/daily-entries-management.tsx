"use client"

import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, CheckCircle, XCircle, Search, Calendar, Package, Info } from "lucide-react"
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import type { DailyEntry, Product } from "@/types/warehouse"

interface DailyEntriesManagementProps {
  entries: DailyEntry[]
}

export function DailyEntriesManagement({ entries: initialEntries }: DailyEntriesManagementProps) {
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false)
  const [isEditEntryDialogOpen, setIsEditEntryDialogOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    sana: new Date().toISOString().split("T")[0],
    mahsulotlar: [] as {
      productId: string
      nomi: string
      miqdor: number
      birlik: string
      narxi: number
      jami_narxi: number
      tasdiqlangan: boolean
    }[],
    jami_summa: 0,
  })
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null)
  const [newProduct, setNewProduct] = useState({
    productId: "",
    miqdor: 0,
    narxi: 0,
    tasdiqlangan: false,
  })
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // 'all', 'confirmed', 'unconfirmed'
  const { toast } = useToast()

  useEffect(() => {
    const productsQuery = query(collection(db, "warehouse_products"), orderBy("nomi", "asc"))
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[]
      setProducts(productsData)
    })

    return () => unsubscribeProducts()
  }, [])

  const filteredEntries = initialEntries.filter((entry) => {
    const matchesSearch = entry.mahsulotlar.some((p) => p.nomi.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesDate = !dateFilter || entry.sana === dateFilter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "confirmed" && entry.mahsulotlar.every((p) => p.tasdiqlangan)) ||
      (statusFilter === "unconfirmed" && entry.mahsulotlar.some((p) => !p.tasdiqlangan))
    return matchesSearch && matchesDate && matchesStatus
  })

  const addProductToEntry = (isEditing: boolean) => {
    const currentEntry = isEditing ? editingEntry : newEntry
    const setter = isEditing ? setEditingEntry : setNewEntry

    if (!newProduct.productId || newProduct.miqdor <= 0 || newProduct.narxi <= 0) {
      toast({
        title: "Xatolik",
        description: "Mahsulot, miqdor va narxni kiriting",
        variant: "destructive",
      })
      return
    }

    const selectedProduct = products.find((p) => p.id === newProduct.productId)
    if (!selectedProduct) return

    const existingProductIndex = currentEntry?.mahsulotlar.findIndex((p) => p.productId === newProduct.productId)

    const productToAdd = {
      productId: newProduct.productId,
      nomi: selectedProduct.nomi,
      miqdor: newProduct.miqdor,
      birlik: selectedProduct.birlik,
      narxi: newProduct.narxi,
      jami_narxi: newProduct.miqdor * newProduct.narxi,
      tasdiqlangan: newProduct.tasdiqlangan,
    }

    let updatedProducts
    if (existingProductIndex !== undefined && existingProductIndex > -1) {
      updatedProducts = currentEntry?.mahsulotlar.map((p, index) => (index === existingProductIndex ? productToAdd : p))
    } else {
      updatedProducts = [...(currentEntry?.mahsulotlar || []), productToAdd]
    }

    const totalSum = updatedProducts.reduce((sum, p) => sum + p.jami_narxi, 0)

    setter((prev) => ({
      ...(prev as any),
      mahsulotlar: updatedProducts,
      jami_summa: totalSum,
    }))

    setNewProduct({
      productId: "",
      miqdor: 0,
      narxi: 0,
      tasdiqlangan: false,
    })
  }

  const removeProductFromEntry = (index: number, isEditing: boolean) => {
    const currentEntry = isEditing ? editingEntry : newEntry
    const setter = isEditing ? setEditingEntry : setNewEntry

    const updatedProducts = currentEntry?.mahsulotlar.filter((_, i) => i !== index) || []
    const totalSum = updatedProducts.reduce((sum, p) => sum + p.jami_narxi, 0)

    setter((prev) => ({
      ...(prev as any),
      mahsulotlar: updatedProducts,
      jami_summa: totalSum,
    }))
  }

  const handleAddEntry = async () => {
    if (!newEntry.sana || newEntry.mahsulotlar.length === 0) {
      toast({
        title: "Xatolik",
        description: "Sana va kamida bitta mahsulot kiriting",
        variant: "destructive",
      })
      return
    }

    try {
      await addDoc(collection(db, "warehouse_entries"), {
        ...newEntry,
        createdAt: new Date(),
      })
      toast({
        title: "Muvaffaqiyat",
        description: "Kirim yozuvi qo'shildi",
      })
      setIsAddEntryDialogOpen(false)
      setNewEntry({
        sana: new Date().toISOString().split("T")[0],
        mahsulotlar: [],
        jami_summa: 0,
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Kirim yozuvini qo'shishda xatolik yuz berdi",
        variant: "destructive",
      })
      console.error("Error adding document: ", error)
    }
  }

  const handleEditEntry = async () => {
    if (!editingEntry || editingEntry.mahsulotlar.length === 0) {
      toast({
        title: "Xatolik",
        description: "Kamida bitta mahsulot kiriting",
        variant: "destructive",
      })
      return
    }

    try {
      await updateDoc(doc(db, "warehouse_entries", editingEntry.id), {
        ...editingEntry,
        updatedAt: new Date(),
      })
      toast({
        title: "Muvaffaqiyat",
        description: "Kirim yozuvi yangilandi",
      })
      setIsEditEntryDialogOpen(false)
      setEditingEntry(null)
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Kirim yozuvini yangilashda xatolik yuz berdi",
        variant: "destructive",
      })
      console.error("Error updating document: ", error)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "warehouse_entries", id))
      toast({
        title: "Muvaffaqiyat",
        description: "Kirim yozuvi o'chirildi",
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Kirim yozuvini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
      console.error("Error deleting document: ", error)
    }
  }

  const openEditDialog = (entry: DailyEntry) => {
    setEditingEntry(entry)
    setIsEditEntryDialogOpen(true)
  }

  const getProductOptions = (currentProducts: any[]) => {
    const existingProductIds = new Set(currentProducts.map((p) => p.productId))
    return products.filter((p) => !existingProductIds.has(p.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kirimlar Boshqaruvi</h2>
          <p className="text-muted-foreground">Omborxonaga kirim qilingan mahsulotlarni boshqaring</p>
        </div>
        <Dialog open={isAddEntryDialogOpen} onOpenChange={setIsAddEntryDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Yangi Kirim
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yangi Kirim Yozuvi</DialogTitle>
              <DialogDescription>Omborxonaga kirim qilingan mahsulotlar haqida ma'lumot kiriting</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sana">Sana</Label>
                  <Input
                    id="sana"
                    type="date"
                    value={newEntry.sana}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, sana: e.target.value }))}
                  />
                </div>

                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-medium">Mahsulot Qo'shish</h4>
                  <div className="space-y-2">
                    <Label>Mahsulot</Label>
                    <Select
                      value={newProduct.productId}
                      onValueChange={(value) => setNewProduct((prev) => ({ ...prev, productId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mahsulotni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProductOptions(newEntry.mahsulotlar).map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.nomi} ({product.birlik})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Miqdor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newProduct.miqdor || ""}
                        onChange={(e) =>
                          setNewProduct((prev) => ({ ...prev, miqdor: Number.parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Narxi (bir birlik)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newProduct.narxi || ""}
                        onChange={(e) =>
                          setNewProduct((prev) => ({ ...prev, narxi: Number.parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="checkbox"
                      id="tasdiqlangan"
                      checked={newProduct.tasdiqlangan}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, tasdiqlangan: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <Label htmlFor="tasdiqlangan">Tasdiqlangan</Label>
                  </div>
                  <Button onClick={() => addProductToEntry(false)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Mahsulot Qo'shish
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Kirim Mahsulotlari ({formatCurrency(newEntry.jami_summa)})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newEntry.mahsulotlar.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Hali mahsulotlar qo'shilmagan</div>
                  ) : (
                    newEntry.mahsulotlar.map((product, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-background"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.nomi}</span>
                            <Badge variant="outline" className="text-xs">
                              {product.miqdor} {product.birlik}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(product.narxi)} / birlik • Jami: {formatCurrency(product.jami_narxi)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.tasdiqlangan ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <Button variant="outline" size="sm" onClick={() => removeProductFromEntry(index, false)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEntryDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button onClick={handleAddEntry}>Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditEntryDialogOpen} onOpenChange={setIsEditEntryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kirim Yozuvini Tahrirlash</DialogTitle>
              <DialogDescription>Kirim qilingan mahsulotlar ma'lumotlarini tahrirlang</DialogDescription>
            </DialogHeader>
            {editingEntry && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sana">Sana</Label>
                    <Input
                      id="edit-sana"
                      type="date"
                      value={editingEntry.sana}
                      onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, sana: e.target.value } : null))}
                    />
                  </div>

                  <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                    <h4 className="font-medium">Mahsulot Qo'shish/Tahrirlash</h4>
                    <div className="space-y-2">
                      <Label>Mahsulot</Label>
                      <Select
                        value={newProduct.productId}
                        onValueChange={(value) => setNewProduct((prev) => ({ ...prev, productId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mahsulotni tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {getProductOptions(editingEntry.mahsulotlar).map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.nomi} ({product.birlik})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Miqdor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newProduct.miqdor || ""}
                          onChange={(e) =>
                            setNewProduct((prev) => ({ ...prev, miqdor: Number.parseFloat(e.target.value) || 0 }))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Narxi (bir birlik)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newProduct.narxi || ""}
                          onChange={(e) =>
                            setNewProduct((prev) => ({ ...prev, narxi: Number.parseFloat(e.target.value) || 0 }))
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="checkbox"
                        id="edit-tasdiqlangan"
                        checked={newProduct.tasdiqlangan}
                        onChange={(e) => setNewProduct((prev) => ({ ...prev, tasdiqlangan: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="edit-tasdiqlangan">Tasdiqlangan</Label>
                    </div>
                    <Button onClick={() => addProductToEntry(true)} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Mahsulot Qo'shish
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Kirim Mahsulotlari ({formatCurrency(editingEntry.jami_summa)})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingEntry.mahsulotlar.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">Hali mahsulotlar qo'shilmagan</div>
                    ) : (
                      editingEntry.mahsulotlar.map((product, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{product.nomi}</span>
                              <Badge variant="outline" className="text-xs">
                                {product.miqdor} {product.birlik}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(product.narxi)} / birlik • Jami: {formatCurrency(product.jami_narxi)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {product.tasdiqlangan ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <Button variant="outline" size="sm" onClick={() => removeProductFromEntry(index, true)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditEntryDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button onClick={handleEditEntry}>Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mahsulot nomi bo'yicha qidirish..."
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
        <div className="flex items-center gap-2">
          <Label htmlFor="statusFilter" className="text-sm">
            Holat:
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Holatni tanlang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
              <SelectItem value="unconfirmed">Tasdiqlanmagan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Kirim Yozuvlari
          </CardTitle>
          <CardDescription>Omborxonaga kirim qilingan mahsulotlarning ro'yxati</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Info className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Kirim yozuvlari topilmadi</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || dateFilter || statusFilter !== "all"
                  ? "Qidiruv shartlariga mos yozuv topilmadi"
                  : "Hali kirim yozuvlari yaratilmagan"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Mahsulotlar</TableHead>
                    <TableHead>Jami Summa</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{formatDate(entry.sana)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {entry.mahsulotlar.slice(0, 2).map((product, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              <span>
                                {product.nomi} ({product.miqdor} {product.birlik})
                              </span>
                            </div>
                          ))}
                          {entry.mahsulotlar.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{entry.mahsulotlar.length - 2} ta boshqa mahsulot
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(entry.jami_summa)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.mahsulotlar.every((p) => p.tasdiqlangan)
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-yellow-100 text-yellow-800 border-yellow-200"
                          }
                        >
                          {entry.mahsulotlar.every((p) => p.tasdiqlangan) ? "Tasdiqlangan" : "Tasdiqlanmagan"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

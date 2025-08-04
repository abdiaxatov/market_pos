"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, ChefHat, Search, Package, Zap, Droplets, Flame, Users, Edit, Trash2 } from "lucide-react"
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface MenuIngredient {
  productId: string
  product: string
  amount: number
  unit: string
  price: number
  wastageMethod?: string
}

interface MenuItemCost {
  id: string
  menuId: string
  name: string
  ingredients: MenuIngredient[]
  utilities: {
    electricity: number
    gas: number
    water: number
  }
  laborCost: number
  portionSize: number
  estimatedCost: number
  sellingPrice?: number
  profitMargin?: number
  createdAt: Date
  updatedAt: Date
}

interface MenuIntegrationProps {
  menuItems: any[]
  inventory: any[]
}

const wasteMethods = [
  { value: "peeled", label: "Tozalash", percentage: 15 },
  { value: "boiled", label: "Qaynatish", percentage: 5 },
  { value: "cooked", label: "Pishirish", percentage: 8 },
  { value: "trimmed", label: "Kesish", percentage: 10 },
]

export function MenuIntegration({ menuItems, inventory }: MenuIntegrationProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemCost | null>(null)
  const [menuCosts, setMenuCosts] = useState<MenuItemCost[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [newMenuCost, setNewMenuCost] = useState({
    menuId: "",
    ingredients: [] as MenuIngredient[],
    utilities: {
      electricity: 0,
      gas: 0,
      water: 0,
    },
    laborCost: 0,
    portionSize: 1,
  })
  const [newIngredient, setNewIngredient] = useState({
    productId: "",
    amount: 0,
    wastageMethod: "peeled",
  })
  const { toast } = useToast()

  useEffect(() => {
    const menuCostsQuery = query(collection(db, "warehouse_menu_costs"), orderBy("name", "asc"))

    const unsubscribe = onSnapshot(menuCostsQuery, (snapshot) => {
      const costsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MenuItemCost[]
      setMenuCosts(costsData)
    })

    return unsubscribe
  }, [])

  const filteredMenuCosts = menuCosts.filter((item) => {
    return item.name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const addIngredient = () => {
    if (!newIngredient.productId || newIngredient.amount <= 0) {
      toast({
        title: "Xatolik",
        description: "Mahsulot va miqdorni kiriting",
        variant: "destructive",
      })
      return
    }

    const selectedProduct = inventory.find((item) => item.id === newIngredient.productId)
    if (!selectedProduct) return

    const wastePercentage = wasteMethods.find((m) => m.value === newIngredient.wastageMethod)?.percentage || 0
    const actualAmount = newIngredient.amount * (1 + wastePercentage / 100)
    const price = actualAmount * selectedProduct.unitPrice

    const ingredient: MenuIngredient = {
      productId: newIngredient.productId,
      product: selectedProduct.name,
      amount: newIngredient.amount,
      unit: selectedProduct.unit,
      price,
      wastageMethod: newIngredient.wastageMethod,
    }

    setNewMenuCost((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, ingredient],
    }))

    setNewIngredient({
      productId: "",
      amount: 0,
      wastageMethod: "peeled",
    })
  }

  const removeIngredient = (index: number) => {
    setNewMenuCost((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }))
  }

  const calculateTotalCost = () => {
    const ingredientsCost = newMenuCost.ingredients.reduce((sum, ing) => sum + ing.price, 0)
    const utilitiesCost = Object.values(newMenuCost.utilities).reduce((sum, cost) => sum + cost, 0)
    return ingredientsCost + utilitiesCost + newMenuCost.laborCost
  }

  const saveMenuCost = async () => {
    if (!newMenuCost.menuId || newMenuCost.ingredients.length === 0) {
      toast({
        title: "Xatolik",
        description: "Menyu taomini tanlang va ingredientlar qo'shing",
        variant: "destructive",
      })
      return
    }

    const selectedMenu = menuItems.find((item) => item.id === newMenuCost.menuId)
    if (!selectedMenu) return

    const estimatedCost = calculateTotalCost()

    const menuCostData = {
      menuId: newMenuCost.menuId,
      name: selectedMenu.name,
      ingredients: newMenuCost.ingredients,
      utilities: newMenuCost.utilities,
      laborCost: newMenuCost.laborCost,
      portionSize: newMenuCost.portionSize,
      estimatedCost,
      sellingPrice: selectedMenu.price,
      profitMargin: selectedMenu.price ? ((selectedMenu.price - estimatedCost) / selectedMenu.price) * 100 : 0,
      updatedAt: new Date(),
    }

    try {
      if (editingItem) {
        await updateDoc(doc(db, "warehouse_menu_costs", editingItem.id), menuCostData)
        toast({
          title: "Muvaffaqiyat",
          description: "Menyu narxi yangilandi",
        })
      } else {
        await addDoc(collection(db, "warehouse_menu_costs"), {
          ...menuCostData,
          createdAt: new Date(),
        })
        toast({
          title: "Muvaffaqiyat",
          description: "Menyu narxi qo'shildi",
        })
      }

      closeDialog()
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Menyu narxini saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const deleteMenuCost = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "warehouse_menu_costs", itemId))
      toast({
        title: "Muvaffaqiyat",
        description: "Menyu narxi o'chirildi",
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Menyu narxini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const editMenuCost = (item: MenuItemCost) => {
    setEditingItem(item)
    setNewMenuCost({
      menuId: item.menuId,
      ingredients: [...item.ingredients],
      utilities: { ...item.utilities },
      laborCost: item.laborCost,
      portionSize: item.portionSize,
    })
    setIsAddDialogOpen(true)
  }

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingItem(null)
    setNewMenuCost({
      menuId: "",
      ingredients: [],
      utilities: { electricity: 0, gas: 0, water: 0 },
      laborCost: 0,
      portionSize: 1,
    })
    setNewIngredient({
      productId: "",
      amount: 0,
      wastageMethod: "peeled",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Menyu Integratsiyasi</h2>
          <p className="text-muted-foreground">Menyu taomlarining narxini hisoblang va boshqaring</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Menyu Narxi Qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Menyu Narxini Tahrirlash" : "Yangi Menyu Narxi"}</DialogTitle>
              <DialogDescription>Taom ingredientlari va xarajatlarini hisoblang</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Asosiy Ma'lumotlar</h3>

                <div className="space-y-2">
                  <Label htmlFor="menuId">Menyu Taomi</Label>
                  <Select
                    value={newMenuCost.menuId}
                    onValueChange={(value) => setNewMenuCost((prev) => ({ ...prev, menuId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Taomni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            <span className="text-xs text-muted-foreground">Narx: {formatCurrency(item.price)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portionSize">Porsiya Hajmi</Label>
                  <Input
                    id="portionSize"
                    type="number"
                    value={newMenuCost.portionSize || ""}
                    onChange={(e) =>
                      setNewMenuCost((prev) => ({ ...prev, portionSize: Number.parseInt(e.target.value) || 1 }))
                    }
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="laborCost">Ish Haqi (so'm)</Label>
                  <Input
                    id="laborCost"
                    type="number"
                    value={newMenuCost.laborCost || ""}
                    onChange={(e) =>
                      setNewMenuCost((prev) => ({ ...prev, laborCost: Number.parseInt(e.target.value) || 0 }))
                    }
                    placeholder="0"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Kommunal Xarajatlar (so'm)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Elektr
                      </Label>
                      <Input
                        type="number"
                        value={newMenuCost.utilities.electricity || ""}
                        onChange={(e) =>
                          setNewMenuCost((prev) => ({
                            ...prev,
                            utilities: {
                              ...prev.utilities,
                              electricity: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        Gaz
                      </Label>
                      <Input
                        type="number"
                        value={newMenuCost.utilities.gas || ""}
                        onChange={(e) =>
                          setNewMenuCost((prev) => ({
                            ...prev,
                            utilities: {
                              ...prev.utilities,
                              gas: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        Suv
                      </Label>
                      <Input
                        type="number"
                        value={newMenuCost.utilities.water || ""}
                        onChange={(e) =>
                          setNewMenuCost((prev) => ({
                            ...prev,
                            utilities: {
                              ...prev.utilities,
                              water: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">Narx Hisoblash</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Ingredientlar:</span>
                      <span>{formatCurrency(newMenuCost.ingredients.reduce((sum, ing) => sum + ing.price, 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kommunal:</span>
                      <span>
                        {formatCurrency(Object.values(newMenuCost.utilities).reduce((sum, cost) => sum + cost, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ish haqi:</span>
                      <span>{formatCurrency(newMenuCost.laborCost)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-blue-800">
                      <span>Jami:</span>
                      <span>{formatCurrency(calculateTotalCost())}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Ingredientlar</h3>

                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-medium">Ingredient Qo'shish</h4>

                  <div className="space-y-2">
                    <Label>Mahsulot</Label>
                    <Select
                      value={newIngredient.productId}
                      onValueChange={(value) => setNewIngredient((prev) => ({ ...prev, productId: value }))}
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
                                {formatCurrency(item.unitPrice)}/{item.unit}
                              </span>
                            </div>
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
                        step="0.1"
                        value={newIngredient.amount || ""}
                        onChange={(e) =>
                          setNewIngredient((prev) => ({ ...prev, amount: Number.parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Yo'qotish Usuli</Label>
                      <Select
                        value={newIngredient.wastageMethod}
                        onValueChange={(value) => setNewIngredient((prev) => ({ ...prev, wastageMethod: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {wasteMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label} ({method.percentage}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={addIngredient} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Ingredient Qo'shish
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newMenuCost.ingredients.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Hali ingredientlar qo'shilmagan</div>
                  ) : (
                    newMenuCost.ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-background"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{ingredient.product}</div>
                          <div className="text-sm text-muted-foreground">
                            {ingredient.amount} {ingredient.unit} • {formatCurrency(ingredient.price)}
                            {ingredient.wastageMethod && (
                              <span className="ml-2 text-orange-600">
                                ({wasteMethods.find((m) => m.value === ingredient.wastageMethod)?.label})
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => removeIngredient(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Bekor qilish
              </Button>
              <Button onClick={saveMenuCost}>{editingItem ? "Yangilash" : "Saqlash"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Menyu taomlarini qidirish..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredMenuCosts.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ChefHat className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Menyu narxlari yo'q</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm ? "Qidiruv shartlariga mos taom topilmadi" : "Birinchi menyu narxingizni qo'shing"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredMenuCosts.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {item.portionSize} porsiya
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => editMenuCost(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMenuCost(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ingredientlar:</span>
                    <span>{formatCurrency(item.ingredients.reduce((sum, ing) => sum + ing.price, 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Kommunal:</span>
                    <span>{formatCurrency(Object.values(item.utilities).reduce((sum, cost) => sum + cost, 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ish haqi:</span>
                    <span>{formatCurrency(item.laborCost)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Tannarx:</span>
                    <span>{formatCurrency(item.estimatedCost)}</span>
                  </div>
                </div>

                {item.sellingPrice && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-green-600">Sotuv narxi:</span>
                      <span className="font-bold text-green-800">{formatCurrency(item.sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600">Foyda:</span>
                      <span className="font-bold text-green-800">
                        {formatCurrency(item.sellingPrice - item.estimatedCost)}({item.profitMargin?.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{item.ingredients.length} ta ingredient</span>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {item.utilities.electricity > 0 && (
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      <span>{formatCurrency(item.utilities.electricity)}</span>
                    </div>
                  )}
                  {item.utilities.gas > 0 && (
                    <div className="flex items-center gap-1">
                      <Flame className="h-4 w-4" />
                      <span>{formatCurrency(item.utilities.gas)}</span>
                    </div>
                  )}
                  {item.utilities.water > 0 && (
                    <div className="flex items-center gap-1">
                      <Droplets className="h-4 w-4" />
                      <span>{formatCurrency(item.utilities.water)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { collection, doc, updateDoc, serverTimestamp, getDocs, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { ShoppingBag, Search, Plus, Minus, Trash2, Printer, Save } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { v4 as uuidv4 } from "uuid"
import Image from "next/image"

// Electron API type declaration
declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (html: string) => void
    }
  }
}

interface OrderItem {
  name: string
  price: number
  quantity: number
  notes?: string
  categoryId?: string
}

interface Order {
  id: string
  items: OrderItem[]
  total: number
  subtotal?: number
  deliveryFee?: number
  containerCost?: number
  customerName: string
  phoneNumber: string
  address: string
  status: "pending" | "preparing" | "ready" | "delivered" | "paid"
  orderType: "saboy"
  createdAt: any
  deliveredAt?: any
  paidAt?: any
  isPaid?: boolean
  notes?: string
  paymentMethod?: string
  deliveryTime?: string
  priority?: "normal" | "urgent"
}

interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  categoryId: string
  imageUrl?: string
  isAvailable: boolean
  remainingServings: number
  servesCount: number
  containerPrice: number
  needsContainer: boolean
}

interface CartItem {
  id: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  categoryId?: string
}

interface Category {
  id: string
  name: string
}

// Helper function to format date and time
const formatDateTime = (timestamp: any) => {
  if (!timestamp) return { date: "N/A", time: "N/A" }

  let date: Date
  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    date = timestamp.toDate()
  } else if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === "number") {
    date = new Date(timestamp)
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp)
  } else {
    return { date: "N/A", time: "N/A" }
  }

  if (isNaN(date.getTime())) {
    return { date: "N/A", time: "N/A" }
  }

  return {
    date: new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date),
    time: new Intl.DateTimeFormat("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  }
}

// Generate receipt HTML for Saboy orders
const generateSaboyReceiptHTML = (orderId: string, orderData: any) => {
  const date = new Date()
  const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Saboy Chek - ${orderId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      width: 72mm;
      height: auto;
      padding: 0;
      margin: 0;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: black;
      line-height: 1.2;
      position: relative;
      top: 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-bottom: 1px;
    }
    .items-header,
    .item {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
      gap: 5px;
      font-weight: bold;
      padding: 1px 0;
    }
    .item-name {
      flex: 1;
      min-width: 80px;
      word-break: break-word;
    }
    .item-qty {
      width: 30px;
      text-align: center;
      flex-shrink: 0;
    }
    .item-total {
      width: 100px;
      text-align: right;
      flex-shrink: 0;
    }
    .divider {
      margin: 2px 0;
      border-top: 2px solid black;
    }
    .total-section {
      margin-top: 10px;
      padding-top: 5px;
      border-top: 2px solid black;
    }
    .total-row {
      display: flex;
      justify-content: center;
      font-size: 18px;
      font-weight: bold;
    }
    @media print {
      @page {
        size: 72mm auto;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="info-row"><span>Sana:</span><span>${formattedDate}</span></div>
  <div class="info-row"><span>Kassir:</span><span>Saboy Admin</span></div>
  <div class="divider"></div>
  <div class="items-header">
    <div class="item-name">TAOM</div>
    <div class="item-qty">SONI</div>
    <div class="item-total">JAMI</div>
  </div>
  <div class="divider"></div>
  ${orderData.items
    .map(
      (item: any) => `
    <div class="item">
      <div class="item-name">${item.name}</div>
      <div class="item-qty">${item.quantity}</div>
      <div class="item-total">${formatCurrency(item.price * item.quantity)}</div>
    </div>
  `,
    )
    .join("")}
  <div class="total-section">
    <div class="total-row">
      <span>JAMI:</span>
      <span>${formatCurrency(orderData.total)}</span>
    </div>
  </div>
  <div class="divider"></div>
</body>
</html>`
}

export function SaboyPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const printFrameRef = useRef<HTMLIFrameElement | null>(null)
  const { toast } = useToast()

  // Fetch menu items and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch categories
        const categoriesSnapshot = await getDocs(collection(db, "categories"))
        const categoriesData = categoriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }))
        setCategories(categoriesData)

        // Fetch menu items
        const menuItemsSnapshot = await getDocs(collection(db, "menuItems"))
        const menuItemsData = menuItemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MenuItem[]

        setMenuItems(menuItemsData)
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setIsLoading(false)
        toast({
          title: "Xatolik",
          description: "Ma'lumotlarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    }

    fetchData()
  }, [toast])

  // Filter menu items
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory
    return matchesSearch && matchesCategory && item.isAvailable
  })

  // Add to cart
  const addToCart = useCallback(
    (item: MenuItem) => {
      if (item.remainingServings <= 0 || !item.isAvailable) {
        toast({
          title: "Mavjud emas",
          description: "Bu taom hozirda mavjud emas",
          variant: "destructive",
        })
        return
      }

      setCartItems((prevItems) => {
        const existingItem = prevItems.find((cartItem) => cartItem.menuItemId === item.id)

        if (existingItem && existingItem.quantity >= item.remainingServings) {
          toast({
            title: "Yetarli emas",
            description: `Faqat ${item.remainingServings} ta qolgan`,
            variant: "destructive",
          })
          return prevItems
        }

        if (existingItem) {
          return prevItems.map((cartItem) =>
            cartItem.menuItemId === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
          )
        } else {
          return [
            ...prevItems,
            {
              id: uuidv4(),
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity: 1,
              categoryId: item.categoryId, // Add categoryId to cart item
            },
          ]
        }
      })
    },
    [toast],
  )

  // Update quantity
  const updateQuantity = useCallback(
    (id: string, newQuantity: number) => {
      if (newQuantity <= 0) {
        removeFromCart(id)
        return
      }

      const cartItem = cartItems.find((item) => item.id === id)
      if (!cartItem) return

      const menuItem = menuItems.find((item) => item.id === cartItem.menuItemId)
      if (!menuItem) return

      if (newQuantity > menuItem.remainingServings) {
        toast({
          title: "Yetarli emas",
          description: `Faqat ${menuItem.remainingServings} ta qolgan`,
          variant: "destructive",
        })
        return
      }

      setCartItems((prevItems) => prevItems.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)))
    },
    [cartItems, menuItems, toast],
  )

  // Remove from cart
  const removeFromCart = useCallback((id: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id))
  }, [])

  // Clear cart
  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  // Calculate subtotal
  const calculateSubtotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  }, [cartItems])

  // Handle save order
  const handleSaveOrder = useCallback(async () => {
    if (cartItems.length === 0) {
      toast({
        title: "Buyurtma bo'sh",
        description: "Iltimos, kamida bitta taom tanlang",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      const subtotal = calculateSubtotal()
      const total = subtotal

      const orderData = {
        orderType: "saboy",
        status: "paid",
        isPaid: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        items: cartItems.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          categoryId: item.categoryId, // Include categoryId in order items
        })),
        subtotal,
        total,
        customerName: "Saboy mijozi",
        customerPhone: "",
        notes: "",
      }

      await addDoc(collection(db, "orders"), orderData)

      // Update remaining servings
      for (const cartItem of cartItems) {
        const menuItem = menuItems.find((item) => item.id === cartItem.menuItemId)
        if (menuItem) {
          setMenuItems((prevItems) =>
            prevItems.map((item) =>
              item.id === cartItem.menuItemId
                ? { ...item, remainingServings: item.remainingServings - cartItem.quantity }
                : item,
            ),
          )

          await updateDoc(doc(db, "menuItems", cartItem.menuItemId), {
            remainingServings: menuItem.remainingServings - cartItem.quantity,
          })
        }
      }

      toast({
        title: "Buyurtma saqlandi",
        description: "Saboy buyurtmasi muvaffaqiyatli saqlandi",
      })

      clearCart()
    } catch (error) {
      console.error("Error saving order:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmani saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [cartItems, calculateSubtotal, clearCart, menuItems, toast])

  // Handle print receipt
  const handlePrintReceipt = useCallback(async () => {
    if (cartItems.length === 0) {
      toast({
        title: "Buyurtma bo'sh",
        description: "Iltimos, kamida bitta taom tanlang",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      const subtotal = calculateSubtotal()
      const total = subtotal

      const orderData = {
        orderType: "saboy",
        status: "paid",
        isPaid: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        items: cartItems.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          categoryId: item.categoryId, // Include categoryId in order items
        })),
        subtotal,
        total,
        customerName: "Saboy mijozi",
        customerPhone: "",
        notes: "",
      }

      const orderRef = await addDoc(collection(db, "orders"), orderData)

      // Update remaining servings
      for (const cartItem of cartItems) {
        const menuItem = menuItems.find((item) => item.id === cartItem.menuItemId)
        if (menuItem) {
          setMenuItems((prevItems) =>
            prevItems.map((item) =>
              item.id === cartItem.menuItemId
                ? { ...item, remainingServings: item.remainingServings - cartItem.quantity }
                : item,
            ),
          )

          await updateDoc(doc(db, "menuItems", cartItem.menuItemId), {
            remainingServings: menuItem.remainingServings - cartItem.quantity,
          })
        }
      }

      const receiptDisplayData = {
        ...orderData,
        createdAt: new Date(),
      }

      const receiptHTML = generateSaboyReceiptHTML(orderRef.id, receiptDisplayData)

      console.log("Saboy chek chop etish boshlandi")
      console.log("Electron API mavjudmi?", !!window.electronAPI)

      if (window.electronAPI && window.electronAPI.printReceipt) {
        console.log("Electron API orqali chop etilmoqda")
        window.electronAPI.printReceipt(receiptHTML)
        toast({
          title: "Buyurtma saqlandi va chop etildi",
          description: "Saboy buyurtmasi muvaffaqiyatli saqlandi va chek chop etildi",
        })
        clearCart()
        setIsSaving(false)
      } else {
        console.log("Brauzer orqali chop etilmoqda")
        // Create iframe for printing
        if (!printFrameRef.current) {
          const iframe = document.createElement("iframe")
          iframe.style.position = "fixed"
          iframe.style.right = "0"
          iframe.style.bottom = "0"
          iframe.style.width = "0"
          iframe.style.height = "0"
          iframe.style.border = "0"
          iframe.style.visibility = "hidden"
          document.body.appendChild(iframe)
          printFrameRef.current = iframe
        }

        const frameDoc = printFrameRef.current.contentDocument
        if (frameDoc) {
          frameDoc.open()
          frameDoc.write(receiptHTML)
          frameDoc.close()

          setTimeout(() => {
            if (printFrameRef.current?.contentWindow) {
              printFrameRef.current.contentWindow.focus()
              printFrameRef.current.contentWindow.print()
            }
            toast({
              title: "Buyurtma saqlandi va chop etildi",
              description: "Saboy buyurtmasi muvaffaqiyatli saqlandi va chek chop etildi",
            })
            clearCart()
            setIsSaving(false)
          }, 500)
        }
      }
    } catch (error) {
      console.error("Error saving order or printing:", error)
      toast({
        title: "Xatolik",
        description: "Buyurtmani saqlashda yoki chop etishda xatolik yuz berdi",
        variant: "destructive",
      })
      setIsSaving(false)
    }
  }, [cartItems, calculateSubtotal, clearCart, menuItems, toast])

  // Get category name
  const getCategoryName = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId)
      return category ? category.name : ""
    },
    [categories],
  )

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p>Saboy sahifasi yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Saboy buyurtmalari</h1>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Taom qidirish..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-shrink-0 overflow-x-auto pb-1">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory("all")}
                >
                  Barchasi
                </Badge>
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Menu Items */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Taomlar</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredMenuItems.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {filteredMenuItems.map((item) => {
                    const isOutOfStock = item.remainingServings <= 0 || !item.isAvailable
                    return (
                      <div
                        key={item.id}
                        className={`relative overflow-hidden rounded-lg border transition-all ${
                          isOutOfStock ? "opacity-60 grayscale" : "cursor-pointer hover:border-primary hover:shadow-md"
                        }`}
                        onClick={() => !isOutOfStock && addToCart(item)}
                      >
                        <div className="relative h-40 w-full">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl || "/placeholder.svg"}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 668px) 100vw, (max-width: 1000px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                              <span className="text-muted-foreground">Rasm yo'q</span>
                            </div>
                          )}
                          <div className="absolute right-2 top-2">
                            <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="opacity-70">
                              {isOutOfStock ? "Mavjud emas" : `${item.remainingServings} `}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium line-clamp-1">{item.name}</h3>
                          </div>
                          {item.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-semibold text-primary">{formatCurrency(item.price)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">Taomlar topilmadi</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Saboy savati
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-y-auto max-h-72">
                  {cartItems.length > 0 ? (
                    <div className="space-y-3">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(item.price)} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 rounded-full p-0 bg-transparent"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 rounded-full p-0 bg-transparent"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-full p-0 text-destructive"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">Savat bo'sh</p>
                    </div>
                  )}
                </div>

                {cartItems.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span>Jami:</span>
                        <span className="font-semibold">{formatCurrency(calculateSubtotal())}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handlePrintReceipt}
                        className="w-full"
                        disabled={isSaving || cartItems.length === 0}
                      >
                        {isSaving ? (
                          <div className="flex items-center">
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Chop etilmoqda...
                          </div>
                        ) : (
                          <>
                            <Printer className="mr-2 h-4 w-4" />
                            Chop etish
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleSaveOrder}
                        variant="outline"
                        className="w-full bg-transparent"
                        disabled={isSaving || cartItems.length === 0}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Saqlash
                      </Button>
                      <Button
                        onClick={clearCart}
                        variant="ghost"
                        className="w-full"
                        disabled={isSaving || cartItems.length === 0}
                      >
                        Tozalash
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

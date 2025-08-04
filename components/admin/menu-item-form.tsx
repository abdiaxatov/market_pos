"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface MenuItem {
  id?: string
  name: string
  description: string
  price: number
  category: string
  image: string
  available: boolean
  needsContainer: boolean
}

interface MenuItemFormProps {
  item?: MenuItem
  onSuccess: () => void
  onCancel: () => void
}

export function MenuItemForm({ item, onSuccess, onCancel }: MenuItemFormProps) {
  const [name, setName] = useState(item?.name || "")
  const [description, setDescription] = useState(item?.description || "")
  const [price, setPrice] = useState(item?.price?.toString() || "")
  const [category, setCategory] = useState(item?.category || "")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(item?.image || "")
  const [available, setAvailable] = useState(item?.available !== false)
  const [needsContainer, setNeedsContainer] = useState(item?.needsContainer || false)
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesSnapshot = await getDocs(collection(db, "categories"))
        const categoriesList = categoriesSnapshot.docs.map((doc) => doc.data().name)
        setCategories(categoriesList)
      } catch (error) {
        console.error("Error fetching categories:", error)
        toast({
          title: "Xatolik",
          description: "Kategoriyalarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    }

    fetchCategories()
  }, [toast])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return

    try {
      // Check if category already exists
      const categoryQuery = query(collection(db, "categories"), where("name", "==", newCategory))
      const categorySnapshot = await getDocs(categoryQuery)

      if (categorySnapshot.empty) {
        await addDoc(collection(db, "categories"), {
          name: newCategory,
          createdAt: new Date(),
        })

        setCategories([...categories, newCategory])
        setCategory(newCategory)
        setNewCategory("")
        setShowNewCategoryInput(false)

        toast({
          title: "Kategoriya qo'shildi",
          description: `"${newCategory}" kategoriyasi muvaffaqiyatli qo'shildi`,
        })
      } else {
        toast({
          title: "Kategoriya mavjud",
          description: `"${newCategory}" kategoriyasi allaqachon mavjud`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding category:", error)
      toast({
        title: "Xatolik",
        description: "Kategoriyani qo'shishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      let imageUrl = item?.image || ""

      // Upload image if a new one is selected
      if (image) {
        const storageRef = ref(storage, `menu-items/${Date.now()}_${image.name}`)
        await uploadBytes(storageRef, image)
        imageUrl = await getDownloadURL(storageRef)
      }

      const menuItemData = {
        name,
        description,
        price: Number(price),
        category,
        image: imageUrl,
        available,
        needsContainer,
        updatedAt: new Date(),
      }

      if (item?.id) {
        // Update existing item
        await updateDoc(doc(db, "menu-items", item.id), menuItemData)
        toast({
          title: "Taom yangilandi",
          description: `"${name}" muvaffaqiyatli yangilandi`,
        })
      } else {
        // Add new item
        await addDoc(collection(db, "menu-items"), {
          ...menuItemData,
          createdAt: new Date(),
        })
        toast({
          title: "Taom qo'shildi",
          description: `"${name}" muvaffaqiyatli qo'shildi`,
        })
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving menu item:", error)
      toast({
        title: "Xatolik",
        description: "Taomni saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Taom nomi</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Taom nomini kiriting"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Taom haqida</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Taom haqida ma'lumot kiriting"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Narxi (so'm)</Label>
        <Input
          id="price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Taom narxini kiriting"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Kategoriya</Label>
        {showNewCategoryInput ? (
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Yangi kategoriya nomi"
            />
            <Button type="button" onClick={handleAddCategory} variant="outline">
              Qo'shish
            </Button>
            <Button
              type="button"
              onClick={() => setShowNewCategoryInput(false)}
              variant="ghost"
              size="icon"
              className="h-10 w-10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kategoriyani tanlang" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => setShowNewCategoryInput(true)}
              variant="outline"
              className="whitespace-nowrap"
            >
              Yangi kategoriya
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Taom rasmi</Label>
        <Input id="image" type="file" accept="image/*" onChange={handleImageChange} className="cursor-pointer" />
        {imagePreview && (
          <div className="mt-2">
            <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="h-40 w-40 rounded-md object-cover" />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="available" checked={available} onCheckedChange={setAvailable} />
        <Label htmlFor="available">Mavjud</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="needsContainer" checked={needsContainer} onCheckedChange={setNeedsContainer} />
        <Label htmlFor="needsContainer">Bir martalik idish kerak</Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saqlanmoqda...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Saqlash
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

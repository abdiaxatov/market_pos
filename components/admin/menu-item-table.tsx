"use client"

import { useState } from "react"
import { doc, deleteDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"
import { Edit, Trash2 } from "lucide-react"
import type { MenuItem, Category } from "@/types"

interface MenuItemTableProps {
  items: MenuItem[]
  categories: Category[]
  onEdit: (item: MenuItem) => void
}

export function MenuItemTable({ items, categories, onEdit }: MenuItemTableProps) {
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  if (items.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">Menyu elementlari topilmadi</div>
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : "Kategoriya topilmadi"
  }

  const handleDeleteItem = async () => {
    if (!deleteItemId) return

    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, "menuItems", deleteItemId))
      toast({
        title: "Taom o'chirildi",
        description: "Menyu elementi muvaffaqiyatli o'chirildi",
      })
    } catch (error) {
      console.error("Error deleting menu item:", error)
      toast({
        title: "Xatolik",
        description: "Menyu elementini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteItemId(null)
    }
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await updateDoc(doc(db, "menuItems", item.id), {
        isAvailable: !item.isAvailable,
      })

      toast({
        title: item.isAvailable ? "Taom yashirildi" : "Taom ko'rsatildi",
        description: item.isAvailable ? "Taom mijozlar uchun yashirildi" : "Taom mijozlar uchun ko'rsatildi",
      })
    } catch (error) {
      console.error("Error updating menu item availability:", error)
      toast({
        title: "Xatolik",
        description: "Taom holatini o'zgartirishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  // Group items by category
  const itemsByCategory = items.reduce(
    (acc, item) => {
      const categoryName = getCategoryName(item.categoryId)
      if (!acc[categoryName]) {
        acc[categoryName] = []
      }
      acc[categoryName].push(item)
      return acc
    },
    {} as Record<string, MenuItem[]>,
  )

  return (
    <div className="space-y-8">
      {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
        <div key={category}>
          <h2 className="mb-4 text-xl font-semibold">{category}</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomi</TableHead>
                  <TableHead>Narxi</TableHead>
                  <TableHead>Porsiya</TableHead>
                  <TableHead>Mavjud</TableHead>
                  <TableHead className="w-[100px]">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>{item.servesCount} kishi</TableCell>
                    <TableCell>
                      <Switch checked={item.isAvailable} onCheckedChange={() => handleToggleAvailability(item)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteItemId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taomni o'chirishni tasdiqlaysizmi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu amal qaytarib bo'lmaydi. Bu taom menyu ro'yxatidan butunlay o'chiriladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "O'chirilmoqda..." : "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save } from "lucide-react"

export function SettingsPage() {
  const [settings, setSettings] = useState({
    deliveryAvailable: true,
    deliveryFee: 15000,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "orderSettings"))
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          setSettings({
            deliveryAvailable: data.deliveryAvailable !== false,
            deliveryFee: data.deliveryFee || 15000,
          })
        }
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching settings:", error)
        toast({
          title: "Xatolik",
          description: "Sozlamalarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [toast])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "settings", "orderSettings"), settings)
      toast({
        title: "Sozlamalar saqlandi",
        description: "Sozlamalar muvaffaqiyatli saqlandi",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Xatolik",
        description: "Sozlamalarni saqlashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">Sozlamalar</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Yetkazib berish sozlamalari</CardTitle>
              <CardDescription>Yetkazib berish xizmatini sozlash</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="delivery-available">Yetkazib berish xizmati</Label>
                  <p className="text-sm text-muted-foreground">Yetkazib berish xizmatini yoqish yoki o'chirish</p>
                </div>
                <Switch
                  id="delivery-available"
                  checked={settings.deliveryAvailable}
                  onCheckedChange={(checked) => setSettings({ ...settings, deliveryAvailable: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery-fee">Yetkazib berish narxi (so'm)</Label>
                <Input
                  id="delivery-fee"
                  type="number"
                  value={settings.deliveryFee}
                  onChange={(e) => setSettings({ ...settings, deliveryFee: Number(e.target.value) })}
                />
              </div>

              <Button onClick={handleSaveSettings} disabled={isSaving} className="mt-4">
                {isSaving ? (
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
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

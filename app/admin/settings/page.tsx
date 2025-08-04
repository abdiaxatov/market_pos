"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save, Truck, Clock, MapPin, Phone } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface DeliverySettings {
  deliveryAvailable: boolean
  deliveryFee: number
  deliveryTime: string
  deliveryRadius: string
  deliveryPhone: string
  defaultContainerPrice: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<DeliverySettings>({
    deliveryAvailable: false,
    deliveryFee: 15000,
    deliveryTime: "30-45 daqiqa",
    deliveryRadius: "5km radiusda",
    deliveryPhone: "+998 90 123 45 67",
    defaultContainerPrice: 2000,
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
            deliveryTime: data.deliveryTime || "30-45 daqiqa",
            deliveryRadius: data.deliveryRadius || "5km radiusda",
            deliveryPhone: data.deliveryPhone || "+998 90 123 45 67",
            defaultContainerPrice: data.defaultContainerPrice || 2000,
          })
        }
      } catch (error) {
        console.error("Error fetching settings:", error)
        toast({
          title: "Xatolik",
          description: "Sozlamalarni yuklashda xatolik yuz berdi",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [toast])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      await setDoc(
        doc(db, "settings", "orderSettings"),
        {
          ...settings,
          updatedAt: new Date(),
        },
        { merge: true },
      )

      toast({
        title: "Muvaffaqiyatli saqlandi",
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

  const handleInputChange = (field: keyof DeliverySettings, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <div>
      <div className="container mx-auto p-6">
        <h1 className="mb-6 text-2xl font-bold">Sozlamalar</h1>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Yetkazib berish sozlamalari
                </CardTitle>
                <CardDescription>Yetkazib berish xizmati va narxlarini sozlash</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Delivery Available Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="delivery-toggle">Yetkazib berish xizmati</Label>
                    <p className="text-sm text-muted-foreground">Yetkazib berish xizmatini yoqish yoki o'chirish</p>
                  </div>
                  <Switch
                    id="delivery-toggle"
                    checked={settings.deliveryAvailable}
                    onCheckedChange={(checked) => handleInputChange("deliveryAvailable", checked)}
                  />
                </div>

                <Separator />

                {/* Delivery Fee */}
                <div className="space-y-2">
                  <Label htmlFor="delivery-fee" className="flex items-center gap-2">
                    <span>Yetkazib berish narxi (UZS)</span>
                  </Label>
                  <Input
                    id="delivery-fee"
                    type="number"
                    value={settings.deliveryFee}
                    onChange={(e) => handleInputChange("deliveryFee", Number(e.target.value))}
                    placeholder="15000"
                    min="0"
                    disabled={!settings.deliveryAvailable}
                  />
                  <p className="text-sm text-muted-foreground">Yetkazib berish uchun standart narx</p>
                </div>

                {/* Delivery Time */}
                <div className="space-y-2">
                  <Label htmlFor="delivery-time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Yetkazib berish vaqti
                  </Label>
                  <Input
                    id="delivery-time"
                    type="text"
                    value={settings.deliveryTime}
                    onChange={(e) => handleInputChange("deliveryTime", e.target.value)}
                    placeholder="30-45 daqiqa"
                    disabled={!settings.deliveryAvailable}
                  />
                  <p className="text-sm text-muted-foreground">Yetkazib berish uchun taxminiy vaqt</p>
                </div>

                {/* Delivery Radius */}
                <div className="space-y-2">
                  <Label htmlFor="delivery-radius" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Yetkazib berish radiusi
                  </Label>
                  <Input
                    id="delivery-radius"
                    type="text"
                    value={settings.deliveryRadius}
                    onChange={(e) => handleInputChange("deliveryRadius", e.target.value)}
                    placeholder="5km radiusda"
                    disabled={!settings.deliveryAvailable}
                  />
                  <p className="text-sm text-muted-foreground">Yetkazib berish xizmati radiusi</p>
                </div>

                {/* Delivery Phone */}
                <div className="space-y-2">
                  <Label htmlFor="delivery-phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Yetkazib berish telefoni
                  </Label>
                  <Input
                    id="delivery-phone"
                    type="tel"
                    value={settings.deliveryPhone}
                    onChange={(e) => handleInputChange("deliveryPhone", e.target.value)}
                    placeholder="+998 90 123 45 67"
                    disabled={!settings.deliveryAvailable}
                  />
                  <p className="text-sm text-muted-foreground">Yetkazib berish uchun aloqa telefoni</p>
                </div>

                <Separator />

                {/* Container Price */}
                <div className="space-y-2">
                  <Label htmlFor="container-price">Standart idish narxi (UZS)</Label>
                  <Input
                    id="container-price"
                    type="number"
                    value={settings.defaultContainerPrice}
                    onChange={(e) => handleInputChange("defaultContainerPrice", Number(e.target.value))}
                    placeholder="2000"
                    min="0"
                  />
                  <p className="text-sm text-muted-foreground">Yetkazib berish uchun standart idish narxi</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={isSaving}>
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

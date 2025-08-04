"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { collection, doc, addDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, ImageIcon, CuboidIcon as Cube, X, Plus, Upload, AlertTriangle } from "lucide-react"
import type { MenuItem, Category } from "@/types"
import { uploadToGitHub } from "@/lib/github-upload"
import EmbeddedModelViewer from "@/components/embedded-3d-viewer"

interface MenuItemFormProps {
  item?: MenuItem | null
  categories: Category[]
  open: boolean
  onClose: () => void
}

export function MenuItemForm({ item, categories, open, onClose }: MenuItemFormProps) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    price: item?.price ? item.price.toString() : "",
    categoryId: item?.categoryId || "",
    description: item?.description || "",
    imageUrl: item?.imageUrl || "",
    modelUrl: item?.modelUrl || "",
    servesCount: item?.servesCount ? item.servesCount.toString() : "1",
    isAvailable: item?.isAvailable !== false,
    needsContainer: item?.needsContainer || false,
    containerPrice: item?.containerPrice ? item.containerPrice.toString() : "2000",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImageValid, setIsImageValid] = useState(false)
  const [isCheckingImage, setIsCheckingImage] = useState(false)
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isUploadingModel, setIsUploadingModel] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [modelUrlError, setModelUrlError] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState("Hech qanday fayl tanlanmagan")
  const [modelFileName, setModelFileName] = useState("Hech qanday fayl tanlanmagan")

  const imageInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Validate model URL with enhanced checking
  const validateModelUrl = async (url: string) => {
    if (!url) {
      setModelUrlError(null)
      return
    }

    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname.toLowerCase()
      if (!pathname.endsWith(".glb") && !pathname.endsWith(".gltf")) {
        setModelUrlError("URL .glb yoki .gltf fayl bilan tugashi kerak")
        return
      }

      // Test if URL is accessible (with timeout)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          setModelUrlError(`Server xatolik: ${response.status}`)
          return
        }

        const contentType = response.headers.get("content-type")
        if (contentType && (contentType.includes("text/html") || contentType.includes("application/json"))) {
          setModelUrlError("URL HTML sahifa qaytarmoqda, 3D model emas")
          return
        }

        setModelUrlError(null)
      } catch (fetchError: any) {
        if (fetchError.name === "AbortError") {
          setModelUrlError("URL ga ulanish vaqti tugadi")
        } else {
          setModelUrlError("URL ga ulanib bo'lmadi")
        }
      }
    } catch {
      setModelUrlError("Noto'g'ri URL format")
    }
  }

  // Check image validity when imageUrl changes
  useEffect(() => {
    if (formData.imageUrl) {
      setIsCheckingImage(true)
      setIsImageValid(false)
      const img = new window.Image()
      img.onload = () => {
        setIsImageValid(true)
        setIsCheckingImage(false)
      }
      img.onerror = () => {
        setIsImageValid(false)
        setIsCheckingImage(false)
      }
      img.src = formData.imageUrl
    } else {
      setIsImageValid(false)
      setIsCheckingImage(false)
    }
  }, [formData.imageUrl])

  // Validate model URL when it changes (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.modelUrl) {
        validateModelUrl(formData.modelUrl).catch((error) => {
          console.warn("Model URL validation error:", error)
          setModelUrlError("URL tekshirishda xatolik")
        })
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeoutId)
  }, [formData.modelUrl])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.name.endsWith(".glb") || file.name.endsWith(".gltf")) {
        setModelFile(file)
        setModelFileName(file.name)
        uploadModelFile(file)
      } else {
        toast({
          title: "Noto'g'ri fayl formati",
          description: "Faqat .glb yoki .gltf formatdagi fayllar qabul qilinadi",
          variant: "destructive",
        })
        setModelFileName("Hech qanday fayl tanlanmagan")
      }
    } else {
      setModelFileName("Hech qanday fayl tanlanmagan")
    }
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type.startsWith("image/")) {
        setImageFile(file)
        setImageFileName(file.name)
        uploadImageFile(file)
      } else {
        toast({
          title: "Noto'g'ri fayl formati",
          description: "Faqat rasm fayllar qabul qilinadi",
          variant: "destructive",
        })
        setImageFileName("Hech qanday fayl tanlanmagan")
      }
    } else {
      setImageFileName("Hech qanday fayl tanlanmagan")
    }
  }

  const uploadModelFile = async (file: File) => {
    setIsUploadingModel(true)
    try {
      const fileName = `${Date.now()}_${file.name}`
      const result = await uploadToGitHub(file, fileName, "models")

      if (result.success && result.url) {
        setFormData((prev) => ({ ...prev, modelUrl: result.url }))
        setModelFile(null)
        toast({
          title: "3D model yuklandi",
          description: "Model muvaffaqiyatli GitHub'ga yuklandi",
        })
      } else {
        toast({
          title: "Yuklashda xatolik",
          description: result.error || "Model yuklanmadi",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.warn("Model upload error:", error)
      toast({
        title: "Xatolik",
        description: "Model yuklashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsUploadingModel(false)
    }
  }

  const uploadImageFile = async (file: File) => {
    setIsUploadingImage(true)
    try {
      const fileName = `${Date.now()}_${file.name}`
      const result = await uploadToGitHub(file, fileName, "images")

      if (result.success && result.url) {
        setFormData((prev) => ({ ...prev, imageUrl: result.url }))
        setImageFile(null)
        toast({
          title: "Rasm yuklandi",
          description: "Rasm muvaffaqiyatli GitHub'ga yuklandi",
        })
      } else {
        toast({
          title: "Yuklashda xatolik",
          description: result.error || "Rasm yuklanmadi",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.warn("Image upload error:", error)
      toast({
        title: "Xatolik",
        description: "Rasm yuklashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.price || !formData.categoryId) {
      toast({
        title: "To'ldirilmagan maydonlar",
        description: "Iltimos, barcha majburiy maydonlarni to'ldiring",
        variant: "destructive",
      })
      return
    }

    if (modelUrlError) {
      toast({
        title: "Model URL xatolik",
        description: modelUrlError,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const menuItemData = {
        name: formData.name,
        price: Number(formData.price),
        categoryId: formData.categoryId,
        description: formData.description,
        imageUrl: formData.imageUrl || null,
        modelUrl: formData.modelUrl || null,
        servesCount: Number(formData.servesCount) || 1,
        isAvailable: formData.isAvailable,
        remainingServings: Number(formData.servesCount) || 1,
        needsContainer: formData.needsContainer,
        containerPrice: formData.needsContainer ? Number(formData.containerPrice) : 0,
      }

      if (item?.id) {
        await updateDoc(doc(db, "menuItems", item.id), menuItemData)
        toast({
          title: "Taom yangilandi",
          description: `${formData.name} muvaffaqiyatli yangilandi`,
        })
      } else {
        await addDoc(collection(db, "menuItems"), menuItemData)
        toast({
          title: "Taom qo'shildi",
          description: `${formData.name} menyuga qo'shildi`,
        })
        const audio = new Audio("/success.mp3")
        audio.play().catch((e) => console.warn("Audio play failed:", e))
      }

      onClose()
    } catch (error) {
      console.warn("Error saving menu item:", error)
      toast({
        title: "Xatolik",
        description: "Taomni saqlashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-[85vw] lg:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-gray-800">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              {item ? "Taomni tahrirlash" : "Yangi taom qo'shish"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Live Preview Section */}
            <div className="bg-gradient-to-br bg-primary/10 rounded-2xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Jonli ko'rinish
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Preview */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-green-600" />
                    Rasm
                  </Label>
                  <div className="relative h-48 bg-white rounded-xl border-2 border-dashed border-gray-300 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {isCheckingImage || isUploadingImage ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/90">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                          <p className="text-sm text-gray-600 font-medium">
                            {isUploadingImage ? "Rasm yuklanmoqda..." : "Tekshirilmoqda..."}
                          </p>
                        </div>
                      </div>
                    ) : formData.imageUrl && isImageValid ? (
                      <Image
                        src={formData.imageUrl || "/placeholder.svg"}
                        alt="Taom rasmi"
                        fill
                        className="object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setShowImagePreview(true)}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-primary">
                          <ImageIcon className="w-12 h-12 mx-auto mb-3" />
                          <p className="text-sm font-medium">Rasm ko'rinishi</p>
                          <p className="text-xs">Rasm yuklang yoki URL kiriting</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3D Model Preview */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Cube className="w-4 h-4 text-primary" />
                    3D Model
                    {modelUrlError && (
                      <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Xatolik
                      </span>
                    )}
                  </Label>
                  <div className="relative h-48 bg-gradient-to-br bg-white rounded-xl border-2 border-dashed border-gray-300 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {isUploadingModel ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/90">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                          <p className="text-sm text-gray-600 font-medium">3D model yuklanmoqda...</p>
                        </div>
                      </div>
                    ) : (
                      <EmbeddedModelViewer modelUrl={formData.modelUrl} className="w-full h-full" />
                    )}
                  </div>
                  {modelUrlError && (
                    <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 font-medium mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        URL xatolik
                      </div>
                      <p>{modelUrlError}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Basic Info */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    Asosiy ma'lumotlar
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                        Taom nomi <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Masalan: Osh, Manti, Lag'mon"
                        className="h-11 border-2 border-gray-200 focus:border-primary rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                          Narxi (so'm) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          value={formData.price}
                          onChange={handleChange}
                          required
                          placeholder="25000"
                          className="h-11 border-2 border-gray-200 focus:border-primary rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="servesCount" className="text-sm font-medium text-gray-700">
                          Porsiya miqdori
                        </Label>
                        <Input
                          id="servesCount"
                          name="servesCount"
                          type="number"
                          min="1"
                          value={formData.servesCount}
                          onChange={handleChange}
                          placeholder="1"
                          className="h-11 border-2 border-gray-200 focus:border-primary rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="categoryId" className="text-sm font-medium text-gray-700">
                        Kategoriya <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => handleSelectChange("categoryId", value)}
                      >
                        <SelectTrigger className="h-11 border-2 border-gray-200 focus:border-primary rounded-lg">
                          <SelectValue placeholder="Kategoriyani tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                        Tavsif
                      </Label>
                      <Textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Taom haqida qisqacha ma'lumot..."
                        className="border-2 border-gray-200 focus:border-primary rounded-lg resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Sozlamalar</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <Label htmlFor="isAvailable" className="font-medium text-gray-800">
                          Mavjud
                        </Label>
                        <p className="text-sm text-gray-600">Mijozlar ko'rishi mumkin</p>
                      </div>
                      <Switch
                        id="isAvailable"
                        checked={formData.isAvailable}
                        onCheckedChange={(checked) => handleSwitchChange("isAvailable", checked)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Label htmlFor="needsContainer" className="font-medium text-gray-800">
                            Bir martalik idish
                          </Label>
                          <p className="text-sm text-gray-600">Qo'shimcha idish kerakmi?</p>
                        </div>
                        <Switch
                          id="needsContainer"
                          checked={formData.needsContainer}
                          onCheckedChange={(checked) => handleSwitchChange("needsContainer", checked)}
                        />
                      </div>

                      {formData.needsContainer && (
                        <div className="ml-4 space-y-2">
                          <Label htmlFor="containerPrice" className="text-sm font-medium text-gray-700">
                            Idish narxi (so'm)
                          </Label>
                          <Input
                            id="containerPrice"
                            name="containerPrice"
                            type="number"
                            value={formData.containerPrice}
                            onChange={handleChange}
                            placeholder="2000"
                            className="w-32 h-10 border-2 border-gray-200 focus:border-primary rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Media Upload */}
              <div className="space-y-6">
                {/* Image Upload */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-green-600" />
                    Rasm yuklash
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="imageUrl" className="text-sm font-medium text-gray-700">
                        Rasm URL manzili
                      </Label>
                      <Input
                        id="imageUrl"
                        name="imageUrl"
                        value={formData.imageUrl}
                        onChange={handleChange}
                        placeholder="https://example.com/image.jpg"
                        className="h-11 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white text-gray-500">yoki</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageFile" className="text-sm font-medium text-gray-700">
                        Fayl yuklang
                      </Label>
                      {/* Hidden input */}
                      <input
                        type="file"
                        accept="image/*"
                        id="imageFile"
                        ref={imageInputRef}
                        onChange={handleImageFileChange}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="h-24 w-full border-2 border-dashed border-green-300 hover:border-green-500 rounded-lg flex items-center justify-center text-sm text-gray-600 cursor-pointer transition-colors bg-primary/10 hover:bg-primary/20"
                          disabled={isUploadingImage}
                        >
                          <div className="text-center">
                            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <p className="font-medium text-gray-700">{imageFileName}</p>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG, JPEG formatlarida</p>
                          </div>
                        </button>
                        {isUploadingImage && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                            <div className="text-center">
                              <Loader2 className="w-6 h-6 animate-spin text-green-500 mx-auto mb-2" />
                              <p className="text-sm text-gray-600 font-medium">Yuklanmoqda...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3D Model Upload */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                    <Cube className="w-5 h-5 text-primary" />
                    3D Model yuklash
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="modelUrl" className="text-sm font-medium text-gray-700">
                        3D Model URL manzili
                      </Label>
                      <Input
                        id="modelUrl"
                        name="modelUrl"
                        value={formData.modelUrl}
                        onChange={handleChange}
                        placeholder="https://github.com/.../model.glb"
                        className={`h-11 border-2 rounded-lg ${
                          modelUrlError
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-200 focus:border-primary"
                        }`}
                      />
                      {modelUrlError && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {modelUrlError}
                        </p>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white text-gray-500">yoki</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="modelFile" className="text-sm font-medium text-gray-700">
                        Fayl yuklang (.glb, .gltf)
                      </Label>
                      {/* Hidden input */}
                      <input
                        type="file"
                        accept=".glb,.gltf"
                        id="modelFile"
                        ref={modelInputRef}
                        onChange={handleModelFileChange}
                        disabled={isUploadingModel}
                        className="hidden"
                      />
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => modelInputRef.current?.click()}
                          className="h-24 w-full border-2 border-dashed border-primary hover:border-primary rounded-lg flex items-center justify-center text-sm text-gray-600 cursor-pointer transition-colors bg-primary/10 hover:bg-primary/20"
                          disabled={isUploadingModel}
                        >
                          <div className="text-center">
                            <Cube className="w-8 h-8 mx-auto mb-2 text-primary" />
                            <p className="font-medium text-gray-700">{modelFileName}</p>
                            <p className="text-xs text-gray-500 mt-1">GLB, GLTF formatlarida</p>
                          </div>
                        </button>
                        {isUploadingModel && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                            <div className="text-center">
                              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                              <p className="text-sm text-gray-600 font-medium">Yuklanmoqda...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="px-6 py-2 h-11 border-2 border-gray-300  hover:border-primary rounded-lg font-medium bg-transparent"
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isUploadingImage || isUploadingModel || !!modelUrlError}
                className="px-8 py-2 h-11 bg-gradient-to-r text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    {item ? "Yangilash" : "Qo'shish"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {showImagePreview && formData.imageUrl && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <Button
              onClick={() => setShowImagePreview(false)}
              variant="outline"
              size="sm"
              className="absolute -top-12 right-0 bg-white/20 hover:bg-white/30 text-white border-white/40 backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </Button>
            <Image
              src={formData.imageUrl || "/placeholder.svg"}
              alt="Taom rasmi"
              width={800}
              height={600}
              className="object-contain max-h-[80vh] rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  )
}

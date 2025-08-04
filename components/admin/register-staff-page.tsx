"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore"
import { updatePassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Loader2, UserPlus, Trash2, Edit, Search, UserCheck, UserX, Eye, EyeOff, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "./admin-auth-provider"
import { useRouter } from "next/navigation"

interface Staff {
  id: string // Firestore document ID
  uid: string // Firebase Auth UID
  name: string
  email: string
  role: string
  status?: string
  createdAt?: any
  updatedAt?: any
}

export function RegisterStaffPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [role, setRole] = useState("waiter")
  const [isLoading, setIsLoading] = useState(false)
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [showNewPasswordInput, setShowNewPasswordInput] = useState(false)
  const { toast } = useToast()
  const { user, userRole, isLoading: isLoadingAuth } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoadingAuth && (!user || userRole !== "admin")) {
      router.push("/admin/login")
      return
    }
    if (user && userRole === "admin") {
      fetchStaffList()
    }
  }, [user, userRole, isLoadingAuth, router])

  const fetchStaffList = async () => {
    setIsLoadingStaff(true)
    try {
      const staffQuery = query(collection(db, "users"), where("role", "in", ["admin", "waiter", "chef", "accountant"]))
      const staffSnapshot = await getDocs(staffQuery)

      const staffData = staffSnapshot.docs.map((doc) => ({
        id: doc.id,
        uid: doc.data().uid || doc.id,
        ...doc.data(),
      })) as Staff[]

      setStaffList(staffData.filter((staff) => staff.status !== "deleted"))
      console.log("Staff list loaded:", staffData.length, "users")
    } catch (error) {
      console.error("Error fetching staff list:", error)
      toast({
        title: "Xatolik",
        description: "Xodimlar ro'yxatini yuklashda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoadingStaff(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (isLoadingAuth) {
      toast({
        title: "Yuklanmoqda",
        description: "Autentifikatsiya ma'lumotlari yuklanmoqda. Iltimos kuting.",
        variant: "default",
      })
      setIsLoading(false)
      return
    }

    if (!user || userRole !== "admin" || !user.uid) {
      toast({
        title: "Xatolik",
        description: "Sizda bu amalni bajarish uchun ruxsat yo'q. Iltimos, admin sifatida kiring.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    try {
      if (editingStaff) {
        // Mavjud xodimni yangilash
        await setDoc(
          doc(db, "users", editingStaff.id),
          {
            name,
            email,
            role,
            updatedAt: new Date(),
          },
          { merge: true },
        )

        // Parolni yangilash (faqat agar newPassword kiritilgan bo'lsa)
        if (newPassword) {
          if (newPassword.length < 6) {
            throw new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak.")
          }

          try {
            // Agar admin o'z parolini o'zgartirayotgan bo'lsa
            if (auth.currentUser && auth.currentUser.uid === editingStaff.uid) {
              await updatePassword(auth.currentUser, newPassword)
              toast({
                title: "Parol yangilandi",
                description: "Sizning parolingiz muvaffaqiyatli yangilandi.",
              })
            } else {
              // Boshqa foydalanuvchilar uchun server tomoni funksiyasini chaqirish
              const response = await fetch("/api/update-user-password", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  uid: editingStaff.uid,
                  newPassword: newPassword,
                  adminUid: user.uid,
                }),
              })

              const result = await response.json()

              if (!response.ok) {
                throw new Error(result.message || "Boshqa foydalanuvchi parolini yangilashda xatolik yuz berdi.")
              }

              toast({
                title: "Parol yangilandi",
                description: "Foydalanuvchi paroli muvaffaqiyatli yangilandi.",
              })
            }
          } catch (passwordError: any) {
            console.error("Parolni yangilashda xatolik:", passwordError)
            toast({
              title: "Parolni yangilashda xatolik",
              description: passwordError.message || "Parolni yangilab bo'lmadi. Qayta urinib ko'ring.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }
        }

        toast({
          title: "Muvaffaqiyatli yangilandi",
          description: "Xodim ma'lumotlari muvaffaqiyatli yangilandi",
        })

        setEditingStaff(null)
      } else {
        // Yangi xodim yaratish
        if (password.length < 6) {
          throw new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak.")
        }

        // Email allaqachon mavjudligini tekshirish
        const emailQuery = query(collection(db, "users"), where("email", "==", email))
        const emailSnapshot = await getDocs(emailQuery)

        if (!emailSnapshot.empty) {
          throw new Error("Bu email allaqachon ro'yxatdan o'tgan")
        }

        const response = await fetch("/api/create-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
            role,
            adminUid: user.uid,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || "Yangi xodim yaratishda xatolik yuz berdi.")
        }

        toast({
          title: "Muvaffaqiyatli ro'yxatdan o'tkazildi",
          description: `Yangi xodim muvaffaqiyatli ro'yxatdan o'tkazildi. UID: ${result.uid}`,
        })
      }

      // Formani tozalash
      setName("")
      setEmail("")
      setPassword("")
      setNewPassword("")
      setRole("waiter")
      setShowPasswordInput(false)
      setShowNewPasswordInput(false)

      // Xodimlar ro'yxatini yangilash
      await fetchStaffList()
    } catch (error: any) {
      console.error("Error registering staff:", error)
      toast({
        title: "Xatolik",
        description: error.message || "Xodimni ro'yxatdan o'tkazishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteStaff = async (staff: Staff) => {
    setIsDeleting(true)
    setStaffToDelete(staff)

    try {
      if (!user || userRole !== "admin" || !user.uid) {
        throw new Error("Sizda bu amalni bajarish uchun ruxsat yo'q.")
      }

      console.log("Deleting staff:", staff.name, staff.email, staff.uid)

      const response = await fetch("/api/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: staff.uid,
          adminUid: user.uid,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Foydalanuvchini o'chirishda xatolik yuz berdi.")
      }

      toast({
        title: "Muvaffaqiyatli o'chirildi",
        description: `${staff.name} (${staff.email}) muvaffaqiyatli o'chirildi`,
      })

      // Xodimlar ro'yxatini yangilash
      await fetchStaffList()
    } catch (error: any) {
      console.error("Error deleting staff:", error)
      toast({
        title: "Xatolik",
        description: error.message || "Xodimni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setStaffToDelete(null)
    }
  }

  const handleEditStaff = (staff: Staff) => {
    setEditingStaff(staff)
    setName(staff.name || "")
    setEmail(staff.email || "")
    setRole(staff.role || "waiter")
    setNewPassword("")
    setShowPasswordInput(false)
    setShowNewPasswordInput(false)
  }

  const cancelEdit = () => {
    setEditingStaff(null)
    setName("")
    setEmail("")
    setPassword("")
    setNewPassword("")
    setRole("waiter")
    setShowPasswordInput(false)
    setShowNewPasswordInput(false)
  }

  const filteredStaff = staffList.filter((staff) => {
    if (activeTab !== "all" && staff.role !== activeTab) {
      return false
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        (staff.name && staff.name.toLowerCase().includes(query)) ||
        (staff.email && staff.email.toLowerCase().includes(query))
      )
    }

    return true
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-600 hover:bg-purple-100">
            <UserCheck className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        )
      case "waiter":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-600 hover:bg-blue-100">
            Ofitsiant
          </Badge>
        )
      case "chef":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-600 hover:bg-green-100">
            Oshpaz
          </Badge>
        )
      case "accountant":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-600 hover:bg-orange-100">
            Buxgalter
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-600 hover:bg-gray-100">
            {role}
          </Badge>
        )
    }
  }

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (!user || userRole !== "admin") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg">Sizda ushbu sahifaga kirish huquqi yo'q.</p>
          <Button onClick={() => router.push("/admin/login")} className="mt-4">
            Login sahifasiga o'tish
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Xodimlarni boshqarish</h1>
        <Button
          onClick={fetchStaffList}
          variant="outline"
          size="sm"
          disabled={isLoadingStaff}
          className="flex items-center gap-2 bg-transparent"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingStaff ? "animate-spin" : ""}`} />
          Yangilash
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-700">
                {editingStaff ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}
              </CardTitle>
              <CardDescription className="text-gray-500">
                {editingStaff
                  ? "Xodim ma'lumotlarini yangilang va parolni o'zgartiring (agar kerak bo'lsa)"
                  : "Yangi xodimni tizimga qo'shish uchun ma'lumotlarni kiriting"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700">
                    Ism
                  </Label>
                  <Input
                    id="name"
                    placeholder="Xodim ismi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="xodim@restoran.uz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!!editingStaff}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                {!editingStaff ? (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700">
                      Parol
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPasswordInput ? "text" : "password"}
                        placeholder="********"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswordInput(!showPasswordInput)}
                      >
                        {showPasswordInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-gray-700">
                      Yangi parol (agar o'zgartirmoqchi bo'lsangiz)
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPasswordInput ? "text" : "password"}
                        placeholder="Yangi parol"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPasswordInput(!showNewPasswordInput)}
                      >
                        {showNewPasswordInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-gray-700">
                    Lavozim
                  </Label>
                  <Select value={role} onValueChange={setRole} required>
                    <SelectTrigger id="role" className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Lavozimni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="waiter">Ofitsiant</SelectItem>
                      <SelectItem value="chef">Oshpaz</SelectItem>
                      <SelectItem value="accountant">Buxgalter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" className="w-full py-2" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingStaff ? "Yangilanmoqda..." : "Ro'yxatdan o'tkazilmoqda..."}
                      </>
                    ) : (
                      <>
                        {editingStaff ? (
                          <>
                            <Edit className="mr-2 h-4 w-4" />
                            Yangilash
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Ro'yxatdan o'tkazish
                          </>
                        )}
                      </>
                    )}
                  </Button>
                  {editingStaff && (
                    <Button type="button" variant="outline" onClick={cancelEdit} className="py-2 bg-transparent">
                      Bekor qilish
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="h-full shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-xl font-semibold text-gray-700">
                  Xodimlar ro'yxati ({filteredStaff.length})
                </CardTitle>
                <div className="relative w-full md:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Qidirish..."
                    className="pl-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-5 gap-1 rounded-lg bg-gray-100 p-1">
                  <TabsTrigger
                    value="all"
                    className="py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    Barchasi
                  </TabsTrigger>
                  <TabsTrigger
                    value="admin"
                    className="py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    Admin
                  </TabsTrigger>
                  <TabsTrigger
                    value="waiter"
                    className="py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    Ofitsiant
                  </TabsTrigger>
                  <TabsTrigger
                    value="chef"
                    className="py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    Oshpaz
                  </TabsTrigger>
                  <TabsTrigger
                    value="accountant"
                    className="py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    Buxgalter
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  {isLoadingStaff ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : filteredStaff.length > 0 ? (
                    <div className="space-y-4">
                      {filteredStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-gray-800">{staff.name}</h3>
                                {getRoleBadge(staff.role)}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{staff.email}</p>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-gray-500">UID:</Label>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                  {staff.uid.substring(0, 8)}...
                                </code>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditStaff(staff)}
                                disabled={isLoading || isDeleting}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-4 w-4" />
                                Tahrirlash
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={isLoading || isDeleting || staff.email === user?.email}
                                    className="flex items-center gap-1"
                                  >
                                    {isDeleting && staffToDelete?.id === staff.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                    O'chirish
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-lg font-semibold">
                                      Xodimni o'chirish
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-gray-600">
                                      Haqiqatan ham <strong>{staff.name}</strong> ({staff.email}) ni o'chirmoqchimisiz?
                                      Bu amal foydalanuvchini Firebase Authentication va Firestore'dan butunlay
                                      o'chiradi.
                                      <br />
                                      <br />
                                      <strong>Bu amalni ortga qaytarib bo'lmaydi!</strong>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteStaff(staff)}
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={isDeleting}
                                    >
                                      {isDeleting && staffToDelete?.id === staff.id ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          O'chirilmoqda...
                                        </>
                                      ) : (
                                        "Ha, o'chirish"
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center bg-gray-50">
                      <UserX className="mb-3 h-10 w-10 text-gray-400" />
                      <p className="text-gray-600 font-medium">Xodimlar topilmadi</p>
                      <p className="text-sm text-gray-500">
                        {searchQuery
                          ? "Qidiruv bo'yicha xodimlar topilmadi."
                          : "Hozircha bu turdagi xodimlar mavjud emas."}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

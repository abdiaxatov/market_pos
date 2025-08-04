"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { auth, db } from "@/lib/firebase"
import { AdminLogin } from "./admin-login"

interface AuthContextType {
  user: any
  userId: string | null
  userName: string | null
  userRole: string | null
  isAuthenticated: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userId: null,
  userName: null,
  userRole: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => {},
})

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()

            if (userData.status === "deleted") {
              localStorage.clear()
              sessionStorage.clear()
              await firebaseSignOut(auth)
              setUser(null)
              setUserId(null)
              setUserName(null)
              setUserRole(null)
              router.push("/admin/login")
              toast({
                title: "Kirish rad etildi",
                description: "Bu foydalanuvchi tizimdan o'chirilgan",
                variant: "destructive",
              })
              setIsLoading(false)
              return
            }

            setUser(currentUser)
            setUserId(currentUser.uid)
            setUserName(userData.name || "")
            setUserRole(userData.role || "")

            if (pathname === "/admin/login") {
              switch (userData.role) {
                case "waiter":
                  router.push("/admin/waiter")
                  break
                case "chef":
                  router.push("/admin/category-orders")
                  break
                case "accountant":
                  router.push("/admin/warehouse")
                  break
                default:
                  router.push("/admin/dashboard")
              }
              return
            }

            const allowedPaths: Record<string, string[]> = {
              waiter: ["/admin/waiter", "/admin/order-modifications"],
              chef: ["/admin/category-orders"],
              accountant: ["/admin/warehouse"],
            }

            if (userData.role !== "admin" && pathname.startsWith("/admin") && pathname !== "/admin/login") {
              const allowed = allowedPaths[userData.role] || []
              if (!allowed.includes(pathname)) {
                router.push(allowed[0] || "/admin/login")
                toast({
                  title: "Ruxsat yo'q",
                  description: "Sizda bu sahifaga kirish huquqi yo'q",
                  variant: "destructive",
                })
              }
            }
          } else {
            await firebaseSignOut(auth)
            router.push("/admin/login")
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          toast({
            title: "Xatolik",
            description: "Foydalanuvchi ma'lumotlarini yuklashda xatolik yuz berdi.",
            variant: "destructive",
          })
        }
        setIsLoading(false)
      } else {
        setUser(null)
        setUserId(null)
        setUserName(null)
        setUserRole(null)
        setIsLoading(false)
        if (pathname !== "/admin/login" && pathname.startsWith("/admin")) {
          router.push("/admin/login")
        }
      }
    })
    return () => unsubscribe()
  }, [router, pathname])

  const signOut = async () => {
    try {
      toast({ title: "Chiqish", description: "Tizimdan chiqilmoqda..." })
      localStorage.clear()
      sessionStorage.clear()
      await firebaseSignOut(auth)
      setUser(null)
      setUserId(null)
      setUserName(null)
      setUserRole(null)
      toast({ title: "Chiqildi", description: "Tizimdan muvaffaqiyatli chiqdingiz" })
      router.push("/admin/login")
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        title: "Xatolik",
        description: "Chiqishda xatolik yuz berdi",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (!user && pathname !== "/admin/login" && pathname.startsWith("/admin")) {
    return <AdminLogin />
  }

  return (
    <AuthContext.Provider
      value={{ user, userId, userName, userRole, isAuthenticated: !!user, isLoading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AdminAuthProvider")
  }
  return context
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, LogIn, Eye, EyeOff, ChefHat, User, LayoutDashboard, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validate inputs
      if (!email.trim() || !password.trim()) {
        setError("Email va parol kiritilishi shart")
        setIsLoading(false)
        return
      }

      // Attempt authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid))

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const role = userData.role
        const userName = userData.name || user.displayName || email.split("@")[0]

        toast({
          title: "Login muvaffaqiyatli",
          description: `Xush kelibsiz, ${userName}!`,
        })

        // Redirect based on role
        if (role === "chef" || role === "oshpaz") {
          router.push("/admin/chef")
        } else if (role === "waiter" || role === "ofitsiant") {
          router.push("/admin/waiter")
        } else if (role === "admin") {
          router.push("/admin/dashboard")
        } else {
          // For any other role, redirect to dashboard
          router.push("/admin/dashboard")
        }
      } else {
        // Create a basic user document if it doesn't exist
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          name: user.displayName || email.split("@")[0],
          role: "admin", // Default role
          createdAt: new Date(),
        })

        toast({
          title: "Login muvaffaqiyatli",
          description: "Foydalanuvchi ma'lumotlari yaratildi",
        })

        router.push("/admin/dashboard")
      }
    } catch (authError: any) {
      console.error("Authentication error:", authError.message)

      // Provide specific error messages
      if (
        authError.code === "auth/user-not-found" ||
        authError.code === "auth/wrong-password" ||
        authError.code === "auth/invalid-credential"
      ) {
        setError("Email yoki parol noto'g'ri")
      } else if (authError.code === "auth/too-many-requests") {
        setError("Ko'p urinishlar. Iltimos keyinroq qayta urinib ko'ring")
      } else if (authError.code === "auth/invalid-email") {
        setError("Noto'g'ri email formati")
      } else if (authError.code === "auth/network-request-failed") {
        setError("Internet aloqasi muammosi. Internetingizni tekshiring")
      } else {
        setError("Login xatoligi: " + authError.message)
      }

      toast({
        title: "Login xatoligi",
        description: "Email yoki parol noto'g'ri",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) {
    return null // Prevent rendering until client-side
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="overflow-hidden border-none shadow-xl">
            <CardHeader className="flex flex-col items-center justify-center bg-gradient-to-r from-primary/10 to-primary/5 pb-6 pt-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md">
                <LogIn className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">Tizimga kirish</h2>
            </CardHeader>

            <CardContent className="p-6 pt-8">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 overflow-hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder=""
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="h-12 bg-muted/30 pl-4 pr-4"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Parol
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="h-12 bg-muted/30 pl-4 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="mt-6 h-12 w-full text-base font-medium transition-all hover:scale-[1.02]"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Kirish...
                    </>
                  ) : (
                    "Kirish"
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col bg-muted/30 p-6">
              <div className="text-center text-sm text-muted-foreground">
                <p>Kirish huquqiga ega foydalanuvchilar:</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs shadow-sm">
                    <LayoutDashboard className="h-3 w-3" />
                    <span>Admin</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs shadow-sm">
                    <ChefHat className="h-3 w-3" />
                    <span>Oshpaz</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs shadow-sm">
                    <User className="h-3 w-3" />
                    <span>Ofitsiant</span>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          <p>© {new Date().getFullYear()} Restaurant Order System</p>
        </motion.div>
      </div>
    </div>
  )
}

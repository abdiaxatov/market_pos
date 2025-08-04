"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "./admin-sidebar/use-sidebar"
import { useAuth } from "./admin-auth-provider"

export function AdminHeader() {
  const pathname = usePathname()
  const { toggle } = useSidebar()
  const { userName, userRole } = useAuth()
  const [pageTitle, setPageTitle] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Set page title based on pathname
    const path = pathname.split("/").pop() || ""
    const title = path.charAt(0).toUpperCase() + path.slice(1)

    switch (path) {
      case "dashboard":
        setPageTitle("Boshqaruv paneli")
        break
      case "menu":
        setPageTitle("Menyu boshqaruvi")
        break
      case "tables":
        setPageTitle("Stollar boshqaruvi")
        break
      case "waiter":
        setPageTitle("Ofitsiant paneli")
        break
      case "chef":
        setPageTitle("Oshpaz paneli")
        break
      case "saboy":
        setPageTitle("Saboy paneli")
        break
      case "register-staff":
        setPageTitle("Xodimlar ro'yxati")
        break
      case "order-history":
        setPageTitle("Buyurtmalar tarixi")
        break
      case "stats":
        setPageTitle("Statistika")
        break
      case "settings":
        setPageTitle("Sozlamalar")
        break
      default:
        setPageTitle(title || "Admin Panel")
    }
  }, [pathname])

  if (!isMounted) return null

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background px-4 md:px-6">
      <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={toggle}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="flex flex-1 items-center justify-between">
        <h1 className="text-xl font-semibold">{pageTitle}</h1>

        <div className="flex items-center gap-4">
          {userName && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm font-medium">{userName}</span>
              {userRole && (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {userRole}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

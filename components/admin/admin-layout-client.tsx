"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AdminSidebar } from "./admin-sidebar"
import { useAuth } from "./admin-auth-provider"
import { WaiterPage } from "./waiter-page"
import { usePathname } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { userRole } = useAuth()
  const [isMounted, setIsMounted] = useState(false)
  const pathname = usePathname()

  // Check if current page is login page
  const isLoginPage = pathname === "/admin/login"

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  // If it's the login page, render only the children without sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  // If user is a waiter, show only the waiter page without sidebar
  if (userRole === "waiter") {
    return <WaiterPage />
  }

  // For admin and other roles, show the sidebar and children
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        {/* Main content area - full width with proper spacing */}
        <main className="flex-1 w-full min-w-0 bg-background/50 backdrop-blur-sm">
          <div className="h-full w-full p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

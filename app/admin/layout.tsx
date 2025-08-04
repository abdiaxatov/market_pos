import type { ReactNode } from "react"
import { AdminLayoutClient } from "@/components/admin/admin-layout-client"
import { AdminAuthProvider } from "@/components/admin/admin-auth-provider"

export const metadata = {
  title: "Qarsillama Somsa - Admin",
  description: "Zamonaviy restoran ovqat buyurtma tizimi",
  icons: {
    icon: "/Logo.png",
  },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AdminAuthProvider>
  )
}

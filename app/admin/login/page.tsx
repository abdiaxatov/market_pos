import { AdminLogin } from "@/components/admin/admin-login"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Login | Restaurant Order System",
  description: "Login to the restaurant order system admin panel",
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <AdminLogin />
    </div>
  )
}

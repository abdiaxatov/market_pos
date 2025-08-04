import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Sahifa topilmadi</h2>
        <p className="text-muted-foreground">
          Siz qidirayotgan sahifa mavjud emas yoki faqat restoran Wi-Fi tarmog'i orqali kirish mumkin.
        </p>
        <Button asChild>
          <Link href="/">Bosh sahifaga qaytish</Link>
        </Button>
      </div>
    </div>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

export function TableInput() {
  const [tableNumber, setTableNumber] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!tableNumber || isNaN(Number(tableNumber))) {
      toast({
        title: "Invalid table number",
        description: "Please enter a valid table number",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // Store table number in session storage
    sessionStorage.setItem("tableNumber", tableNumber)

    // Redirect to menu page
    setTimeout(() => {
      router.push("/menu")
    }, 500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tableNumber">Table Number</Label>
        <Input
          id="tableNumber"
          type="number"
          placeholder="Enter your table number"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Loading..." : "Continue to Menu"}
      </Button>
    </form>
  )
}

"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface SidebarContextType {
  isOpen: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  toggle: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Initialize with localStorage value if available, otherwise default to true
  const [isOpen, setIsOpen] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Load sidebar state from localStorage after component mounts
  useEffect(() => {
    setIsMounted(true)
    const savedState = localStorage.getItem("sidebarOpen")
    if (savedState !== null) {
      setIsOpen(savedState === "true")
    }
  }, [])

  // Toggle sidebar state and save to localStorage
  const toggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    if (isMounted) {
      localStorage.setItem("sidebarOpen", String(newState))
    }
  }

  return <SidebarContext.Provider value={{ isOpen, toggle }}>{children}</SidebarContext.Provider>
}

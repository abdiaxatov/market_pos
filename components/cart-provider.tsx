"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import type { CartItem, MenuItem } from "@/types"

interface CartContextType {
  items: CartItem[]
  addToCart: (item: MenuItem, quantity?: number) => void
  updateItemQuantity: (itemId: string, quantity: number) => void
  removeItem: (itemId: string) => void
  clearCart: () => void
  getItemQuantity: (itemId: string) => number
  getTotalPrice: () => number
  getTotalItems: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Load cart from localStorage on initial render
  useEffect(() => {
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (error) {
        console.error("Error parsing cart from localStorage:", error)
        localStorage.removeItem("cart")
      }
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items))
  }, [items])

  const addToCart = (item: MenuItem, quantity = 1) => {
    setItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((i) => i.id === item.id)

      if (existingItemIndex >= 0) {
        // Item exists, update quantity
        const updatedItems = [...prevItems]
        const newQuantity = updatedItems[existingItemIndex].quantity + quantity

        if (newQuantity <= 0) {
          // Remove item if quantity becomes 0 or negative
          return updatedItems.filter((_, index) => index !== existingItemIndex)
        }

        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: newQuantity,
        }
        return updatedItems
      } else if (quantity > 0) {
        // Item doesn't exist and quantity is positive, add new item
        return [
          ...prevItems,
          {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity,
            imageUrl: item.imageUrl,
          },
        ]
      }

      // If quantity is 0 or negative and item doesn't exist, return unchanged
      return prevItems
    })
  }

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setItems((prevItems) => {
      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        return prevItems.filter((item) => item.id !== itemId)
      }

      // Update quantity for the specified item
      return prevItems.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    })
  }

  const removeItem = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId))
  }

  const clearCart = () => {
    setItems([])
  }

  const getItemQuantity = (itemId: string) => {
    const item = items.find((item) => item.id === itemId)
    return item ? item.quantity : 0
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateItemQuantity,
        removeItem,
        clearCart,
        getItemQuantity,
        getTotalPrice,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

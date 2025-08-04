export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  category: string
  imageUrl?: string
  servesCount?: number
  remainingServings?: number
  needsContainer?: boolean
  containerPrice?: number
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
}

export interface Category {
  id: string
  name: string
  description?: string
  imageUrl?: string
}

// Update the Table interface to include floor
export interface Table {
  id: string
  number: number
  seats: number
  status: "available" | "occupied" | "reserved"
  roomId?: string
  floor?: number
}

// Update the Room interface to include floor
export interface Room {
  id: string
  number: number
  status: "available" | "occupied" | "reserved"
  description?: string
  floor?: number
}

// Update the Order type to include floor
export type Order = {
  id: string
  orderType: "table" | "delivery"
  tableNumber?: number | null
  roomNumber?: number | null
  status: string
  createdAt: any
  updatedAt?: any
  items: CartItem[]
  total: number
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  deliveryFee?: number
  paymentMethod?: string
  notes?: string
  tableType?: string
  seatingType?: string
  floor?: number
}

export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "chef" | "waiter"
  createdAt: any
}

// Add Floor interface
export interface Floor {
  id: string
  number: number
  name: string
  description?: string
}

import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getWaiterNameById } from "@/lib/table-service"
import type { Order } from "@/types"

export async function markOrderAsPaid(orderId: string): Promise<boolean> {
  try {
    const orderRef = doc(db, "orders", orderId)

    // First check if the order exists
    const orderSnap = await getDoc(orderRef)
    if (!orderSnap.exists()) {
      console.error(`Order with ID ${orderId} not found`)
      return false
    }

    // Update the order to mark it as paid
    await updateDoc(orderRef, {
      isPaid: true,
      paidAt: new Date(),
      updatedAt: new Date(),
    })

    return true
  } catch (error) {
    console.error("Error marking order as paid:", error)
    return false
  }
}

export async function getOrderWithDetails(orderId: string): Promise<Order | null> {
  try {
    const orderRef = doc(db, "orders", orderId)
    const orderSnap = await getDoc(orderRef)

    if (!orderSnap.exists()) {
      return null
    }

    const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order

    // Get waiter name if applicable
    if (orderData.waiterId) {
      const waiterName = await getWaiterNameById(orderData.waiterId)
      if (waiterName) {
        orderData.waiterName = waiterName
      }
    }

    return orderData
  } catch (error) {
    console.error("Error getting order details:", error)
    return null
  }
}

export function getSeatingTypeDisplay(order: Order) {
  if (order.orderType === "delivery") {
    return "Yetkazib berish"
  }

  if (order.seatingType) {
    return order.seatingType
  }

  // For backward compatibility
  if (order.roomNumber) {
    return "Xona"
  }

  return order.tableType || "Stol"
}

export function formatDate(timestamp: any, includeDate = true) {
  if (!timestamp) return "N/A"

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)

  if (includeDate) {
    return new Intl.DateTimeFormat("uz-UZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(date)
  } else {
    return new Intl.DateTimeFormat("uz-UZ", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(date)
  }
}

export async function getWaiterForSeatingItem(itemType: string, itemNumber: number) {
  try {
    // First check if we have this info in localStorage
    const lastOrderInfoStr = localStorage.getItem("lastOrderInfo")
    if (lastOrderInfoStr) {
      const lastOrderInfo = JSON.parse(lastOrderInfoStr)

      // Check if this is the same table/room
      if (
        (itemType.toLowerCase() === "xona" && lastOrderInfo.roomNumber === itemNumber) ||
        (itemType.toLowerCase() !== "xona" && lastOrderInfo.tableNumber === itemNumber)
      ) {
        // If we have waiterId and waiterName in localStorage, use that
        if (lastOrderInfo.waiterId && lastOrderInfo.waiterName) {
          return {
            id: lastOrderInfo.waiterId,
            name: lastOrderInfo.waiterName,
          }
        }

        // If we only have waiterId, try to get the name
        if (lastOrderInfo.waiterId) {
          try {
            const { db } = await import("@/lib/firebase")
            const { doc, getDoc } = await import("firebase/firestore")

            const waiterDoc = await getDoc(doc(db, "users", lastOrderInfo.waiterId))
            if (waiterDoc.exists()) {
              const waiterData = waiterDoc.data()
              return {
                id: lastOrderInfo.waiterId,
                name: waiterData.name,
              }
            }
          } catch (error) {
            console.error("Error getting waiter name from Firestore:", error)
          }
        }
      }
    }

    // If we don't have the info in localStorage, try to get it from Firestore
    try {
      const { db } = await import("@/lib/firebase")
      const { collection, query, where, getDocs, doc, getDoc } = await import("firebase/firestore")

      // Query for the seating item
      const seatingItemsQuery = query(
        collection(db, "seatingItems"),
        where("number", "==", itemNumber),
        where("type", "==", itemType),
      )

      const seatingItemsSnapshot = await getDocs(seatingItemsQuery)

      if (!seatingItemsSnapshot.empty) {
        const seatingItemData = seatingItemsSnapshot.docs[0].data()

        // If we have waiterId, get the waiter name
        if (seatingItemData.waiterId) {
          const waiterDoc = await getDoc(doc(db, "users", seatingItemData.waiterId))
          if (waiterDoc.exists()) {
            const waiterData = waiterDoc.data()
            return {
              id: seatingItemData.waiterId,
              name: waiterData.name,
            }
          }
        }
      }
    } catch (error) {
      console.error("Error getting seating item from Firestore:", error)
    }

    // If we get here, we couldn't find the waiter info
    return null
  } catch (error) {
    console.error("Error in getWaiterForSeatingItem:", error)
    return null
  }
}

// Function to get waiter name by ID
export async function getWaiterNameById(waiterId: string): Promise<string | null> {
  try {
    if (!waiterId) return null

    // First check if we have this info in localStorage
    const lastOrderInfoStr = localStorage.getItem("lastOrderInfo")
    if (lastOrderInfoStr) {
      const lastOrderInfo = JSON.parse(lastOrderInfoStr)
      if (lastOrderInfo.waiterId === waiterId && lastOrderInfo.waiterName) {
        return lastOrderInfo.waiterName
      }
    }

    // If not in localStorage, get from Firestore
    const { db } = await import("@/lib/firebase")
    const { doc, getDoc } = await import("firebase/firestore")

    const waiterDoc = await getDoc(doc(db, "users", waiterId))

    if (!waiterDoc.exists()) {
      return null
    }

    return waiterDoc.data().name
  } catch (error) {
    console.error("Error getting waiter name by ID:", error)
    return null
  }
}

// Function to get all waiters
export async function getAllWaiters(): Promise<{ id: string; name: string }[]> {
  try {
    const { db } = await import("@/lib/firebase")
    const { collection, query, where, getDocs } = await import("firebase/firestore")

    const waitersQuery = query(collection(db, "users"), where("role", "==", "waiter"))
    const snapshot = await getDocs(waitersQuery)

    const waiters: { id: string; name: string }[] = []

    snapshot.forEach((doc) => {
      const data = doc.data()
      waiters.push({
        id: doc.id,
        name: data.name,
      })
    })

    return waiters
  } catch (error) {
    console.error("Error getting all waiters:", error)
    return []
  }
}

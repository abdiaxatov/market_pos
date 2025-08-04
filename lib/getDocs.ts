import { collection, getDocs as firestoreGetDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Improved getDocs helper function to avoid Firebase index errors
export async function getDocs(
  collectionName: string,
  conditions: { field: string; operator: string; value: any }[] = [],
  orderByField?: string,
  orderDirection?: "asc" | "desc",
  limitCount?: number,
) {
  try {
    // Start with the collection reference
    let q = collection(db, collectionName)

    // Apply simple equality filters first (these don't require composite indexes)
    const equalityConditions = conditions.filter((c) => c.operator === "==")
    if (equalityConditions.length > 0) {
      for (const condition of equalityConditions) {
        q = query(q, where(condition.field, condition.operator as any, condition.value))
      }
    }

    // Get the initial results
    const snapshot = await firestoreGetDocs(q)
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    // Apply any remaining filters in memory
    const remainingConditions = conditions.filter((c) => c.operator !== "==")
    if (remainingConditions.length > 0) {
      results = results.filter((doc) => {
        return remainingConditions.every((condition) => {
          const fieldValue = (doc as any)[condition.field]

          switch (condition.operator) {
            case ">":
              return fieldValue > condition.value
            case ">=":
              return fieldValue >= condition.value
            case "<":
              return fieldValue < condition.value
            case "<=":
              return fieldValue <= condition.value
            case "!=":
              return fieldValue !== condition.value
            case "in":
              return Array.isArray(condition.value) && condition.value.includes(fieldValue)
            case "array-contains":
              return Array.isArray(fieldValue) && fieldValue.includes(condition.value)
            case "array-contains-any":
              return (
                Array.isArray(fieldValue) &&
                Array.isArray(condition.value) &&
                condition.value.some((v: any) => fieldValue.includes(v))
              )
            default:
              return true
          }
        })
      })
    }

    // Apply ordering if specified
    if (orderByField) {
      results.sort((a, b) => {
        const aValue = (a as any)[orderByField]
        const bValue = (b as any)[orderByField]

        if (aValue < bValue) return orderDirection === "desc" ? 1 : -1
        if (aValue > bValue) return orderDirection === "desc" ? -1 : 1
        return 0
      })
    }

    // Apply limit if specified
    if (limitCount && limitCount > 0) {
      results = results.slice(0, limitCount)
    }

    return results
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error)
    return []
  }
}

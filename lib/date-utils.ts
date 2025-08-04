/**
 * Utility functions for handling dates in the restaurant order system
 */

/**
 * Formats a date value into standardized date and time strings
 * Handles various input types: Date objects, Firebase Timestamps, strings, and numbers
 * For paid orders, prioritizes paidAt timestamp
 *
 * @param order - The order object containing date information
 * @returns Object containing formatted date and time strings
 */
export function formatOrderDateTime(order: any): { date: string; time: string; fullDateTime: string } {
  // Default values in case of errors
  const defaultResult = {
    date: "N/A",
    time: "N/A",
    fullDateTime: "N/A",
  }

  try {
    // For paid orders, prioritize paidAt timestamp
    let dateValue = null
    if ((order.status === "paid" || order.isPaid === true) && order.paidAt) {
      dateValue = order.paidAt
    } else {
      dateValue = order.createdAt
    }

    // Handle null or undefined
    if (!dateValue) {
      console.warn("Date value is null or undefined")
      return defaultResult
    }

    let dateObject: Date

    // Handle different types of date values
    if (dateValue instanceof Date) {
      // Already a Date object
      dateObject = dateValue
    } else if (typeof dateValue === "string") {
      // Handle string date formats
      dateObject = new Date(dateValue)
    } else if (typeof dateValue === "number") {
      // Handle timestamp as number
      dateObject = new Date(dateValue)
    } else if (dateValue.toDate && typeof dateValue.toDate === "function") {
      // Handle Firebase Timestamp objects
      dateObject = dateValue.toDate()
    } else if (dateValue._methodName === "serverTimestamp") {
      // Handle Firebase server timestamp that hasn't been set yet
      return defaultResult
    } else {
      // Try to convert to date as last resort
      dateObject = new Date(dateValue)
    }

    // Validate the date object
    if (isNaN(dateObject.getTime())) {
      console.warn("Invalid date value:", dateValue)
      return defaultResult
    }

    // Format the date using Intl.DateTimeFormat for localization
    const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })

    const timeFormatter = new Intl.DateTimeFormat("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    })

    const fullDateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

    return {
      date: dateFormatter.format(dateObject),
      time: timeFormatter.format(dateObject),
      fullDateTime: fullDateTimeFormatter.format(dateObject),
    }
  } catch (error) {
    console.error("Error formatting date:", error)
    return defaultResult
  }
}

/**
 * Formats a date value into standardized date and time strings
 * Handles various input types: Date objects, Firebase Timestamps, strings, and numbers
 *
 * @param dateValue - The date value to format (can be Date, Timestamp, string, or number)
 * @returns Object containing formatted date and time strings
 */
export function formatDateTime(dateValue: any): { date: string; time: string; fullDateTime: string } {
  // Default values in case of errors
  const defaultResult = {
    date: "N/A",
    time: "N/A",
    fullDateTime: "N/A",
  }

  try {
    // Handle null or undefined
    if (!dateValue) {
      console.warn("Date value is null or undefined")
      return defaultResult
    }

    let dateObject: Date

    // Handle different types of date values
    if (dateValue instanceof Date) {
      // Already a Date object
      dateObject = dateValue
    } else if (typeof dateValue === "string") {
      // Handle string date formats
      dateObject = new Date(dateValue)
    } else if (typeof dateValue === "number") {
      // Handle timestamp as number
      dateObject = new Date(dateValue)
    } else if (dateValue.toDate && typeof dateValue.toDate === "function") {
      // Handle Firebase Timestamp objects
      dateObject = dateValue.toDate()
    } else if (dateValue._methodName === "serverTimestamp") {
      // Handle Firebase server timestamp that hasn't been set yet
      return defaultResult
    } else {
      // Try to convert to date as last resort
      dateObject = new Date(dateValue)
    }

    // Validate the date object
    if (isNaN(dateObject.getTime())) {
      console.warn("Invalid date value:", dateValue)
      return defaultResult
    }

    // Format the date using Intl.DateTimeFormat for localization
    const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })

    const timeFormatter = new Intl.DateTimeFormat("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    })

    const fullDateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

    return {
      date: dateFormatter.format(dateObject),
      time: timeFormatter.format(dateObject),
      fullDateTime: fullDateTimeFormatter.format(dateObject),
    }
  } catch (error) {
    console.error("Error formatting date:", error)
    return defaultResult
  }
}

/**
 * Formats a date string for display in the UI
 * For paid orders, prioritizes paidAt timestamp
 *
 * @param order - The order object containing date information
 * @returns Formatted date string
 */
export function formatOrderDate(order: any): string {
  return formatOrderDateTime(order).date
}

/**
 * Formats a time string for display in the UI
 * For paid orders, prioritizes paidAt timestamp
 *
 * @param order - The order object containing date information
 * @returns Formatted time string
 */
export function formatOrderTime(order: any): string {
  return formatOrderDateTime(order).time
}

/**
 * Formats a date string for display in the UI
 *
 * @param dateValue - The date value to format
 * @returns Formatted date string
 */
export function formatDate(dateValue: any): string {
  return formatDateTime(dateValue).date
}

/**
 * Formats a time string for display in the UI
 *
 * @param dateValue - The date value to format
 * @returns Formatted time string
 */
export function formatTime(dateValue: any): string {
  return formatDateTime(dateValue).time
}

/**
 * Validates if a value is a valid date
 *
 * @param dateValue - The date value to validate
 * @returns Boolean indicating if the value is a valid date
 */
export function isValidDate(dateValue: any): boolean {
  if (!dateValue) return false

  try {
    let date: Date

    if (dateValue instanceof Date) {
      date = dateValue
    } else if (typeof dateValue === "string") {
      date = new Date(dateValue)
    } else if (typeof dateValue === "number") {
      date = new Date(dateValue)
    } else if (dateValue.toDate && typeof dateValue.toDate === "function") {
      date = dateValue.toDate()
    } else {
      date = new Date(dateValue)
    }

    return !isNaN(date.getTime())
  } catch (error) {
    return false
  }
}

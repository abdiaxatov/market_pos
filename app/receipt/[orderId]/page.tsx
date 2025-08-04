"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Home, TableIcon, Sofa, Armchair, User, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"
import { formatDateTime } from "@/lib/date-utils"
// import { QRCode } from "@/components/qr-code" // QR Code component is not used in generated HTML for print

// Electron API type declaration
declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (html: string) => void
    }
  }
}

interface OrderItem {
  name: string
  price: number
  quantity: number
}

interface Order {
  id: string
  items: OrderItem[]
  total: number
  subtotal?: number
  createdAt: any
  paidAt?: any
  orderDate?: string
  customerName?: string
  tableNumber?: number | null
  roomNumber?: number | null
  orderType: "table" | "delivery" | "saboy"
  status: string
  isPaid: boolean
  seatingType?: string
  tableType?: string
  waiterId?: string
  phoneNumber?: string
  address?: string
  deliveryFee?: number
  containerCost?: number
  claimedByName?: string // Added for waiter name consistency
}

export default function ReceiptPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [waiterName, setWaiterName] = useState<string | null>(null)
  const printFrameRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        if (!orderId || typeof orderId !== "string") {
          throw new Error("Noto'g'ri buyurtma ID")
        }

        const orderDoc = await getDoc(doc(db, "orders", orderId))

        if (orderDoc.exists()) {
          const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order
          setOrder(orderData)

          if (orderData.waiterId) {
            try {
              const waiterDoc = await getDoc(doc(db, "users", orderData.waiterId))
              if (waiterDoc.exists()) {
                setWaiterName(waiterDoc.data().name)
              }
            } catch (err) {
              console.error("Ofitsiant ma'lumotlarini olishda xatolik:", err)
            }
          } else if (orderData.claimedByName) {
            setWaiterName(orderData.claimedByName)
          }
        } else {
          const historyOrderDoc = await getDoc(doc(db, "orderHistory", orderId))

          if (historyOrderDoc.exists()) {
            const orderData = { id: historyOrderDoc.id, ...historyOrderDoc.data() } as Order
            setOrder(orderData)

            if (orderData.waiterId) {
              try {
                const waiterDoc = await getDoc(doc(db, "users", orderData.waiterId))
                if (waiterDoc.exists()) {
                  setWaiterName(waiterDoc.data().name)
                }
              } catch (err) {
                console.error("Ofitsiant ma'lumotlarini olishda xatolik:", err)
              }
            } else if (orderData.claimedByName) {
              setWaiterName(orderData.claimedByName)
            }
          } else {
            throw new Error("Buyurtma topilmadi")
          }
        }
      } catch (err) {
        console.error("Buyurtmani olishda xatolik:", err)
        setError(err instanceof Error ? err.message : "Xatolik yuz berdi")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  // Get the appropriate seating display
  const getSeatingDisplay = useCallback((order: Order) => {
    if (order.orderType === "delivery") {
      return "Yetkazib berish"
    }

    if (order.orderType === "saboy") {
      return "Saboy"
    }

    const seatingType = order.seatingType || (order.roomNumber ? "Xona" : order.tableType || "Stol")
    const seatingNumber = order.roomNumber || order.tableNumber

    return seatingNumber ? `${seatingType} #${seatingNumber}` : seatingType
  }, [])

  // Get the appropriate icon for the seating type
  const getSeatingIcon = useCallback((order: Order) => {
    if (order.orderType === "delivery") {
      return null
    }

    if (order.orderType === "saboy") {
      return <Home className="h-4 w-4" />
    }

    const seatingType = (order.seatingType || (order.roomNumber ? "Xona" : order.tableType || "Stol")).toLowerCase()

    switch (seatingType) {
      case "stol":
        return <TableIcon className="h-4 w-4" />
      case "xona":
        return <Home className="h-4 w-4" />
      case "divan":
        return <Sofa className="h-4 w-4" />
      case "kreslo":
        return <Armchair className="h-4 w-4" />
      default:
        return <TableIcon className="h-4 w-4" />
    }
  }, [])

  // Get status badge
  const getStatusBadge = useCallback((status: string) => {
    let label = "Noma'lum"
    let icon = null

    switch (status) {
      case "pending":
        label = "Kutilmoqda"
        icon = <Clock className="mr-1 h-3 w-3" />
        break
      case "preparing":
        label = "Tayyorlanmoqda"
        icon = <Clock className="mr-1 h-3 w-3" />
        break
      case "completed":
        label = "Yakunlangan"
        icon = <CheckCircle className="mr-1 h-3 w-3" />
        break
      case "paid":
        label = "To'langan"
        icon = <CheckCircle className="mr-1 h-3 w-3" />
        break
    }

    return (
      <span className="inline-flex items-center text-xs">
        {icon}
        {label}
      </span>
    )
  }, [])

  const generateReceiptHTML = useCallback(
    (order: Order, waiterName: string | null) => {
      const orderDate = order.paidAt ? formatDateTime(order.paidAt) : formatDateTime(order.createdAt)
      const receiptId = order.id.slice(-8).toUpperCase()

      const seatingDisplay = getSeatingDisplay(order)
      const seatingInfo = []
      if (order.orderType !== "delivery" && order.orderType !== "saboy") {
        seatingInfo.push(`
        <div class="info-row">
          <span>${order.seatingType || order.tableType || (order.roomNumber ? "Xona" : "Stol")}:</span>
          <span>${order.roomNumber || order.tableNumber}</span>
        </div>
      `)
        if (order.floor) {
          seatingInfo.push(`
          <div class="info-row">
            <span>Qavat:</span>
            <span>${order.floor}</span>
          </div>
        `)
        }
      }
      if (order.customerName) {
        seatingInfo.push(`
        <div class="info-row">
          <span>Mijoz:</span>
          <span>${order.customerName}</span>
        </div>
      `)
      }
      if (waiterName) {
        seatingInfo.push(`
        <div class="info-row">
          <span>Ofitsiant:</span>
          <span>${waiterName}</span>
        </div>
      `)
      }

      return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Chek - ${receiptId}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0 auto;
            padding: 5mm;
            line-height: 1.3;
            color: black;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 2px solid black;
            padding-bottom: 5px;
          }
          .restaurant-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
          }
          .info {
            margin-bottom: 10px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 14px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1px;
            font-size: 12px;
          }
          .item-name {
            flex: 1;
            font-weight: bold;
          }
          .item-qty {
            width: 30px;
            text-align: center;
            font-weight: bold;
          }
          .item-price {
            width: 70px;
            text-align: right;
            font-weight: bold;
          }
          .item-total {
            width: 80px;
            text-align: right;
            font-weight: bold;
          }
          .notes {
            font-style: italic;
            font-size: 0.9em;
            margin-left: 10px;
            color: #666;
          }
          .total {
            font-weight: bold;
            text-align: right;
            margin-top: 10px;
            font-size: 18px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
            border-top: 1px dashed black;
            padding-top: 5px;
          }
          @media print {
            body {
              width: 80mm;
              margin: 0;
              padding: 0;
            }
            @page {
              margin: 5mm;
              size: 80mm auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="info">
            <div class="info-row">
              <span>Chek №:</span>
              <span>${receiptId}</span>
            </div>
            <div class="info-row">
              <span>Sana:</span>
              <span>${orderDate.date}</span>
            </div>
            <div class="info-row">
              <span>Vaqt:</span>
              <span>${orderDate.time}</span>
            </div>
            <div class="info-row">
              <span>Holat:</span>
              <span>${order.status === "pending" ? "Kutilmoqda" : order.status === "preparing" ? "Tayyorlanmoqda" : order.status === "completed" ? "Yakunlangan" : order.status === "paid" ? "To'langan" : "Noma'lum"}</span>
            </div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="info">
          <div class="info-row">
            <span>Joy turi:</span>
            <span>${seatingDisplay}</span>
          </div>
          ${seatingInfo.join("")}
        </div>
        <div class="divider"></div>
        <div>
          <div class="item" style="font-weight: bold;">
            <div class="item-name">Taom</div>
            <div class="item-qty">Soni</div>
            <div class="item-total">Jami</div>
          </div>
        <div class="divider"></div>
          ${order.items
            .map(
              (item: any) => `
            <div class="item">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">${item.quantity}</div>
              <div class="item-total">${formatCurrency(item.price * item.quantity)}</div>
            </div>
          `,
            )
            .join("")}
        </div>
        ${
          order.orderType === "delivery"
            ? `
          <div class="divider"></div>
          <div class="info">
            <div class="info-row">
              <span>Taomlar:</span>
              <span>${formatCurrency(order.subtotal || 0)}</span>
            </div>
            ${
              order.containerCost && order.containerCost > 0
                ? `
              <div class="info-row">
                <span>Idishlar:</span>
                <span>${formatCurrency(order.containerCost)}</span>
              </div>
            `
                : ""
            }
            ${
              order.deliveryFee && order.deliveryFee > 0
                ? `
              <div class="info-row">
                <span>Yetkazib berish:</span>
                <span>${formatCurrency(order.deliveryFee)}</span>
              </div>
            `
                : ""
            }
          </div>
        `
            : ""
        }
        <div class="divider"></div>
        <div class="total">
          <div>JAMI: ${formatCurrency(order.total)}</div>
        </div>
        ${
          order.orderType === "delivery" && order.address
            ? `
          <div class="divider"></div>
          <div class="info">
            <div class="info-row">
              <span>Yetkazib berish ma'lumotlari:</span>
            </div>
            ${
              order.phoneNumber
                ? `
              <div class="info-row">
                <span>Tel:</span>
                <span>${order.phoneNumber}</span>
              </div>
            `
                : ""
            }
            <div class="info-row">
              <span>Manzil:</span>
              <span>${order.address}</span>
            </div>
          </div>
        `
            : ""
        }
      </body>
      </html>
    `
    },
    [getSeatingDisplay, formatCurrency],
  )

  const handlePrint = useCallback(() => {
    if (!order) return

    const receiptHTML = generateReceiptHTML(order, waiterName)

    // Diagnostika uchun loglar
    console.log("handlePrint chaqirildi.")
    console.log("window.electronAPI mavjudmi?", !!window.electronAPI)
    console.log("window.electronAPI.printReceipt mavjudmi?", !!(window.electronAPI && window.electronAPI.printReceipt))

    if (window.electronAPI && window.electronAPI.printReceipt) {
      console.log("Electron API orqali chop etishga urinilmoqda.")
      window.electronAPI.printReceipt(receiptHTML)
    } else {
      console.log("Electron API topilmadi, iframe orqali chop etishga urinilmoqda.")
      // Oddiy brauzer uchun yashirin iframe orqali
      if (!printFrameRef.current) {
        const iframe = document.createElement("iframe")
        iframe.style.position = "fixed"
        iframe.style.right = "0"
        iframe.style.bottom = "0"
        iframe.style.width = "0"
        iframe.style.height = "0"
        iframe.style.border = "0"
        document.body.appendChild(iframe)
        printFrameRef.current = iframe
      }

      const frameDoc = printFrameRef.current.contentDocument
      if (frameDoc) {
        frameDoc.open()
        frameDoc.write(receiptHTML)
        frameDoc.close()

        setTimeout(() => {
          if (printFrameRef.current?.contentWindow) {
            printFrameRef.current.contentWindow.print()
            console.log("Iframe orqali window.print() chaqirildi.")
          }
        }, 500)
      }
    }
  }, [order, waiterName, generateReceiptHTML])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
        <h1 className="mb-4 text-2xl font-bold text-destructive">Xatolik yuz berdi</h1>
        <p className="mb-6 text-muted-foreground">{error || "Buyurtma topilmadi"}</p>
        <Link href="/admin/saboy">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Orqaga qaytish
          </Button>
        </Link>
      </div>
    )
  }

  // Format dates
  const orderDate = order.paidAt ? formatDateTime(order.paidAt) : formatDateTime(order.createdAt)
  // const receiptUrl = `${typeof window !== "undefined" ? window.location.origin : "https://restoran.uz"}/receipt/${order.id}` // Not used in generated HTML

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
        <div className="container mx-auto px-4">
          {/* Header - No print */}
          <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/admin/saboy">
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Orqaga qaytish
              </Button>
            </Link>
            <Button onClick={handlePrint} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
              <Printer className="mr-2 h-4 w-4" />
              Chop etish
            </Button>
          </div>

          {/* Receipt Display (for web view) */}
          <div className="mx-auto max-w-sm bg-white shadow-2xl p-6">
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
              <h1 className="text-xl font-bold mb-2">🍽️ RESTORAN NOMI</h1>
            </div>

            {/* Order Info */}
            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Chek №:</span>
                <span className="font-mono font-bold">{order.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Sana:</span>
                <span>{orderDate.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Vaqt:</span>
                <span>{orderDate.time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Holat:</span>
                {getStatusBadge(order.status)}
              </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-400 my-4"></div>

            {/* Order Type */}
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {getSeatingIcon(order)}
                <span>{getSeatingDisplay(order)}</span>
              </div>

              {order.customerName && <p className="text-sm mt-1">Mijoz: {order.customerName}</p>}

              {waiterName && (
                <div className="flex items-center text-sm mt-1">
                  <User className="mr-1 h-3 w-3" />
                  <span>Ofitsiant: {waiterName}</span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-dashed border-gray-400 my-4"></div>

            {/* Items */}
            <div className="mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 font-bold">Taom</th>
                    <th className="text-center py-1 font-bold">Soni</th>
                    <th className="text-right py-1 font-bold">Narx</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index} className="border-b border-dashed border-gray-200">
                      <td className="py-1 text-left">{item.name}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">{formatCurrency(item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Delivery Details */}
            {order.orderType === "delivery" && (
              <div className="mb-4">
                <div className="border-t-2 border-dashed border-gray-400 my-4"></div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Taomlar:</span>
                    <span>{formatCurrency(order.subtotal || 0)}</span>
                  </div>
                  {order.containerCost && order.containerCost > 0 && (
                    <div className="flex justify-between">
                      <span>Idishlar:</span>
                      <span>{formatCurrency(order.containerCost)}</span>
                    </div>
                  )}
                  {order.deliveryFee && order.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Yetkazib berish:</span>
                      <span>{formatCurrency(order.deliveryFee)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t-2 border-dashed border-gray-400 my-4"></div>

            {/* Total */}
            <div className="mb-4 border-t-2 border-black pt-2">
              <div className="flex justify-between text-lg font-bold">
                <span>JAMI TO'LOV:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* Delivery Address */}
            {order.orderType === "delivery" && order.address && (
              <div className="mb-4 p-3 bg-gray-50 rounded border text-sm">
                <p className="font-medium mb-1">Yetkazib berish ma'lumotlari:</p>
                {order.phoneNumber && <p>Tel: {order.phoneNumber}</p>}
                <p>Manzil: {order.address}</p>
              </div>
            )}

            <div className="border-t-2 border-dashed border-gray-400 my-4"></div>

            {/* QR Code (only for web display, not in generated print HTML) */}
            {/* {order.id && (
              <div className="text-center my-4">
                <QRCode value={receiptUrl} size={80} />
              </div>
            )} */}

            {/* Footer */}
            <div className="text-center text-sm mt-4 border-t border-dashed border-gray-400 pt-4">
              <p>Rahmat!</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

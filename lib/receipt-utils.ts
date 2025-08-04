import { formatCurrency } from "@/lib/utils"
// import QRCode from "qrcode"

interface OrderItem {
  name: string
  price: number
  quantity: number
}

interface OrderData {
  items: OrderItem[]
  total: number
  subtotal?: number
  customerName?: string
  tableNumber?: number | null
  roomNumber?: number | null
  orderType: "table" | "delivery" | "saboy"
  status: string
  isPaid: boolean
  seatingType?: string
  tableType?: string
  waiterId?: string
  waiterName?: string
  phoneNumber?: string
  address?: string
  deliveryFee?: number
  containerCost?: number
  createdAt?: any // Firebase Timestamp or Date
  paidAt?: any // Firebase Timestamp or Date
}

// Helper to format date/time from Firebase Timestamp or Date object
const formatTimestampToDateTime = (timestamp: any): { date: string; time: string } => {
  let date: Date | null = null
  if (timestamp && typeof timestamp.toDate === "function") {
    try {
      date = timestamp.toDate()
    } catch (e) {
      console.error("Firebase timestamp conversion error:", e)
    }
  } else if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === "number") {
    date = new Date(timestamp)
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp)
  } else if (timestamp && typeof timestamp === "object" && timestamp.seconds && typeof timestamp.seconds === "number") {
    date = new Date(timestamp.seconds * 1000)
  }

  if (!date || isNaN(date.getTime())) {
    return { date: "Noma'lum sana", time: "Noma'lum vaqt" }
  }

  const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  const formattedTime = new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)

  return { date: formattedDate, time: formattedTime }
}

export async function generateReceiptHTML(orderId: string, orderData: OrderData, baseUrl: string) {
  const orderDateTime = orderData.paidAt
    ? formatTimestampToDateTime(orderData.paidAt)
    : formatTimestampToDateTime(orderData.createdAt)

  // const receiptPageUrl = `${baseUrl}/receipt/${orderId}`
  // let qrCodeDataUrl = ""
  // try {
  //   // qrCodeDataUrl = await toDataURL(receiptPageUrl, { width: 100, margin: 2 })
  // } catch (err) {
  //   console.error("QR kod yaratishda xatolik:", err)
  //   qrCodeDataUrl = "" // Xatolik bo'lsa bo'sh qoldiramiz
  // }

  // Get the appropriate seating display
  const getSeatingDisplay = (order: OrderData) => {
    if (order.orderType === "delivery") {
      return "Yetkazib berish"
    }
    if (order.orderType === "saboy") {
      return "Saboy"
    }
    const seatingType = order.seatingType || (order.roomNumber ? "Xona" : order.tableType || "Stol")
    const seatingNumber = order.roomNumber || order.tableNumber
    return seatingNumber ? `${seatingType} #${seatingNumber}` : seatingType
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Chek - ${orderId}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          margin: 0 auto;
          padding: 5mm;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
        }
        .restaurant-name {
          font-size: 16px;
          font-weight: bold;
        }
        .info {
          margin-bottom: 5px;
        }
        .info-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          font-weight: bold;
          font-size: 16px;
        }
        .divider {
          border-top: 2px solid #000;
          margin: 3px 0;
        }
        .item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1px;
        }
        .item-name {
          flex: 1;
            font-size: 16px;
            font-weight: bold;
        }
        .item-qty {
          width: 30px;
          text-align: center;
            font-weight: bold;
            font-size: 16px;
        }
        .item-price {
          width: 70px;
          text-align: right;
                      font-weight: bold;
            font-size: 16px;
        }
        .item-total {
          width: 100px;
          text-align: right;
        font-weight: bold;
        font-size: 16px;
        }
        .total {
          font-weight: bold;
          text-align: center;
          margin-top: 5px;
          font-size: 25px;
        }
        .footer {
          text-align: center;
          margin-top: 10px;
          font-size: 16px;
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
      
      <div class="info">
        <div class="info-row">
          <span>Sana:</span>
          <span>${orderDateTime.date} ${orderDateTime.time}</span>
        </div>

        <div class="info-row">
          <span>ofitsiant:</span>
          <span>${orderData.waiterName}</span>
      </div>
              <div class="info-row">
          <span>stol:</span>
          <span>${orderData.tableNumber}</span>
        </div>

      
      <div class="divider"></div>
      
      <div>
        <div class="item" style="font-weight: bold;">
          <div class="item-name">Taom</div>
          <div class="item-qty">Soni</div>
          <div class="item-total">Jami</div>
        </div>
      <div class="divider"></div>
        
        ${orderData.items
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
      
      <div class="divider"></div>
      
      ${
        orderData.orderType === "delivery" && (orderData.subtotal || orderData.containerCost || orderData.deliveryFee)
          ? `
        <div class="info">
          ${orderData.subtotal ? `<div class="info-row"><span>Taomlar narxi:</span><span>${formatCurrency(orderData.subtotal)}</span></div>` : ""}
          ${orderData.containerCost && orderData.containerCost > 0 ? `<div class="info-row"><span>Idishlar narxi:</span><span>${formatCurrency(orderData.containerCost)}</span></div>` : ""}
          ${orderData.deliveryFee && orderData.deliveryFee > 0 ? `<div class="info-row"><span>Yetkazib berish narxi:</span><span>${formatCurrency(orderData.deliveryFee)}</span></div>` : ""}
        </div>
        <div class="divider"></div>
      `
          : ""
      }

      <div class="total">
        <div>JAMI: ${formatCurrency(orderData.total)}</div>
      </div>
      <div class="divider"></div>
      


    </body>
    </html>
  `
}
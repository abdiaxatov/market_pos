"use client"

import type React from "react"

import { Separator } from "@/components/ui/separator"
import { getStatusIcon, getStatusText } from "@/lib/utils"
import { MapPin } from "lucide-react"

interface ConfirmationPageProps {
  order: {
    roomNumber?: string | null
    tableNumber?: string | null
    status: string
    orderType?: string | null
    address?: string | null
    phoneNumber?: string | null
    deliveryFee?: number
    containerCost?: number
  }
}

const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ order }) => {
  return (
    <div className="mb-6 flex items-center justify-center gap-4">
      {order.roomNumber ? (
        <>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Xona raqami</p>
            <p className="text-xl font-semibold">{order.roomNumber}</p>
          </div>

          <Separator orientation="vertical" className="h-10" />
        </>
      ) : order.orderType === "table" && order.tableNumber ? (
        <>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Stol raqami</p>
            <p className="text-xl font-semibold">{order.tableNumber}</p>
          </div>

          <Separator orientation="vertical" className="h-10" />
        </>
      ) : order.orderType === "delivery" ? (
        <>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Yetkazib berish</p>
            <p className="text-xl font-semibold">
              <MapPin className="inline h-4 w-4 mr-1" />
            </p>
          </div>

          <Separator orientation="vertical" className="h-10" />
        </>
      ) : null}

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Buyurtma holati</p>
        <div className="flex items-center justify-center gap-1">
          {getStatusIcon(order.status)}
          <p className="font-medium capitalize">{getStatusText(order.status)}</p>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationPage

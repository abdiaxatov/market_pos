"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Car,
  Home,
  Users,
  ShoppingBag,
  CreditCard,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
} from "lucide-react"
import type { Order, MenuItem } from "@/types"
import { formatCurrency } from "@/lib/utils"

interface OrderDetailsProps {
  order: Order | null
  onClose: () => void
  menuItems?: MenuItem[]
  onStatusUpdate?: (orderId: string, newStatus: string) => void
}

export function OrderDetails({ order, onClose, menuItems = [], onStatusUpdate }: OrderDetailsProps) {
  if (!order) {
    return null
  }

  // Helper function to get menu item name
  const getMenuItemName = (itemId: string) => {
    const menuItem = menuItems?.find((item) => item.id === itemId)
    return menuItem?.name || "Noma'lum taom"
  }

  // Helper function to format date
  const formatOrderDate = (dateValue: any) => {
    if (!dateValue) return "N/A"

    let date: Date
    if (dateValue instanceof Date) {
      date = dateValue
    } else if (dateValue.toDate && typeof dateValue.toDate === "function") {
      date = dateValue.toDate()
    } else {
      date = new Date(dateValue)
    }

    return date.toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { icon: AlertCircle, label: "Kutilmoqda", variant: "outline" as const, color: "text-orange-600" },
      preparing: { icon: Timer, label: "Tayyorlanmoqda", variant: "default" as const, color: "text-yellow-600" },
      ready: { icon: CheckCircle, label: "Tayyor", variant: "default" as const, color: "text-blue-600" },
      completed: { icon: CheckCircle, label: "Yakunlangan", variant: "default" as const, color: "text-green-600" },
      delivered: { icon: Truck, label: "Yetkazildi", variant: "default" as const, color: "text-indigo-600" },
      paid: { icon: CreditCard, label: "To'langan", variant: "default" as const, color: "text-emerald-600" },
      cancelled: { icon: XCircle, label: "Bekor qilingan", variant: "destructive" as const, color: "text-red-600" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const IconComponent = config.icon

    return (
      <Badge variant={config.variant} className={`${config.color} flex items-center gap-1`}>
        <IconComponent className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  // Helper function to get order type info
  const getOrderTypeInfo = (orderType: string) => {
    const typeConfig = {
      table: { icon: Users, label: "Stol buyurtmasi", color: "text-blue-600" },
      delivery: { icon: Car, label: "Yetkazib berish", color: "text-green-600" },
      saboy: { icon: Home, label: "Saboy", color: "text-purple-600" },
    }

    const config = typeConfig[orderType as keyof typeof typeConfig] || typeConfig.table
    const IconComponent = config.icon

    return (
      <div className={`flex items-center gap-2 ${config.color}`}>
        <IconComponent className="w-4 h-4" />
        <span className="font-medium">{config.label}</span>
      </div>
    )
  }

  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Buyurtma #{order.orderNumber || order.id.substring(0, 8).toUpperCase()}
          </DialogTitle>
          <DialogDescription>Buyurtma tafsilotlari va holati haqida to'liq ma'lumot</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {/* Order Type and Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Buyurtma turi</div>
                {getOrderTypeInfo(order.orderType)}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Holat</div>
                {getStatusBadge(order.status)}
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-5 h-5" />
                Mijoz ma'lumotlari
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {order.customerName && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Mijoz ismi</div>
                      <div className="font-medium">{order.customerName}</div>
                    </div>
                  </div>
                )}

                {(order.customerPhone || order.phoneNumber) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Phone className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Telefon raqami</div>
                      <div className="font-medium">{order.customerPhone || order.phoneNumber}</div>
                    </div>
                  </div>
                )}

                {order.address && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Manzil</div>
                      <div className="font-medium">{order.address}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location Information */}
            {order.orderType === "table" && (order.tableNumber || order.roomNumber) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Joy ma'lumotlari
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Joy</div>
                      <div className="font-medium">
                        {order.seatingType || "Stol"} #{order.tableNumber || order.roomNumber}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Time Information */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Vaqt ma'lumotlari
              </h3>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Buyurtma vaqti</div>
                    <div className="font-medium">{formatOrderDate(order.createdAt)}</div>
                  </div>
                </div>

                {order.paidAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">To'langan vaqti</div>
                      <div className="font-medium">{formatOrderDate(order.paidAt)}</div>
                    </div>
                  </div>
                )}

                {order.deliveredAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Truck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Yetkazilgan vaqti</div>
                      <div className="font-medium">{formatOrderDate(order.deliveredAt)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Buyurtma tarkibi ({order.items.length} ta taom)
              </h3>

              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.name || getMenuItemName(item.id || item.menuItemId)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-muted-foreground italic mt-1">Izoh: {item.notes}</div>
                      )}
                      {item.category && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(item.price * item.quantity)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Buyurtma xulosasi
              </h3>

              <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
                {order.subtotal && (
                  <div className="flex justify-between">
                    <span>Taomlar narxi:</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                )}

                {order.orderType === "delivery" && order.deliveryFee && order.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Yetkazib berish:</span>
                    <span>{formatCurrency(order.deliveryFee)}</span>
                  </div>
                )}

                {order.containerCost && order.containerCost > 0 && (
                  <div className="flex justify-between">
                    <span>Idishlar:</span>
                    <span>{formatCurrency(order.containerCost)}</span>
                  </div>
                )}

                <Separator className="my-3" />

                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Jami to'lov:</span>
                  <span className="text-primary">{formatCurrency(order.total || order.totalPrice || 0)}</span>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            {order.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Qo'shimcha izohlar</h3>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{order.notes}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
          {onStatusUpdate && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium">Holatni o'zgartirish:</span>
              <Select onValueChange={(status) => onStatusUpdate(order.id, status)} value="">
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Holat tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Kutilmoqda</SelectItem>
                  <SelectItem value="preparing">Tayyorlanmoqda</SelectItem>
                  <SelectItem value="ready">Tayyor</SelectItem>
                  <SelectItem value="completed">Yakunlangan</SelectItem>
                  <SelectItem value="delivered">Yetkazildi</SelectItem>
                  <SelectItem value="paid">To'langan</SelectItem>
                  <SelectItem value="cancelled">Bekor qilingan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={onClose} className="w-full sm:w-auto">
            Yopish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

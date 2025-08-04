"use client"

import { MenuItemComponent } from "@/components/menu-item"
import type { MenuItem } from "@/types"

interface MenuGridProps {
  items: MenuItem[]
}

export function MenuGrid({ items }: MenuGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Hech qanday taom topilmadi</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 p-0.5">
      {items.map((item) => (
        <MenuItemComponent key={item.id} item={item} />
      ))}
    </div>
  )
}

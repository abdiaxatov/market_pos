import type { MenuItem } from "@/types"
import { MenuItemCard } from "@/components/menu-item-card"

interface MenuCategoryProps {
  category: string
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
}

export function MenuCategory({ category, items, onAddToCart }: MenuCategoryProps) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{category}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} onAddToCart={onAddToCart} />
        ))}
      </div>
    </div>
  )
}

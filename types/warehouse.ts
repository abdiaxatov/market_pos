export interface Product {
  id: string
  nomi: string
  kategoriya: string
  birlik: string
  narx_birlik: number
  narx_tarixi: PriceHistory[]
  chiqish_norma_foiz: number
  pishirish_yo_qot_foiz: number
  minimal_zapas: number
  saqlash_muddati_kun: number
  status: "aktiv" | "noaktiv"
  joylashuv?: string
  kirim_jami: number
  chiqim_jami: number
  qolgan: number
  kirimlar: Income[]
  chiqimlar: Outcome[]
  partiyalar: Batch[]
  inventar_farqi?: InventoryDifference
  statistika: ProductStatistics
  qayta_foyda?: ReusableWaste
  tayyor_mahsulot: ReadyProduct
  ogohlantirishlar: Warning[]
  createdAt?: any
  updatedAt?: any
}

export interface PriceHistory {
  narx: number
  sana: string
}

export interface Income {
  id: string
  miqdor: number
  birlik: string
  sana: string
  yaroqlilik?: string
  yetkazib_beruvchi?: string
  yaratuvchi: User
}

export interface Outcome {
  id: string
  miqdor: number
  birlik: string
  sana: string
  retsept_id?: string
  izoh?: string
  yaratuvchi: User
}

export interface Batch {
  id?: string
  miqdor: number
  yaroqlilik: string
  kirim_sana: string
}

export interface InventoryDifference {
  hisoblangan: number
  real_topilgan: number
  farq: number
  sana: string
}

export interface ProductStatistics {
  yoqotish_kg: number
  tayyor_foydali_miqdor_kg: number
  tayyor_narx_kg: number
}

export interface ReusableWaste {
  miqdor_kg: number
  foydalanish_izohi: string
}

export interface ReadyProduct {
  nomi: string
  tayyor_kg: number
  tayyor_narx: number
}

export interface Warning {
  tip: "muddati_tugagan" | "minimal_zapas_past" | "tugagan"
  sana?: string
  miqdor?: number
  xabar: string
}

export interface User {
  id: string
  ism: string
}

export interface Recipe {
  id: string
  nomi: string
  porsiya_soni: number
  tarkibi: RecipeIngredient[]
  statistika: RecipeStatistics
  tayyor_mahsulot: ReadyProduct
  yaratuvchi: User
  menu_item_id?: string
  tayyorlash_vaqti?: number
  qiyinlik?: string
  tavsif?: string
  createdAt?: any
  updatedAt?: any
}

export interface RecipeIngredient {
  product_id: string
  miqdor: number
  birlik: string
  product_name?: string
}

export interface RecipeStatistics {
  umumiy_miqdor_kg: number
  umumiy_narx_som: number
  tayyor_foydali_miqdor_kg: number
  tayyor_narx_kg: number
}

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description?: string
  image?: string
  available: boolean
}

export interface UnitConversion {
  [key: string]: {
    [key: string]: number
  }
}

export interface DashboardStats {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  expiredCount: number
  todayIncomes: number
  todayOutcomes: number
  totalWaste: number
  efficiency: number
}

export interface ChartData {
  name: string
  value: number
  kirim?: number
  chiqim?: number
  qolgan?: number
  yoqotish?: number
  samaradorlik?: number
}

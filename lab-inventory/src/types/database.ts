export type UserRole = 'admin' | 'lab_manager' | 'supervisor' | 'tech'
export type MaintenanceStatus = 'scheduled' | 'overdue' | 'completed'
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'BIF' | 'CDF'

export const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'Fr' },
  { code: 'BIF', label: 'Burundi Franc', symbol: 'FBu' },
  { code: 'CDF', label: 'Congolese Franc', symbol: 'FC' },
]

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
}

export interface Equipment {
  id: string
  name: string
  category: string
  serial_number: string | null
  supplier: string | null
  vendor_contact: string | null
  purchase_date: string | null
  warranty_expiry: string | null
  cost: number | null
  currency: Currency | null
  notes: string | null
  photo_urls: string[]
  created_at: string
  updated_at: string
}

export interface MaintenanceSchedule {
  id: string
  equipment_id: string
  label: string
  interval_days: number
  lead_days: number
  next_due: string
  last_alerted_at: string | null
  created_at: string
  equipment?: Equipment
}

export interface MaintenanceLog {
  id: string
  schedule_id: string
  equipment_id: string
  performed_at: string
  performed_by: string | null
  notes: string | null
  created_at: string
  schedule?: MaintenanceSchedule
  equipment?: Equipment
}

export interface ItemType {
  id: string
  name: string
  category: string
  unit: string
  min_threshold: number
  low_stock_alerted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ItemSource {
  id: string
  item_type_id: string
  manufacturer: string
  supplier: string | null
  notes: string | null
  created_at: string
}

export interface StockCount {
  id: string
  item_type_id: string
  quantity: number
  counted_at: string
  counted_by: string | null
  notes: string | null
  created_at: string
  item_type?: ItemType
}

export interface Delivery {
  id: string
  item_type_id: string
  item_source_id: string | null
  quantity: number
  lot_number: string | null
  expiry_date: string | null
  received_at: string
  received_by: string | null
  notes: string | null
  created_at: string
  item_type?: ItemType
  item_source?: ItemSource
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      equipment: { Row: Equipment; Insert: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Equipment> }
      maintenance_schedules: { Row: MaintenanceSchedule; Insert: Omit<MaintenanceSchedule, 'id' | 'created_at'>; Update: Partial<MaintenanceSchedule> }
      maintenance_logs: { Row: MaintenanceLog; Insert: Omit<MaintenanceLog, 'id' | 'created_at'>; Update: Partial<MaintenanceLog> }
      item_types: { Row: ItemType; Insert: Omit<ItemType, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ItemType> }
      item_sources: { Row: ItemSource; Insert: Omit<ItemSource, 'id' | 'created_at'>; Update: Partial<ItemSource> }
      stock_counts: { Row: StockCount; Insert: Omit<StockCount, 'id' | 'created_at'>; Update: Partial<StockCount> }
      deliveries: { Row: Delivery; Insert: Omit<Delivery, 'id' | 'created_at'>; Update: Partial<Delivery> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

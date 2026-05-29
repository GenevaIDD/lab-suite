import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Today's date as YYYY-MM-DD — use as max on date inputs that must not be in the future */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Units that use decimal quantities (continuous measures)
const DECIMAL_UNITS = ['ml', 'ml.', 'mL', 'l', 'l.', 'litre', 'litres', 'kg', 'g', 'g.', 'mg', 'µl', 'µL']

export function qtyStep(unit?: string | null): string {
  if (!unit) return '1'
  const u = unit.trim().toLowerCase()
  return DECIMAL_UNITS.some(d => d === u) ? '0.01' : '1'
}

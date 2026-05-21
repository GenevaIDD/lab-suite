import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Units that use decimal quantities (continuous measures)
const DECIMAL_UNITS = ['ml', 'ml.', 'mL', 'l', 'l.', 'litre', 'litres', 'kg', 'g', 'g.', 'mg', 'µl', 'µL']

export function qtyStep(unit?: string | null): string {
  if (!unit) return '1'
  const u = unit.trim().toLowerCase()
  return DECIMAL_UNITS.some(d => d === u) ? '0.01' : '1'
}

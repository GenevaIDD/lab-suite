import { describe, it, expect } from 'vitest'
import { qtyStep } from './utils'

describe('qtyStep', () => {
  // Whole-unit items → step 1
  it('returns "1" for pièces', () => expect(qtyStep('pièces')).toBe('1'))
  it('returns "1" for boîtes', () => expect(qtyStep('boîtes')).toBe('1'))
  it('returns "1" for flacons', () => expect(qtyStep('flacons')).toBe('1'))
  it('returns "1" for rouleaux', () => expect(qtyStep('rouleaux')).toBe('1'))
  it('returns "1" for tests', () => expect(qtyStep('tests')).toBe('1'))
  it('returns "1" for cartons', () => expect(qtyStep('cartons')).toBe('1'))
  it('returns "1" for units', () => expect(qtyStep('units')).toBe('1'))
  it('returns "1" for paires', () => expect(qtyStep('paires')).toBe('1'))
  it('returns "1" for disques', () => expect(qtyStep('disques')).toBe('1'))
  it('returns "1" for plaquettes', () => expect(qtyStep('plaquettes')).toBe('1'))

  // Continuous measures → step 0.01
  it('returns "0.01" for ml (lowercase)', () => expect(qtyStep('ml')).toBe('0.01'))
  it('returns "0.01" for mL (mixed case)', () => expect(qtyStep('mL')).toBe('0.01'))
  it('returns "0.01" for litres', () => expect(qtyStep('litres')).toBe('0.01'))
  it('returns "0.01" for kg', () => expect(qtyStep('kg')).toBe('0.01'))
  it('returns "0.01" for g', () => expect(qtyStep('g')).toBe('0.01'))
  it('returns "0.01" for µL', () => expect(qtyStep('µL')).toBe('0.01'))
  it('returns "0.01" for mg', () => expect(qtyStep('mg')).toBe('0.01'))
  it('returns "0.01" for l', () => expect(qtyStep('l')).toBe('0.01'))

  // Edge cases
  it('returns "1" for null', () => expect(qtyStep(null)).toBe('1'))
  it('returns "1" for undefined', () => expect(qtyStep(undefined)).toBe('1'))
  it('returns "1" for empty string', () => expect(qtyStep('')).toBe('1'))
  it('returns "1" for unknown unit', () => expect(qtyStep('widgets')).toBe('1'))
})

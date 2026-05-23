import { describe, it, expect } from 'vitest'
import { normalize, tokens, isSimilar, findSimilar } from './similarity'

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('CRYOTUBES')).toBe('cryotubes')
  })

  it('strips accents', () => {
    expect(normalize('Éthanol')).toBe('ethanol')
    expect(normalize('Désinfectant')).toBe('desinfectant')
    expect(normalize('écouvillons')).toBe('ecouvillons')
    expect(normalize('Réactif')).toBe('reactif')
  })

  it('converts µ/μ to u', () => {
    expect(normalize('2µL cryotubes')).toBe('2ul cryotubes')
    expect(normalize('200μL tips')).toBe('200ul tips')
  })

  it('replaces non-alphanumeric with spaces and trims', () => {
    expect(normalize('APW (5 mL)')).toBe('apw 5 ml')
    expect(normalize('  spaces  ')).toBe('spaces')
    expect(normalize('a.b-c/d')).toBe('a b c d')
  })

  it('handles already-normalized input', () => {
    expect(normalize('cryotubes')).toBe('cryotubes')
  })
})

describe('tokens', () => {
  it('returns words of 3+ chars, excluding stop words', () => {
    const t = tokens('Tubes stériles 15 mL')
    expect(t.has('tubes')).toBe(true)
    expect(t.has('steriles')).toBe(true)
    expect(t.has('15')).toBe(false)   // too short after normalize becomes "15"
    expect(t.has('ml')).toBe(false)   // 2 chars
    expect(t.has('de')).toBe(false)   // stop word
  })

  it('returns empty set for short or stop words only', () => {
    expect(tokens('de la')).toEqual(new Set())
    expect(tokens('ab')).toEqual(new Set())
  })

  it('normalizes before tokenizing', () => {
    const t = tokens('Cryotubes')
    expect(t.has('cryotubes')).toBe(true)
    expect(t.has('Cryotubes')).toBe(false)
  })
})

describe('isSimilar', () => {
  // Substring matches
  it('matches when query is a substring of candidate (case-insensitive)', () => {
    expect(isSimilar('cryotubes', 'Cryotubes 2 mL')).toBe(true)
    expect(isSimilar('APW', 'APW (aliquotes 5 mL)')).toBe(true)
  })

  it('matches when candidate is a substring of query', () => {
    expect(isSimilar('2µL cryotubes', 'Cryotubes')).toBe(true)
  })

  it('matches same string exactly', () => {
    expect(isSimilar('cryotubes', 'cryotubes')).toBe(true)
  })

  // Token matches
  it('matches on shared significant token', () => {
    expect(isSimilar('APW poudre', 'APW aliquotes 5 mL')).toBe(true)
    expect(isSimilar('Tube stérile', 'Tubes stériles 15 mL')).toBe(true)
    expect(isSimilar('gants nitrile', 'Gants nitrile (boîte)')).toBe(true)
  })

  // Non-matches
  it('does not match unrelated items', () => {
    expect(isSimilar('gloves', 'cryotubes')).toBe(false)
    expect(isSimilar('autoclave tape', 'petri dish')).toBe(false)
  })

  it('returns false for query shorter than 3 chars', () => {
    expect(isSimilar('AB', 'ABC cryotubes')).toBe(false)
    expect(isSimilar('', 'cryotubes')).toBe(false)
  })

  // Accent/encoding edge cases
  it('matches despite accent differences', () => {
    expect(isSimilar('Éthanol', 'ethanol 95%')).toBe(true)
    expect(isSimilar('ecouvillon', 'Écouvillons rectaux')).toBe(true)
  })

  it('matches µL vs mL via normalization', () => {
    // Both normalize "µL" → "ul" and "mL" → "ml" — different tokens, but
    // "2ul cryotubes" includes "cryotubes" which matches
    expect(isSimilar('2µL cryotubes', '2mL cryotubes')).toBe(true)
  })
})

describe('findSimilar', () => {
  const items = [
    { id: '1', name: 'Cryotubes 2 mL' },
    { id: '2', name: 'APW poudre' },
    { id: '3', name: 'APW aliquotes 5 mL' },
    { id: '4', name: 'Gants nitrile' },
    { id: '5', name: 'Tubes stériles 15 mL' },
    { id: '6', name: 'Tubes stériles 50 mL' },
  ]

  it('returns empty for short query', () => {
    expect(findSimilar('AB', items)).toHaveLength(0)
    expect(findSimilar('', items)).toHaveLength(0)
  })

  it('finds matching items by substring', () => {
    const result = findSimilar('cryotubes', items)
    expect(result.map(i => i.id)).toContain('1')
  })

  it('finds items by shared token', () => {
    const result = findSimilar('APW', items)
    const ids = result.map(i => i.id)
    expect(ids).toContain('2')
    expect(ids).toContain('3')
  })

  it('limits results to maxResults', () => {
    const result = findSimilar('tubes', items, 2)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('returns empty when no matches', () => {
    expect(findSimilar('microscope', items)).toHaveLength(0)
  })
})

/**
 * Unit tests for the generateBarcode utility.
 *
 * Validates:
 *  - Return type is a string
 *  - Returned string contains valid SVG markup
 *  - No exceptions are thrown for valid SKU formats
 *  - Empty / blank SKUs are rejected with a clear error
 */

import { describe, it, expect } from 'vitest'
import { generateBarcode } from '../../../src/utils/barcode'

describe('generateBarcode', () => {
  // ── Return type ────────────────────────────────────────────────────────────

  it('returns a string for a simple SKU', () => {
    const result = generateBarcode('SKU-001')
    expect(typeof result).toBe('string')
  })

  // ── SVG content ────────────────────────────────────────────────────────────

  it('returned string contains SVG markup', () => {
    const result = generateBarcode('SKU-001')
    expect(result).toMatch(/<svg/i)
  })

  it('returned SVG has a closing svg tag', () => {
    const result = generateBarcode('SKU-001')
    expect(result).toMatch(/<\/svg>/i)
  })

  it('returned SVG has a viewBox attribute (valid dimensions)', () => {
    const result = generateBarcode('SKU-001')
    expect(result).toContain('viewBox')
  })

  // ── Does not throw for valid SKU formats ──────────────────────────────────

  it('does not throw for a numeric SKU', () => {
    expect(() => generateBarcode('1234567890')).not.toThrow()
  })

  it('does not throw for an alphanumeric SKU with hyphens', () => {
    expect(() => generateBarcode('PROD-ABC-001')).not.toThrow()
  })

  it('does not throw for a short single-character SKU', () => {
    expect(() => generateBarcode('A')).not.toThrow()
  })

  it('does not throw for a long SKU (up to Code128 limits)', () => {
    // Code128 can encode any ASCII string; 30 chars is well within limits
    expect(() => generateBarcode('LONGSKU-1234567890-ABCDEFGHIJ')).not.toThrow()
  })

  it('does not throw for a SKU with uppercase letters and digits', () => {
    expect(() => generateBarcode('WTR500ML')).not.toThrow()
  })

  it('does not throw for a SKU with slashes', () => {
    expect(() => generateBarcode('CAT/001/A')).not.toThrow()
  })

  // ── SVG is non-trivially sized (contains barcode paths) ───────────────────

  it('returns an SVG with meaningful content (length > 200 chars)', () => {
    const result = generateBarcode('SKU-001')
    expect(result.length).toBeGreaterThan(200)
  })

  it('different SKUs produce different SVG output', () => {
    const svg1 = generateBarcode('SKU-001')
    const svg2 = generateBarcode('SKU-002')
    expect(svg1).not.toBe(svg2)
  })

  // ── Error cases ────────────────────────────────────────────────────────────

  it('throws an error for an empty string SKU', () => {
    expect(() => generateBarcode('')).toThrow()
  })

  it('throws an error for a whitespace-only SKU', () => {
    expect(() => generateBarcode('   ')).toThrow()
  })

  it('error message for empty SKU mentions non-empty requirement', () => {
    expect(() => generateBarcode('')).toThrow(/non-empty/i)
  })
})

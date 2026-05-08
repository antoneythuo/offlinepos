/**
 * barcode.ts — Server-side (Node.js / Electron main process) barcode utility.
 *
 * Uses JsBarcode with @xmldom/xmldom to generate Code128 SVG barcodes
 * without requiring a browser DOM.
 */

import JsBarcode from 'jsbarcode'
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom'

/**
 * generateBarcode — generates a Code128 barcode SVG string for the given SKU.
 *
 * @param sku  The product SKU to encode. Must be a non-empty string.
 * @returns    A complete SVG string containing the barcode.
 * @throws     Error if the SKU is empty or JsBarcode cannot encode the value.
 *
 * @example
 * const svg = generateBarcode('SKU-001')
 * // svg starts with '<svg ...' and contains the barcode paths
 */
export function generateBarcode(sku: string): string {
  if (!sku || sku.trim().length === 0) {
    throw new Error('SKU must be a non-empty string')
  }

  // Create a minimal XML document and SVG element using @xmldom/xmldom
  const xmlDocument = new DOMImplementation().createDocument(
    'http://www.w3.org/1999/xhtml',
    'html',
    null
  )
  const svgNode = xmlDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')

  // Render the barcode into the SVG node
  JsBarcode(svgNode, sku, {
    xmlDocument: xmlDocument as unknown as Document,
    format: 'CODE128',
    displayValue: true,
    fontSize: 14,
    margin: 10,
    width: 2,
    height: 80,
    background: '#ffffff',
    lineColor: '#000000',
  })

  // Serialize the SVG node to a string
  const xmlSerializer = new XMLSerializer()
  return xmlSerializer.serializeToString(svgNode)
}

/**
 * BarcodeLabelPrint — renders a printable barcode label sheet.
 *
 * Displays the product name, SKU, formatted price, and the barcode SVG.
 * The "Print" button triggers `window.print()` so the browser/Electron
 * print dialog opens with the label layout.
 *
 * Usage:
 *   <BarcodeLabelPrint
 *     productName="Mineral Water 500ml"
 *     sku="SKU-001"
 *     price={45.00}
 *     barcodeSvg={svgString}
 *   />
 */

interface BarcodeLabelPrintProps {
  /** Display name of the product */
  productName: string
  /** Stock Keeping Unit identifier */
  sku: string
  /** Selling price (numeric) */
  price: number
  /** SVG markup string returned by `generateBarcode()` */
  barcodeSvg: string
}

export default function BarcodeLabelPrint({
  productName,
  sku,
  price,
  barcodeSvg,
}: BarcodeLabelPrintProps) {
  const formattedPrice = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(price)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Print button — hidden when actually printing via @media print */}
      <button
        onClick={handlePrint}
        className="print:hidden inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-800"
        aria-label="Print barcode label"
      >
        {/* Printer icon (inline SVG, no external dependency) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Print Label
      </button>

      {/*
       * Label card — this is what gets printed.
       * The `print:shadow-none print:border-none` utilities strip decorative
       * styles when the browser renders the print layout.
       */}
      <div
        className="w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-md print:shadow-none print:border-none print:rounded-none"
        role="region"
        aria-label="Barcode label"
      >
        {/* Product name */}
        <p className="mb-1 text-center text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
          {productName}
        </p>

        {/* Barcode SVG */}
        <div
          className="my-2 flex justify-center"
          // JsBarcode returns a complete <svg> element; dangerouslySetInnerHTML
          // is intentional here — the SVG is generated server-side by our own
          // utility and never contains user-supplied HTML.
          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
          aria-label={`Barcode for ${sku}`}
        />

        {/* SKU */}
        <p className="text-center text-xs text-gray-500 font-mono tracking-wide">
          {sku}
        </p>

        {/* Price */}
        <p className="mt-1 text-center text-base font-bold text-gray-900">
          {formattedPrice}
        </p>
      </div>
    </div>
  )
}

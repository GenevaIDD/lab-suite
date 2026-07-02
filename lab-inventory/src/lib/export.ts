// Excel (.xlsx) export helper. The write-excel-file library is imported
// dynamically inside downloadXlsx so it only downloads to the browser when a
// user actually clicks Export — keeping it out of the main bundle (important
// for slow connections).

export type XlsxCell = string | number | Date | null | undefined
export interface XlsxColumn { header: string; width?: number }
export interface XlsxSheet {
  name: string
  columns: XlsxColumn[]
  rows: XlsxCell[][]
}

function toCells(row: XlsxCell[]) {
  return row.map((cell) => {
    if (cell === null || cell === undefined) return { value: null }
    if (cell instanceof Date) return { type: Date, value: cell, format: 'yyyy-mm-dd' }
    if (typeof cell === 'number') return { type: Number, value: cell }
    return { type: String, value: String(cell) }
  })
}

export async function downloadXlsx(fileName: string, sheets: XlsxSheet[]): Promise<void> {
  const writeXlsxFile = (await import('write-excel-file/browser')).default

  // write-excel-file v4 multi-sheet API: an array of { data, sheet, columns };
  // .toFile(name) triggers the browser download. This works for one sheet too.
  const sheetObjects = sheets.map((s) => ({
    data: [
      s.columns.map((c) => ({ value: c.header, fontWeight: 'bold' })),
      ...s.rows.map(toCells),
    ],
    sheet: s.name,
    columns: s.columns.map((c) => ({ width: c.width ?? 22 })),
  }))

  // Loose cast at the boundary — the library's cell/option typing varies across versions.
  const write = writeXlsxFile as unknown as (
    sheets: unknown,
  ) => { toFile: (fileName: string) => Promise<void> }
  await write(sheetObjects).toFile(fileName)
}

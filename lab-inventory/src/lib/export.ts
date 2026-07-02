// Excel (.xlsx) export helper. The write-excel-file library is imported
// dynamically inside downloadXlsx so it only downloads to the browser when a
// user actually clicks Export — keeping it out of the main bundle (important
// for slow connections).

export type XlsxCell = string | number | Date | null | undefined
export interface XlsxColumn { header: string; width?: number }

export async function downloadXlsx(
  fileName: string,
  columns: XlsxColumn[],
  rows: XlsxCell[][],
): Promise<void> {
  const writeXlsxFile = (await import('write-excel-file/browser')).default

  const headerRow = columns.map((c) => ({ value: c.header, fontWeight: 'bold' }))
  const bodyRows = rows.map((r) =>
    r.map((cell) => {
      if (cell === null || cell === undefined) return { value: null }
      if (cell instanceof Date) return { type: Date, value: cell, format: 'yyyy-mm-dd' }
      if (typeof cell === 'number') return { type: Number, value: cell }
      return { type: String, value: String(cell) }
    }),
  )

  // Loose cast at the boundary — the library's cell/option typing varies
  // across versions; data + fileName are validated here instead.
  const write = writeXlsxFile as unknown as (
    data: unknown, sheetOptions: unknown, options: unknown,
  ) => Promise<unknown>
  await write(
    [headerRow, ...bodyRows],
    { columns: columns.map((c) => ({ width: c.width ?? 22 })) },
    { fileName },
  )
}

export type DataTableColumn<T> = {
  header: React.ReactNode
  render: (row: T, index: number) => React.ReactNode
  headerClassName?: string
  cellClassName?: string
}

/**
 * Basit, kolon-tabanlı jenerik tablo. Her sayfa kendi satır/hücre className'lerini
 * (rowClassName/headerRowClassName/column.headerClassName/column.cellClassName)
 * geçirerek mevcut görünümünü birebir korur - bu bileşen yalnızca tekrar eden
 * <table>/<thead>/<tbody> iskeletini ortaklaştırır, stil kararı vermez.
 */
export function DataTable<T>({
  columns, data, keyExtractor, rowClassName, headerRowClassName, emptyMessage,
}: {
  columns: DataTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T, index: number) => string | number
  rowClassName?: string
  headerRowClassName?: string
  emptyMessage?: string
}) {
  if (data.length === 0 && emptyMessage) {
    return <p className="text-sm text-gray-400 text-center py-10">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={headerRowClassName ?? 'border-b border-gray-50'}>
            {columns.map((col, i) => (
              <th key={i} className={col.headerClassName ?? 'px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase'}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={keyExtractor(row, i)} className={rowClassName ?? 'border-b border-gray-50 hover:bg-gray-50/60 group'}>
              {columns.map((col, j) => (
                <td key={j} className={col.cellClassName ?? 'px-4 py-4'}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

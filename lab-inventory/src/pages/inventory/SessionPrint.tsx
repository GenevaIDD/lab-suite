import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useSession, useSessionEntries } from '@/lib/queries'
import { Loader2 } from 'lucide-react'

export function SessionPrint() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession(id)
  const { data: entries = [], isLoading } = useSessionEntries(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto print:p-4">
      <style>{`@media print { button { display: none; } }`}</style>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Inventory Count Sheet</h1>
          <p className="text-sm text-gray-600 mt-1">
            Count date: {session ? format(parseISO(session.target_date), 'd MMMM yyyy') : '—'}
          </p>
          <p className="text-sm text-gray-600">
            Total items: {entries.length}
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Counted by: _______________________</p>
          <p className="mt-2">Signature: _______________________</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4 italic">
        Count each item without referring to previous stock levels. Record the actual quantity you see.
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-2 pr-4 w-8">#</th>
            <th className="text-left py-2 pr-4">Item</th>
            <th className="text-left py-2 pr-4 w-24">Unit</th>
            <th className="text-left py-2 pr-4 w-32">Quantity</th>
            <th className="text-left py-2 w-48">Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const isNewCategory =
              idx === 0 ||
              entry.item_type?.category !== entries[idx - 1]?.item_type?.category

            return (
              <>
                {isNewCategory && (
                  <tr key={`cat-${idx}`}>
                    <td colSpan={5} className="pt-4 pb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {entry.item_type?.category}
                      </span>
                    </td>
                  </tr>
                )}
                <tr key={entry.id} className="border-b border-gray-200">
                  <td className="py-2 pr-4 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="py-2 pr-4 font-medium">{entry.item_type?.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{entry.item_type?.unit}</td>
                  <td className="py-2 pr-4">
                    <div className="border-b border-gray-400 w-28 h-6" />
                  </td>
                  <td className="py-2">
                    <div className="border-b border-gray-300 w-full h-6" />
                  </td>
                </tr>
              </>
            )
          })}
        </tbody>
      </table>

      <div className="mt-8 text-xs text-gray-400 border-t pt-4">
        Uvira Lab Inventory · Printed {format(new Date(), 'd MMM yyyy HH:mm')}
      </div>

      <button
        onClick={() => window.print()}
        className="mt-6 px-4 py-2 bg-gray-800 text-white rounded text-sm print:hidden"
      >
        Print
      </button>
    </div>
  )
}

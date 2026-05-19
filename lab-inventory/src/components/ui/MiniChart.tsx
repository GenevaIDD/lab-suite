/**
 * Lightweight SVG charts — no external dependencies, React 19 safe.
 */

interface StockPoint {
  date: string       // YYYY-MM-DD
  countQty: number | null
  deliveryQty: number | null
}

interface BurnPeriod {
  period: string
  label: string
  burnRate: number
  consumed: number
  days: number
}

// ── helpers ───────────────────────────────────────────────────
const PAD = { top: 16, right: 24, bottom: 48, left: 48 }

function scaleY(val: number, min: number, max: number, h: number) {
  if (max === min) return h / 2
  return h - ((val - min) / (max - min)) * h
}

function scaleX(i: number, total: number, w: number) {
  if (total <= 1) return w / 2
  return (i / (total - 1)) * w
}

// ── StockChart ────────────────────────────────────────────────
export function StockChart({
  data,
  minThreshold,
  height = 220,
}: {
  data: StockPoint[]
  minThreshold: number
  height?: number
}) {
  const W = 600
  const H = height - PAD.top - PAD.bottom
  const iW = W - PAD.left - PAD.right

  const counts    = data.filter(d => d.countQty !== null)
  const allVals   = counts.map(d => d.countQty as number)
  allVals.push(minThreshold)
  data.filter(d => d.deliveryQty !== null).forEach(d => allVals.push(d.deliveryQty as number))

  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const pad    = (rawMax - rawMin) * 0.15 || 5
  const yMin   = Math.max(0, rawMin - pad)
  const yMax   = rawMax + pad

  const sy = (v: number) => scaleY(v, yMin, yMax, H)

  // Count dot positions (no connecting line — discrete measurements)
  const countPts = counts.map((d) => ({
    x: PAD.left + scaleX(data.indexOf(d), data.length, iW),
    y: PAD.top  + sy(d.countQty as number),
    qty: d.countQty as number,
    date: d.date,
  }))

  // Y axis ticks
  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) / yTicks) * i)

  // X axis labels (every 2nd point to avoid crowding)
  const xLabels = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0)

  // Delivery bars
  const barW = Math.min(20, iW / data.length / 2)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        style={{ minWidth: 280 }}
        aria-label="Stock au fil du temps"
      >
        {/* Grid */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} x2={PAD.left + iW}
              y1={PAD.top + sy(v)} y2={PAD.top + sy(v)}
              stroke="#e5e7eb" strokeWidth={1}
            />
            <text x={PAD.left - 6} y={PAD.top + sy(v) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Min threshold */}
        <line
          x1={PAD.left} x2={PAD.left + iW}
          y1={PAD.top + sy(minThreshold)} y2={PAD.top + sy(minThreshold)}
          stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3"
        />
        <text x={PAD.left + iW + 3} y={PAD.top + sy(minThreshold) + 4} fontSize={9} fill="#ef4444">
          Min
        </text>

        {/* Delivery bars */}
        {data.map((d, i) => {
          if (!d.deliveryQty) return null
          const x = PAD.left + scaleX(i, data.length, iW)
          const barH = (d.deliveryQty / yMax) * H * 0.6
          return (
            <g key={`d-${i}`}>
              <rect
                x={x - barW / 2} y={PAD.top + H - barH}
                width={barW} height={barH}
                fill="#22c55e" fillOpacity={0.75} rx={2}
              />
              <title>Livraison: +{d.deliveryQty}</title>
            </g>
          )
        })}

        {/* Vertical drop lines from dot to x-axis (make discrete nature clear) */}
        {countPts.map((p, i) => (
          <line key={`drop-${i}`} x1={p.x} x2={p.x} y1={p.y} y2={PAD.top + H}
            stroke="#1d4ed8" strokeWidth={1} strokeOpacity={0.25} strokeDasharray="3 2" />
        ))}

        {/* Count dots — isolated, no connecting line */}
        {countPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5} fill="#1d4ed8" stroke="#fff" strokeWidth={1.5}>
            <title>{p.date}: {p.qty}</title>
          </circle>
        ))}

        {/* X axis labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d)
          const x = PAD.left + scaleX(idx, data.length, iW)
          return (
            <text key={i} x={x} y={height - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {d.date.slice(0, 7)}
            </text>
          )
        })}

        {/* Legend */}
        <circle cx={PAD.left + 6} cy={12} r={5} fill="#1d4ed8" stroke="#fff" strokeWidth={1.5} />
        <text x={PAD.left + 16} y={16} fontSize={10} fill="#6b7280">Comptage</text>
        <rect x={PAD.left + 80} y={6} width={10} height={10} fill="#22c55e" fillOpacity={0.75} rx={1} />
        <text x={PAD.left + 94} y={16} fontSize={10} fill="#6b7280">Livraison</text>
        <line x1={PAD.left + 155} x2={PAD.left + 170} y1={11} y2={11} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
        <text x={PAD.left + 174} y={16} fontSize={10} fill="#9ca3af">Min</text>
      </svg>
    </div>
  )
}

// ── BurnChart ─────────────────────────────────────────────────
export function BurnChart({
  data,
  avgRate,
  unit,
  height = 200,
}: {
  data: BurnPeriod[]
  avgRate: number | null
  unit: string
  height?: number
}) {
  const W  = 600
  const H  = height - PAD.top - PAD.bottom
  const iW = W - PAD.left - PAD.right

  const maxRate = Math.max(...data.map(d => d.burnRate), avgRate ?? 0) * 1.2 || 1
  const barW    = Math.min(60, (iW / data.length) * 0.6)
  const sy      = (v: number) => H - (v / maxRate) * H
  const yTicks  = 4

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        style={{ minWidth: 280 }}
        aria-label="Taux de consommation"
      >
        {/* Grid */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (maxRate / yTicks) * i
          return (
            <g key={i}>
              <line
                x1={PAD.left} x2={PAD.left + iW}
                y1={PAD.top + sy(v)} y2={PAD.top + sy(v)}
                stroke="#e5e7eb" strokeWidth={1}
              />
              <text x={PAD.left - 6} y={PAD.top + sy(v) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                {v.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Average line */}
        {avgRate !== null && (
          <>
            <line
              x1={PAD.left} x2={PAD.left + iW}
              y1={PAD.top + sy(avgRate)} y2={PAD.top + sy(avgRate)}
              stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 3"
            />
            <text x={PAD.left + iW + 3} y={PAD.top + sy(avgRate) + 4} fontSize={9} fill="#6b7280">
              Moy.
            </text>
          </>
        )}

        {/* Bars */}
        {data.map((d, i) => {
          const slotW = iW / data.length
          const x = PAD.left + slotW * i + (slotW - barW) / 2
          const bH = (d.burnRate / maxRate) * H
          const labelX = PAD.left + slotW * i + slotW / 2
          return (
            <g key={i}>
              <rect x={x} y={PAD.top + H - bH} width={barW} height={bH} fill="#1d4ed8" rx={3} />
              <text
                x={labelX} y={PAD.top + H + 8}
                textAnchor="end"
                fontSize={9}
                fill="#9ca3af"
                transform={`rotate(-35, ${labelX}, ${PAD.top + H + 8})`}
              >
                {d.period}
              </text>
              <title>{d.label}{'\n'}{d.burnRate} {unit}/jour{'\n'}Consommé: {d.consumed}</title>
            </g>
          )
        })}

        {/* Y axis label */}
        <text
          x={10} y={PAD.top + H / 2}
          textAnchor="middle" fontSize={9} fill="#9ca3af"
          transform={`rotate(-90, 10, ${PAD.top + H / 2})`}
        >
          {unit}/jour
        </text>
      </svg>
    </div>
  )
}

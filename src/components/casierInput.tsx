import { useState, useEffect } from "react"

const BOUTEILLES_PAR_CASIER = 12

export function CasierInput({ value, onChange }: { value: number, onChange: (v: number) => void }) {
  const casiers = Math.floor(value)
  const bouteilles = Math.round((value - casiers) * BOUTEILLES_PAR_CASIER)

  return (
    <div className="flex items-center gap-2">
      <input type="number" min="0" value={casiers}
        onChange={e => {
          const c = parseInt(e.target.value) || 0
          onChange(c + bouteilles / BOUTEILLES_PAR_CASIER)
        }}
        className="w-20 border rounded p-2" placeholder="Casiers" />
      <span>casier(s) +</span>
      <input type="number" min="0" max={11} value={bouteilles}
        onChange={e => {
          let b = parseInt(e.target.value) || 0
          if (b >= 12) b = 11
          onChange(casiers + b / BOUTEILLES_PAR_CASIER)
        }}
        className="w-20 border rounded p-2" placeholder="Btls" />
      <span>btls</span>
      <span className="ml-2 text-sm text-gray-500">= {value.toFixed(2)} casier</span>
    </div>
  )
}

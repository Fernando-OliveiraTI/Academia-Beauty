'use client'

import { useEffect } from 'react'

/** Fallback de erro de renderização (ex.: documento inválido publicado): nunca expõe detalhes técnicos. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // O `digest` liga esta tela ao log do servidor sem mostrar a causa ao visitante.
    console.error('Falha ao renderizar a página', error.digest ?? '')
  }, [error])
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <h1 style={{ marginBottom: 8 }}>Não foi possível carregar esta página</h1>
        <p>Tente novamente em instantes.</p>
        <button type="button" className="admin-button" onClick={reset}>Tentar novamente</button>
      </div>
    </main>
  )
}

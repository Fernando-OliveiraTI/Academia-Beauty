import { useState } from 'react'

/** Aviso curto ("Corpo copiado.", "Arquivo baixado.") que some sozinho depois de 2,5 s; usado nas tabelas de detalhe do painel. */
export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null)
  const flash = (text: string) => { setNotice(text); setTimeout(() => setNotice(null), 2500) }
  /** Copia o texto para a área de transferência e avisa; sem permissão do navegador, avisa que não foi possível. */
  const copyText = async (text: string, message: string) => {
    try { await navigator.clipboard.writeText(text); flash(message) } catch { flash('Não foi possível copiar.') }
  }
  return { notice, flash, copyText }
}

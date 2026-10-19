import type { ReactNode } from 'react'

/** Envelope SVG dos ícones de traço do painel (24×24, traço de 1,8). */
export const svg = (d: ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

export const EYE_ICON = svg(<><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>)
export const CLOSE_ICON = svg(<path d="M6 6l12 12M18 6 6 18" />)

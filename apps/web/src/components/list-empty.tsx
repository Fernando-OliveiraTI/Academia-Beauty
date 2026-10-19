import type { ReactNode } from 'react'

/** Estado vazio das listas do painel: título + texto de orientação (busca sem resultado ou lista ainda vazia). */
export function ListEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="list-empty">
      <b>{title}</b>
      <p>{children}</p>
    </section>
  )
}

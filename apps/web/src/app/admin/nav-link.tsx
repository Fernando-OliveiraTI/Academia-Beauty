'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Link do menu do painel; marca como atual a rota exata (Dashboard) ou qualquer rota abaixo dela. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const current = href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  return <Link href={href} aria-current={current ? 'page' : undefined}>{children}</Link>
}

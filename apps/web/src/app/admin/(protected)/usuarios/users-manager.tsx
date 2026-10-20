'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field } from '@academia/design-system'
import { apiSend } from '@/lib/api-client'
import { useConfirm } from '@/components/confirm-dialog'
import { useDialogSync } from '@/components/use-dialog'
import { relativeTime } from '@/lib/relative-time'

export type UserRow = {
  id: number
  email: string
  fullName: string | null
  role: 'admin' | 'editor' | 'viewer' | null
  isActive: boolean
  twoFactorEnabled: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
}

const ROLE_LABEL = { admin: 'Administrador', editor: 'Editor', viewer: 'Leitor' } as const
type Role = keyof typeof ROLE_LABEL
const ROLE_HELP: Record<Role, string> = {
  admin: 'Acesso total, inclusive usuários, pagamentos e registros técnicos.',
  editor: 'Cria, edita e publica profissionais, cursos, páginas e mídia.',
  viewer: 'Só consulta profissionais, cursos e páginas.',
}

type Created = { name: string; email: string; password: string; reset: boolean }
type ApiMessage = { message?: string }

const DotsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>

function RowMenu({ row, self, onAction, busy }: { row: UserRow; self: boolean; onAction: (a: 'role' | 'toggle' | 'reset-password' | 'revoke' | 'reset-2fa', row: UserRow) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])
  // O painel da tabela tem rolagem (overflow) e cortaria um menu absoluto: o menu é fixo, ancorado ao botão.
  const toggle = () => {
    const rect = trigger.current?.getBoundingClientRect()
    if (rect) setAt({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) })
    setOpen((v) => !v)
  }
  const run = (a: Parameters<typeof onAction>[0]) => { setOpen(false); onAction(a, row) }
  return (
    <div className="row-menu" ref={root}>
      <button ref={trigger} type="button" className="icon-button" aria-label={`Ações para ${row.fullName ?? row.email}`} title="Ações" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><DotsIcon /></button>
      {open && at ? (
        <div className="row-menu-list" role="menu" style={{ position: 'fixed', top: at.top, right: at.right, left: 'auto', width: 'max-content', minWidth: 220 }}>
          <button type="button" role="menuitem" disabled={busy} onClick={() => run('role')}>Mudar papel</button>
          <button type="button" role="menuitem" disabled={busy} onClick={() => run('reset-password')}>Redefinir senha</button>
          <button type="button" role="menuitem" disabled={busy} onClick={() => run('revoke')}>Encerrar sessões</button>
          {row.twoFactorEnabled ? <button type="button" role="menuitem" disabled={busy} onClick={() => run('reset-2fa')}>Remover verificação em 2 etapas</button> : null}
          {!self ? <button type="button" role="menuitem" className={row.isActive ? 'danger' : undefined} disabled={busy} onClick={() => run('toggle')}>{row.isActive ? 'Desativar' : 'Reativar'}</button> : null}
        </div>
      ) : null}
    </div>
  )
}

export function UsersManager({ items, currentUserId }: { items: UserRow[]; currentUserId: number }) {
  const router = useRouter()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<null | { kind: 'create' } | { kind: 'role'; row: UserRow }>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('editor')

  useDialogSync(dialog, mode !== null || created !== null)

  const close = () => { setMode(null); setCreated(null); setError(null) }
  const flash = (text: string) => { setNotice(text); setTimeout(() => setNotice(null), 3500) }
  const reason = (res: { status: number; data: ApiMessage | null }) => (res.status === 403 ? 'Sem permissão para esta ação.' : res.data?.message ?? 'Não foi possível concluir. Tente novamente.')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await apiSend<{ user: UserRow; temporaryPassword: string } & ApiMessage>('POST', '/admin/users', { email, fullName, role })
    setBusy(false)
    if (!res.ok || !res.data?.temporaryPassword) return setError(reason(res))
    setMode(null)
    setCreated({ name: res.data.user.fullName ?? res.data.user.email, email: res.data.user.email, password: res.data.temporaryPassword, reset: false })
    setEmail(''); setFullName(''); setRole('editor')
    router.refresh()
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault()
    if (mode?.kind !== 'role') return
    setBusy(true); setError(null)
    const res = await apiSend<ApiMessage>('PUT', `/admin/users/${mode.row.id}`, { role })
    setBusy(false)
    if (!res.ok) return setError(reason(res))
    close(); flash('Papel atualizado. As sessões abertas dessa pessoa foram encerradas.')
    router.refresh()
  }

  async function act(action: 'role' | 'toggle' | 'reset-password' | 'revoke' | 'reset-2fa', row: UserRow) {
    const name = row.fullName ?? row.email
    if (action === 'role') { setRole(row.role ?? 'viewer'); setError(null); return setMode({ kind: 'role', row }) }
    setBusy(true); setNotice(null)
    try {
      if (action === 'toggle') {
        if (row.isActive && !(await confirm({ title: 'Desativar este usuário?', message: `“${name}” perde o acesso agora, inclusive nas sessões abertas.`, confirmLabel: 'Desativar', tone: 'danger' }))) return
        const res = await apiSend<ApiMessage>('PUT', `/admin/users/${row.id}`, { isActive: !row.isActive })
        if (!res.ok) return flash(reason(res))
        flash(row.isActive ? 'Usuário desativado.' : 'Usuário reativado.')
      } else if (action === 'reset-password') {
        if (!(await confirm({ title: 'Redefinir a senha?', message: `Uma senha provisória nova será gerada para “${name}”, que terá de trocá-la no próximo acesso. As sessões abertas são encerradas.`, confirmLabel: 'Redefinir' }))) return
        const res = await apiSend<{ temporaryPassword: string } & ApiMessage>('POST', `/admin/users/${row.id}/reset-password`)
        if (!res.ok || !res.data?.temporaryPassword) return flash(reason(res))
        setCreated({ name, email: row.email, password: res.data.temporaryPassword, reset: true })
      } else if (action === 'revoke') {
        if (!(await confirm({ title: 'Encerrar as sessões?', message: `“${name}” precisará entrar de novo em todos os aparelhos.`, confirmLabel: 'Encerrar' }))) return
        const res = await apiSend<ApiMessage>('POST', `/admin/users/${row.id}/revoke-sessions`)
        if (!res.ok) return flash(reason(res))
        flash('Sessões encerradas.')
      } else {
        if (!(await confirm({ title: 'Remover a verificação em duas etapas?', message: `Use quando “${name}” perdeu o celular e os códigos de recuperação. A pessoa terá de configurar de novo.`, confirmLabel: 'Remover', tone: 'danger' }))) return
        const res = await apiSend<ApiMessage>('POST', `/admin/users/${row.id}/reset-2fa`)
        if (!res.ok) return flash(reason(res))
        flash('Verificação em duas etapas removida.')
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true) } catch { setCopied(false) } }

  return (
    <>
      {confirmDialog}
      <div className="admin-hero-actions usr-hint">
        <Button onClick={() => { setError(null); setMode({ kind: 'create' }) }}>Novo usuário</Button>
        {notice ? <p role="status" className="form-ok">{notice}</p> : null}
      </div>

      <section className="admin-panel" style={{ marginTop: 'var(--space-4)' }}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Usuários do painel</caption>
            <thead><tr><th scope="col">Usuário</th><th scope="col">Papel</th><th scope="col">Situação</th><th scope="col">2 etapas</th><th scope="col">Último acesso</th><th scope="col">Ações</th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <th scope="row">{u.fullName ?? '—'}<small style={{ display: 'block', fontWeight: 400, color: 'var(--color-text-secondary)', overflowWrap: 'anywhere' }}>{u.email}{u.id === currentUserId ? ' · você' : ''}</small></th>
                  <td>{u.role ? ROLE_LABEL[u.role] : '—'}</td>
                  <td>
                    <span className="pay-pill" data-tone={u.isActive ? 'ok' : 'bad'}>{u.isActive ? 'Ativo' : 'Desativado'}</span>
                    {u.mustChangePassword ? <small style={{ display: 'block', color: 'var(--color-text-secondary)' }}>Troca de senha pendente</small> : null}
                  </td>
                  <td><span className="pay-pill" data-tone={u.twoFactorEnabled ? 'ok' : 'neutral'}>{u.twoFactorEnabled ? 'Ativa' : 'Desativada'}</span></td>
                  <td>{u.lastLoginAt ? <time dateTime={u.lastLoginAt} title={new Date(u.lastLoginAt).toLocaleString('pt-BR')}>{relativeTime(u.lastLoginAt)}</time> : 'Nunca entrou'}</td>
                  <td><RowMenu row={u} self={u.id === currentUserId} onAction={act} busy={busy} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialog} className="media-dialog usr-dialog" aria-labelledby="usr-title" onClose={close} onCancel={close} onClick={(e) => { if (e.target === dialog.current) close() }}>
        {created ? (
          <div className="acct-form">
            <h2 id="usr-title" style={{ margin: 0, fontSize: '1.1rem' }}>{created.reset ? 'Senha redefinida' : 'Usuário criado'}</h2>
            <p className="wizard-hint">Envie esta senha provisória para <strong>{created.name}</strong> ({created.email}) por um canal seguro. Ela aparece só agora e será trocada no primeiro acesso.</p>
            <code className="usr-temp">{created.password}</code>
            <div className="acct-actions">
              <Button variant="secondary" onClick={() => void copy(created.password)}>{copied ? 'Copiada' : 'Copiar senha'}</Button>
              <Button onClick={close}>Concluir</Button>
            </div>
          </div>
        ) : mode?.kind === 'create' ? (
          <form onSubmit={create} noValidate>
            <h2 id="usr-title" style={{ margin: 0, fontSize: '1.1rem' }}>Novo usuário</h2>
            <Field label="Nome" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Field label="E-mail" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div className="ds-field">
              <label className="ds-label" htmlFor="usr-role">Papel</label>
              <select id="usr-role" className="usr-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <p className="wizard-hint">{ROLE_HELP[role]}</p>
            </div>
            {error ? <p role="alert" className="form-error">{error}</p> : null}
            <div className="acct-actions">
              <Button variant="secondary" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={busy || !fullName.trim() || !email.trim()}>{busy ? 'Criando…' : 'Criar usuário'}</Button>
            </div>
          </form>
        ) : mode?.kind === 'role' ? (
          <form onSubmit={saveRole} noValidate>
            <h2 id="usr-title" style={{ margin: 0, fontSize: '1.1rem' }}>Mudar papel de {mode.row.fullName ?? mode.row.email}</h2>
            <div className="ds-field">
              <label className="ds-label" htmlFor="usr-role">Papel</label>
              <select id="usr-role" className="usr-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <p className="wizard-hint">{ROLE_HELP[role]}</p>
            </div>
            {error ? <p role="alert" className="form-error">{error}</p> : null}
            <div className="acct-actions">
              <Button variant="secondary" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={busy || role === mode.row.role}>{busy ? 'Salvando…' : 'Salvar'}</Button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  )
}

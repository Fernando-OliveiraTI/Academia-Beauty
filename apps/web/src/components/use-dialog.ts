import { useEffect, type RefObject } from 'react'

/**
 * Mantém um `<dialog>` modal em sincronia com um estado de "aberto": abre com `showModal()` e fecha com `close()`.
 * Onde o navegador (ou o jsdom dos testes) não tem a API, cai no atributo `open`.
 * O fechamento pelo usuário (Esc, botão) continua por conta do `onClose`/`onCancel` de cada diálogo, que deve zerar o estado.
 */
export function useDialogSync(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) (typeof dialog.showModal === 'function' ? dialog.showModal() : dialog.setAttribute('open', ''))
    if (!open && dialog.open) (typeof dialog.close === 'function' ? dialog.close() : dialog.removeAttribute('open'))
  }, [ref, open])
}

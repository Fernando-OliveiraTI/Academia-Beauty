import { notFound, redirect } from 'next/navigation'

/** Editor único: o cadastro em formulário foi removido; tudo é editado no editor visual (Configurações para o que não é página). */
export default async function LegacyRegistryRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  redirect(`/admin/editor/cursos/${id}`)
}

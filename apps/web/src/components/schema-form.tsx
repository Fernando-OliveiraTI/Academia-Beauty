'use client'

import { useId, type ReactNode } from 'react'
import type { MediaAsset } from '@academia/contracts'
import { ImageField } from './image-field'

/**
 * Formulário gerado do JSON Schema (derivado do schema Zod da seção). Só edita valores de campos
 * que o schema declara; nada de HTML livre. A validação final é do schema, no cliente e no servidor.
 */
export type JsonSchema = {
  type?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: unknown[]
  maxLength?: number
  maxItems?: number
  minItems?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  anyOf?: JsonSchema[]
}

const LABELS: Record<string, string> = {
  eyebrow: 'Sobrecabeçalho', title: 'Título', titleLead: 'Título (início)', titleAccent: 'Título (destaque)', titleStrong: 'Título (negrito)',
  text: 'Texto', copy: 'Texto de apoio', sub: 'Subtítulo', lead: 'Chamada', label: 'Rótulo', href: 'Link', src: 'Arquivo', photo: 'Foto', logoSrc: 'Logo', coverSrc: 'Capa', productImage: 'Imagem do produto', alt: 'Texto alternativo',
  name: 'Nome', nameFirst: 'Nome', nameAccent: 'Sobrenome (destaque)', brandLead: 'Marca (início)', brandAccent: 'Marca (destaque)',
  links: 'Links', items: 'Itens', cards: 'Cartões', tags: 'Etiquetas', paragraphs: 'Parágrafos', meta: 'Informações', gold: 'Destaque dourado',
  hidePhoto: 'Não mostrar retrato (só o monograma)', monogram: 'Monograma (iniciais)', placesLabel: 'Rótulo dos locais', places: 'Locais', image: 'Imagem', portrait: 'Retrato', video: 'Vídeo', account: 'Conta', instagram: 'Instagram', handle: 'Perfil', followers: 'Seguidores',
  person: 'Pessoa', badge: 'Selo', plusLabel: 'Rótulo do botão +', sectionIndex: 'Índice da seção', tickerUnit: 'Texto do letreiro',
  ctaLabel: 'Texto do botão', copyright: 'Direitos autorais', socials: 'Redes sociais', icon: 'Ícone', logoLead: 'Logo (início)', logoAccent: 'Logo (destaque)',
  ariaLabel: 'Descrição para leitores de tela', fallback: 'Texto alternativo do vídeo', type: 'Tipo', hud: 'Painel (HUD)', value: 'Valor', accent: 'Destaque',
  columns: 'Colunas da galeria', showPerson: 'Mostrar nome do profissional', showTitle: 'Mostrar nome do trabalho (Trabalho 1, 2…) e etiquetas', showPlus: 'Mostrar botão +',
  siteLinks: 'Menu principal do site (topo)', hideBackLink: 'Ocultar "Mais cursos do profissional"',
  bullets: 'Tópicos', question: 'Pergunta', answer: 'Resposta', price: 'Preço', note: 'Observação',
  productName: 'Nome do produto', productCaption: 'Legenda do produto', notice: 'Aviso no topo do formulário', seals: 'Selos',
  stepData: 'Etapa 1 (nome)', stepPayment: 'Etapa 2 (nome)', stepConfirmation: 'Etapa 3 (nome)',
  summaryTitle: 'Resumo: título', summaryProduct: 'Resumo: rótulo do produto', summaryDiscount: 'Resumo: rótulo do desconto', summaryTotal: 'Resumo: rótulo do total',
  dataTitle: 'Etapa 1: título', dataLead: 'Etapa 1: texto de apoio', buyerFields: 'Campos do comprador', placeholder: 'Texto de exemplo', help: 'Texto de ajuda', required: 'Obrigatório',
  dataButton: 'Etapa 1: texto do botão', dataNote: 'Etapa 1: nota de segurança',
  paymentTitle: 'Etapa 2: título', paymentLead: 'Etapa 2: texto de apoio', methods: 'Formas de pagamento', info: 'Informação ao selecionar',
  paymentButton: 'Etapa 2: texto do botão', paymentNote: 'Etapa 2: nota de segurança', paymentBack: 'Etapa 2: texto de voltar',
  confirmTitle: 'Etapa 3: título', confirmLead: 'Etapa 3: texto de apoio', confirmButton: 'Etapa 3: botão para o pagamento', confirmBack: 'Etapa 3: texto de voltar', confirmUnavailable: 'Etapa 3: aviso de compra indisponível',
}
/** Nomes amigáveis de opções (tipo de campo do comprador). */
const ENUM_LABELS: Record<string, string> = { '4': '4 colunas (tudo em uma linha)', '3': '3 colunas', '2': '2 colunas', name: 'Nome completo', text: 'Texto livre', email: 'E-mail', cpf: 'CPF', phone: 'Celular com DDD' }
const humanize = (key: string) => LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

const resolve = (s: JsonSchema): JsonSchema => {
  // Zod 4 representa `.optional()`/nullable com anyOf; usamos o ramo não nulo.
  if (s.anyOf) return s.anyOf.find((b) => b.type !== 'null') ?? s
  return s
}

export function defaultFor(raw: JsonSchema): unknown {
  const s = resolve(raw)
  if (s.enum?.length) return s.enum[0]
  switch (s.type) {
    case 'object': return Object.fromEntries(Object.entries(s.properties ?? {}).filter(([k]) => s.required?.includes(k)).map(([k, v]) => [k, defaultFor(v)]))
    case 'array': return Array.from({ length: s.minItems ?? 0 }, () => defaultFor(s.items ?? {}))
    case 'boolean': return false
    case 'number': case 'integer': return 0
    default: return ''
  }
}

/** Campos que guardam um arquivo da biblioteca de mídia (`src`, `photo`, `logoSrc`…): viram seletor de imagem, sem mostrar o caminho. */
const isMediaKey = (key: string) => /^(src|photo|picture|poster)$/i.test(key) || /(Src|Photo|Image)$/.test(key)

const isUrlKey = (key: string) => /(^|[a-z])(href|url)$/i.test(key) || key === 'src' || key === 'Src'

type NodeProps = { path?: string; schema: JsonSchema; value: unknown; onChange: (next: unknown) => void; name: string; depth?: number; labelText?: string; optional?: boolean; mediaKind?: 'image' | 'video'; onPickAsset?: (asset: MediaAsset) => void }

export function SchemaForm({ schema, value, onChange }: { schema: JsonSchema; value: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  return <div className="sf-root"><ObjectFields schema={resolve(schema)} value={value} onChange={onChange as (v: unknown) => void} depth={0} path="" /></div>
}

function ObjectFields({ schema, value, onChange, depth, mediaKind, path = '' }: { schema: JsonSchema; value: unknown; onChange: (v: unknown) => void; depth: number; mediaKind?: 'image' | 'video'; path?: string }) {
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const required = schema.required ?? []
  return (
    <>
      {Object.entries(schema.properties ?? {}).map(([key, child]) => (
        <Node
          key={key}
          path={path ? `${path}.${key}` : key}
          name={key}
          schema={child}
          value={obj[key]}
          depth={depth}
          optional={!required.includes(key)}
          mediaKind={mediaKind}
          // Escolher um vídeo da biblioteca também ajusta o tipo MIME do `<source>`, quando a seção tem esse campo.
          onPickAsset={key === 'src' && schema.properties?.type ? (asset) => onChange({ ...obj, src: asset.path, type: asset.mime }) : undefined}
          // `undefined` remove a chave (campo opcional limpo/removido): o JSON volta a ser válido sem valor vazio inventado.
          onChange={(next) => {
            const copy = { ...obj }
            if (next === undefined) delete copy[key]
            else copy[key] = next
            onChange(copy)
          }}
        />
      ))}
    </>
  )
}

function Node({ path, schema: raw, value, onChange, name, depth = 0, labelText, optional = false, mediaKind, onPickAsset }: NodeProps): ReactNode {
  const id = useId()
  const schema = resolve(raw)
  const label = labelText ?? humanize(name)

  if (schema.enum) {
    return (
      <div className="sf-field" data-field-path={path}>
        <label htmlFor={id} className="ds-label">{label}</label>
        <select id={id} className="ds-input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {schema.enum.map((o) => <option key={String(o)} value={String(o)}>{ENUM_LABELS[String(o)] ?? String(o)}</option>)}
        </select>
      </div>
    )
  }
  if (schema.type === 'boolean') {
    return (
      <label className="sf-check" data-field-path={path}>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {label}
      </label>
    )
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    // Campo limpo: opcional some do JSON; obrigatório fica vazio (inválido até preencher) em vez de virar 0 em silêncio.
    return (
      <div className="sf-field" data-field-path={path}>
        <label htmlFor={id} className="ds-label">{label}</label>
        <input
          id={id} className="ds-input" type="number" value={typeof value === 'number' ? value : ''}
          min={schema.minimum ?? (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum : undefined)} max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
          onChange={(e) => onChange(e.target.value === '' ? (optional ? undefined : '') : Number(e.target.value))}
        />
      </div>
    )
  }
  if (schema.type === 'string' && isMediaKey(name)) {
    return <div data-field-path={path}><ImageField label={label} value={typeof value === 'string' ? value : ''} kind={mediaKind === 'video' ? 'video' : 'image'} onChange={(next) => onChange(next)} onPickAsset={onPickAsset} /></div>
  }
  if (schema.type === 'string') {
    const text = typeof value === 'string' ? value : ''
    const long = (schema.maxLength ?? 0) > 150
    const common = { id, value: text, maxLength: schema.maxLength, onChange: (e: { target: { value: string } }) => onChange(optional && e.target.value === '' ? undefined : e.target.value) }
    return (
      <div className="sf-field" data-field-path={path}>
        <label htmlFor={id} className="ds-label">{label}</label>
        {long ? <textarea className="ds-input" rows={Math.min(8, Math.max(3, Math.ceil(text.length / 60)))} {...common} />
          : <input className="ds-input" type="text" inputMode={isUrlKey(name) ? 'url' : undefined} autoComplete="off" {...common} />}
        {schema.maxLength ? <small className="sf-count" aria-hidden="true">{text.length}/{schema.maxLength}</small> : null}
      </div>
    )
  }
  if (schema.type === 'object') {
    if (optional && (value === undefined || value === null)) {
      return <button type="button" className="admin-button secondary" onClick={() => onChange(defaultFor(schema))}>Adicionar {label.toLowerCase()}</button>
    }
    return (
      <fieldset className="sf-group" data-depth={depth}>
        <legend>{label}</legend>
        <ObjectFields schema={schema} value={value} onChange={onChange} depth={depth + 1} mediaKind={name === 'video' ? 'video' : 'image'} path={path} />
        {optional ? <button type="button" className="link-button" onClick={() => onChange(undefined)}>Remover {label.toLowerCase()}</button> : null}
      </fieldset>
    )
  }
  if (schema.type === 'array') return <ArrayField path={path} schema={schema} value={value} onChange={onChange} name={name} depth={depth} />
  return null
}

function ArrayField({ path = '', schema, value, onChange, name, depth = 0 }: NodeProps) {
  const list = Array.isArray(value) ? value : []
  const item = resolve(schema.items ?? {})
  const label = humanize(name)
  const max = schema.maxItems ?? 50
  const min = schema.minItems ?? 0
  const set = (next: unknown[]) => onChange(next)
  const move = (from: number, to: number) => {
    const next = list.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set(next)
  }
  return (
    <fieldset className="sf-group" data-depth={depth}>
      <legend>{label} <span className="sf-count">({list.length}{schema.maxItems ? `/${schema.maxItems}` : ''})</span></legend>
      {list.map((entry, i) => (
        <div className="sf-item" key={i}>
          <div className="sf-item-head">
            <span>{label} {i + 1}</span>
            <span className="sf-item-actions">
              <button type="button" className="link-button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Mover ${label} ${i + 1} para cima`}>↑</button>
              <button type="button" className="link-button" disabled={i === list.length - 1} onClick={() => move(i, i + 1)} aria-label={`Mover ${label} ${i + 1} para baixo`}>↓</button>
              <button type="button" className="link-button" disabled={list.length <= min} onClick={() => set(list.filter((_, j) => j !== i))} aria-label={`Remover ${label} ${i + 1}`}>Remover</button>
            </span>
          </div>
          {item.type === 'object'
            ? <ObjectFields path={`${path}.${i}`} schema={item} value={entry} depth={depth + 1} onChange={(next) => set(list.map((e, j) => (j === i ? next : e)))} />
            : <Node path={`${path}.${i}`} name={name} labelText={`Conteúdo de ${label} ${i + 1}`} schema={item} value={entry} depth={depth + 1} onChange={(next) => set(list.map((e, j) => (j === i ? next : e)))} />}
        </div>
      ))}
      <button type="button" className="admin-button secondary" disabled={list.length >= max} onClick={() => set([...list, defaultFor(item)])}>Adicionar {label.toLowerCase()}</button>
    </fieldset>
  )
}

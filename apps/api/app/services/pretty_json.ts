/**
 * Indenta um JSON **sem interpretar os números**: o `JSON.parse` arredondaria IDs de 19 dígitos, e aqui o objetivo é
 * ver exatamente o que a The Members enviou. Se o texto não parecer JSON, devolve igual.
 */
export function prettyJson(raw: string): string {
  const out: string[] = []
  let indent = 0
  let inString = false
  let escaped = false
  const pad = () => '  '.repeat(indent)
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (inString) {
      out.push(ch)
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      out.push(ch)
      continue
    }
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue
    if (ch === '{' || ch === '[') {
      const next = raw.slice(i + 1).trimStart()[0]
      if ((ch === '{' && next === '}') || (ch === '[' && next === ']')) {
        out.push(ch, next!)
        i = raw.indexOf(next!, i + 1)
        continue
      }
      indent += 1
      out.push(ch, '\n', pad())
    } else if (ch === '}' || ch === ']') {
      indent = Math.max(0, indent - 1)
      out.push('\n', pad(), ch)
    } else if (ch === ',') {
      out.push(ch, '\n', pad())
    } else if (ch === ':') {
      out.push(': ')
    } else {
      out.push(ch)
    }
  }
  return out.join('')
}

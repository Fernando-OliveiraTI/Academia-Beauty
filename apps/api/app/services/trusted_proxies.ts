import { BlockList, isIP } from 'node:net'

/** Atalhos aceitos (os mesmos do proxy-addr usado pelo Adonis). */
const KEYWORDS: Record<string, string[]> = {
  loopback: ['127.0.0.0/8', '::1/128'],
  linklocal: ['169.254.0.0/16', 'fe80::/10'],
  uniquelocal: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
}

function add(list: BlockList, entry: string) {
  const [address, prefix] = entry.split('/')
  const family = isIP(address ?? '')
  if (!address || family === 0)
    throw new Error(`TRUSTED_PROXIES: "${entry}" não é um IP, CIDR ou atalho válido`)
  const type = family === 4 ? 'ipv4' : 'ipv6'
  if (prefix === undefined) {
    list.addAddress(address, type)
    return
  }
  const bits = Number(prefix)
  if (!Number.isInteger(bits) || bits < 0 || bits > (family === 4 ? 32 : 128)) {
    throw new Error(`TRUSTED_PROXIES: prefixo inválido em "${entry}"`)
  }
  list.addSubnet(address, bits, type)
}

/**
 * `TRUSTED_PROXIES` (vírgula) → função `(endereço) => confiável?` para o `trustProxy` do Adonis. O tipo do Adonis só aceita
 * texto/booleano/função, e um texto com vírgulas seria lido como UM endereço inválido (a API nem subiria).
 * Item inválido lança um erro legível na subida em vez de quebrar dentro de uma biblioteca.
 */
export function parseTrustedProxies(
  raw: string | undefined
): ((address: string) => boolean) | null {
  const entries = (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (entries.length === 0) return null

  const list = new BlockList()
  for (const entry of entries) {
    const keyword = KEYWORDS[entry.toLowerCase()]
    if (keyword) for (const range of keyword) add(list, range)
    else add(list, entry)
  }
  return (address: string) => {
    const plain = address.startsWith('::ffff:') ? address.slice(7) : address // IPv4 dentro de IPv6
    const family = isIP(plain)
    return family === 0 ? false : list.check(plain, family === 4 ? 'ipv4' : 'ipv6')
  }
}

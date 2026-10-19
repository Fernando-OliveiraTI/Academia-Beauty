/**
 * Leitura simples do User-Agent (sem dependência): navegador, sistema e tipo de aparelho. Cobre os casos que importam
 * para a análise do público, inclusive os navegadores embutidos de redes sociais (Instagram, Facebook, TikTok).
 */
export type ParsedAgent = {
  browser: string
  browserVersion: string | null
  os: string
  osVersion: string | null
  device: 'mobile' | 'tablet' | 'desktop' | 'bot'
  /** Navegador embutido num app (Instagram, Facebook, TikTok…): muda como o checkout se comporta. */
  inApp: string | null
}

const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch|postman/i

const first = (ua: string, re: RegExp): string | null => re.exec(ua)?.[1] ?? null
const major = (v: string | null) => (v ? v.split('.')[0]! : null)

export function parseUserAgent(raw: string | null | undefined): ParsedAgent {
  const ua = (raw ?? '').slice(0, 400)
  if (!ua)
    return {
      browser: 'Desconhecido',
      browserVersion: null,
      os: 'Desconhecido',
      osVersion: null,
      device: 'desktop',
      inApp: null,
    }

  let inApp: string | null = null
  if (/Instagram/i.test(ua)) inApp = 'Instagram'
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) inApp = 'Facebook'
  else if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) inApp = 'TikTok'
  else if (/Line\//i.test(ua)) inApp = 'Line'
  else if (/Pinterest/i.test(ua)) inApp = 'Pinterest'
  else if (/\bwv\b|; wv\)/i.test(ua) && /Android/i.test(ua)) inApp = 'WebView'

  let browser = 'Desconhecido'
  let version: string | null = null
  const set = (name: string, re: RegExp) => {
    browser = name
    version = major(first(ua, re))
  }
  if (/Edg(e|A|iOS)?\//.test(ua)) set('Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/)
  else if (/OPR\/|Opera/.test(ua)) set('Opera', /(?:OPR|Opera)\/([\d.]+)/)
  else if (/SamsungBrowser\//.test(ua)) set('Samsung Internet', /SamsungBrowser\/([\d.]+)/)
  else if (/Firefox\/|FxiOS\//.test(ua)) set('Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/)
  else if (/CriOS\//.test(ua)) set('Chrome', /CriOS\/([\d.]+)/)
  else if (/Chrome\//.test(ua)) set('Chrome', /Chrome\/([\d.]+)/)
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) set('Safari', /Version\/([\d.]+)/)
  else if (inApp) browser = inApp

  let os = 'Desconhecido'
  let osVersion: string | null = null
  if (/Windows NT/.test(ua)) {
    os = 'Windows'
    osVersion = first(ua, /Windows NT ([\d.]+)/)
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS'
    osVersion = first(ua, /OS ([\d_]+)/)?.replace(/_/g, '.') ?? null
  } else if (/Android/.test(ua)) {
    os = 'Android'
    osVersion = first(ua, /Android ([\d.]+)/)
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = 'macOS'
    osVersion = first(ua, /Mac OS X ([\d_]+)/)?.replace(/_/g, '.') ?? null
  } else if (/CrOS/.test(ua)) os = 'ChromeOS'
  else if (/Linux/.test(ua)) os = 'Linux'

  let device: ParsedAgent['device'] = 'desktop'
  if (BOT.test(ua)) device = 'bot'
  else if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) device = 'tablet'
  else if (/Mobi|iPhone|Android/i.test(ua)) device = 'mobile'

  return { browser, browserVersion: version, os, osVersion: major(osVersion), device, inApp }
}

import { setMediaHosts } from '@academia/page-schema'
import env from '#start/env'

// Os schemas de documento só aceitam mídia `https://` dos hosts de CDN configurados aqui.
setMediaHosts((env.get('MEDIA_CDN_HOST') ?? '').split(','))

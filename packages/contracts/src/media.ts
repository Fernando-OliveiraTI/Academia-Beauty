import { z } from 'zod';

/** Tipos aceitos na biblioteca. O tipo real vem da assinatura do arquivo, nunca do nome nem do `Content-Type` enviado. SVG fica de fora (pode conter script). */
export const MEDIA_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MEDIA_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_LIMITS = {
  imageBytes: 15 * 1024 * 1024,
  videoBytes: 60 * 1024 * 1024,
  /** Lado máximo aceito (px) e total de pixels: protege a API de imagens-bomba. */
  imageSide: 12000,
  imagePixels: 80_000_000,
} as const;

/** Larguras (px) dos derivados gerados no envio. Nunca maiores que a original. */
export const MEDIA_WIDTHS = [320, 640, 960, 1440, 2048] as const;

export const mediaAssetSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  kind: z.enum(MEDIA_KINDS),
  name: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  /** Caminho público para usar no documento (`/media/<id>`). */
  path: z.string(),
  createdAt: z.string(),
  inUse: z.boolean(),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const listMediaQuerySchema = z.object({
  kind: z.enum(MEDIA_KINDS).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

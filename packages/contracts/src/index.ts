import { z } from 'zod';

/** Papéis iniciais do painel. Podem ser ajustados pelo cliente (decisão D-004, item 10). */
export const ROLES = ['admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'users.manage',
  'professionals.read',
  'professionals.write',
  'professionals.publish',
  'courses.read',
  'courses.write',
  'courses.publish',
  'pages.read',
  'pages.write',
  'pages.publish',
  'media.manage',
  'commerce.manage',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Matriz papel → permissões. Fonte única usada por API e web. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  editor: [
    'professionals.read', 'professionals.write', 'professionals.publish',
    'courses.read', 'courses.write', 'courses.publish',
    'pages.read', 'pages.write', 'pages.publish', 'media.manage',
  ],
  viewer: ['professionals.read', 'courses.read', 'pages.read'],
};

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const meSchema = z.object({
  id: z.number().int().positive(),
  email: z.string(),
  fullName: z.string().nullable(),
  roles: z.array(z.enum(ROLES)),
  permissions: z.array(z.enum(PERMISSIONS)),
  twoFactorEnabled: z.boolean().default(false),
  mustChangePassword: z.boolean().default(false),
  /** Administrador sem 2FA numa instalação que o exige: só acessa a própria conta. */
  twoFactorRequired: z.boolean().default(false),
});
export type Me = z.infer<typeof meSchema>;

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role]) set.add(p);
  return [...set];
}
export * from './professional.js';
export * from './course.js';
export * from './document.js';
export * from './media.js';
export * from './home.js';
export * from './payments.js';

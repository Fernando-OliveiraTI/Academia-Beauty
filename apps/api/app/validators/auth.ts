import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().toLowerCase().email().maxLength(254),
    password: vine.string().minLength(1).maxLength(256),
  })
)

/** Segundo fator no login: código do aplicativo (6 dígitos) OU código de recuperação. */
export const secondFactorValidator = vine.compile(
  vine.object({
    code: vine.string().trim().maxLength(32).optional(),
    recoveryCode: vine.string().trim().maxLength(32).optional(),
  })
)

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string().minLength(1).maxLength(256),
    newPassword: vine.string().minLength(1).maxLength(256),
  })
)

export const enableTwoFactorValidator = vine.compile(
  vine.object({
    code: vine
      .string()
      .trim()
      .regex(/^\d{6}$/),
  })
)

export const disableTwoFactorValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(1).maxLength(256),
    code: vine.string().trim().maxLength(32),
  })
)

export const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().trim().toLowerCase().email().maxLength(254),
    fullName: vine.string().trim().minLength(2).maxLength(120),
    role: vine.enum(['admin', 'editor', 'viewer'] as const),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(120).optional(),
    role: vine.enum(['admin', 'editor', 'viewer'] as const).optional(),
    isActive: vine.boolean().optional(),
  })
)

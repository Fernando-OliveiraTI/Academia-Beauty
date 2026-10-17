/** Corta no limite do schema da seção (com reticências) para o documento montado nunca ficar inválido. */
export const clip = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guarda do padrão de UI do painel (ver `.claude/skills/academia-admin-ui`): nada de caixas do navegador.
 * Confirmações usam `useConfirm()` (components/confirm-dialog.tsx); avisos ficam na própria tela.
 */
const SRC = join(__dirname, '..')
const NATIVE = /\b(?:window\.|globalThis\.)(?:alert|confirm|prompt)\s*\(|(?<![.\w])(?:alert|prompt)\s*\(/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : files(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('padrão de UI', () => {
  it('não usa alert/confirm/prompt do navegador', () => {
    const offenders = files(SRC)
      .filter((path) => NATIVE.test(readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
      .map((path) => relative(SRC, path))
    expect(offenders).toEqual([])
  })
})

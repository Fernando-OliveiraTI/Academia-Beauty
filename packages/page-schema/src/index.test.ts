import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  clearRegistryForTests, parsePageDocument, plainTextSchema, registerSection, safeUrlSchema,
} from './index';

const doc = (sections: unknown[]) => ({ schemaVersion: 1, template: { key: 't', version: 1 }, sections });
const section = (over: Record<string, unknown> = {}) => ({
  id: 's1', type: 'test.hero', schemaVersion: 1, content: { title: 'Olá' }, ...over,
});

beforeEach(() => {
  clearRegistryForTests();
  registerSection({ type: 'test.hero', schemaVersion: 1, content: z.object({ title: plainTextSchema(80) }) });
});

describe('parsePageDocument', () => {
  it('aceita documento válido', () => {
    expect(parsePageDocument(doc([section()])).ok).toBe(true);
  });
  it('rejeita seção fora do registry', () => {
    const r = parsePageDocument(doc([section({ type: 'x.script' })]));
    expect(r.ok).toBe(false);
  });
  it('rejeita ids duplicados', () => {
    expect(parsePageDocument(doc([section(), section()])).ok).toBe(false);
  });
  it('rejeita marcação HTML no texto', () => {
    expect(parsePageDocument(doc([section({ content: { title: '<script>alert(1)</script>' } })])).ok).toBe(false);
  });
  it('rejeita versão de schema mais nova que a suportada', () => {
    expect(parsePageDocument(doc([section({ schemaVersion: 2 })])).ok).toBe(false);
  });
  it('migra conteúdo de versão antiga', () => {
    clearRegistryForTests();
    registerSection({
      type: 'test.hero', schemaVersion: 2, content: z.object({ title: z.string() }),
      migrations: { 1: (c) => ({ title: (c as { heading: string }).heading }) },
    });
    const r = parsePageDocument(doc([section({ content: { heading: 'Antigo' } })]));
    expect(r.ok && r.document.sections[0]?.content).toEqual({ title: 'Antigo' });
  });
  it('falha sem migração disponível', () => {
    clearRegistryForTests();
    registerSection({ type: 'test.hero', schemaVersion: 2, content: z.object({}) });
    expect(parsePageDocument(doc([section()])).ok).toBe(false);
  });
});

describe('safeUrlSchema', () => {
  it.each(['https://exemplo.com/a', '/profissionais/lukas', '#cursos', 'mailto:a@b.com'])('aceita %s', (u) => {
    expect(safeUrlSchema.safeParse(u).success).toBe(true);
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', 'http://inseguro.com', '//evil.com', 'JaVaScRiPt:1'])('rejeita %s', (u) => {
    expect(safeUrlSchema.safeParse(u).success).toBe(false);
  });
});

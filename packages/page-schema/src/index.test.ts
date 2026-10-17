import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  clearRegistryForTests, isSafeMediaPath, mediaIdOf, parsePageDocument, plainTextSchema, registerSection, safeUrlSchema, setMediaHosts,
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

describe('isSafeMediaPath', () => {
  const id = 'a'.repeat(32);
  afterEach(() => setMediaHosts(null));
  it.each(['/site/home/foto.png', `/media/${id}`, `/media/${id}?w=640`])('aceita %s', (u) => {
    expect(isSafeMediaPath(u)).toBe(true);
  });
  it.each(['/admin/x', '/outro/foto.png', '//evil.com/a.png', '/site/../admin', '/media/curto', `/media/${id}/x`, `/media/${'g'.repeat(32)}`,
    'javascript:alert(1)', 'data:image/png;base64,AAAA', 'http://cdn.exemplo.com/a.png', 'https://cdn.exemplo.com/a.png', '/\\evil.com', '/site/a b.png'])('rejeita %s', (u) => {
    expect(isSafeMediaPath(u)).toBe(false);
  });
  it('aceita https só dos hosts de CDN configurados', () => {
    setMediaHosts(['cdn.exemplo.com']);
    expect(isSafeMediaPath('https://cdn.exemplo.com/a/b.webp')).toBe(true);
    expect(isSafeMediaPath('https://CDN.exemplo.com/a.webp')).toBe(true);
    expect(isSafeMediaPath('https://outro.exemplo.com/a.webp')).toBe(false);
    expect(isSafeMediaPath('https://cdn.exemplo.com.evil.com/a.webp')).toBe(false);
    expect(isSafeMediaPath('https://user:pw@cdn.exemplo.com/a.webp')).toBe(false);
    expect(isSafeMediaPath('http://cdn.exemplo.com/a.webp')).toBe(false);
  });
  it('mediaIdOf extrai o id', () => {
    expect(mediaIdOf(`/media/${id}?w=320`)).toBe(id);
    expect(mediaIdOf('/site/a.png')).toBeNull();
  });
});

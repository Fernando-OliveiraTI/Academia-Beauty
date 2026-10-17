import { describe, expect, it } from 'vitest';
import { loginInputSchema, permissionsForRoles } from './index';

describe('permissionsForRoles', () => {
  it('viewer não escreve nem publica', () => {
    const p = permissionsForRoles(['viewer']);
    expect(p).toContain('pages.read');
    expect(p).not.toContain('pages.write');
    expect(p).not.toContain('pages.publish');
  });
  it('editor não gerencia usuários nem comércio', () => {
    const p = permissionsForRoles(['editor']);
    expect(p).not.toContain('users.manage');
    expect(p).not.toContain('commerce.manage');
  });
  it('admin possui todas as permissões', () => {
    expect(permissionsForRoles(['admin']).length).toBeGreaterThan(permissionsForRoles(['editor']).length);
  });
});

describe('loginInputSchema', () => {
  it('normaliza e-mail', () => {
    expect(loginInputSchema.parse({ email: '  Admin@Exemplo.COM ', password: 'x' }).email).toBe('admin@exemplo.com');
  });
  it('rejeita e-mail inválido', () => {
    expect(loginInputSchema.safeParse({ email: 'nao-e-email', password: 'x' }).success).toBe(false);
  });
});

import { createProfessionalSchema, professionalDataSchema, publishReadiness, slugify } from './index';

describe('profissional', () => {
  const base = { name: 'Ana Souza', specialty: 'Hair' };
  it('slugify remove acentos e símbolos', () => {
    expect(slugify('Cleber Venâncio')).toBe('cleber-venancio');
    expect(slugify('  Zé  da  Silva!! ')).toBe('ze-da-silva');
  });
  it('rejeita slug reservado e malformado', () => {
    for (const slug of ['admin', 'Com Espaço', '-x-', 'ab']) {
      expect(createProfessionalSchema.safeParse({ slug, data: base }).success).toBe(false);
    }
    expect(createProfessionalSchema.safeParse({ slug: 'ana-souza', data: base }).success).toBe(true);
  });
  it('rejeita marcação e URLs perigosas', () => {
    expect(professionalDataSchema.safeParse({ ...base, name: '<b>x</b>' }).success).toBe(false);
    for (const portraitSrc of ['javascript:alert(1)', 'data:image/png;base64,AA', '//evil.com/x.png', 'http://x.com/a.png']) {
      expect(professionalDataSchema.safeParse({ ...base, portraitSrc }).success).toBe(false);
    }
    expect(professionalDataSchema.safeParse({ ...base, portraitSrc: '/site/a.png' }).success).toBe(true);
  });
  it('mídia só aceita caminho interno (nada de https externo) e links recusam barra invertida/espaço', () => {
    for (const portraitSrc of ['https://cdn.exemplo.com/a.png', '/\\evil.com/a.png', '/ a.png', '/\ta.png']) {
      expect(professionalDataSchema.safeParse({ ...base, portraitSrc }).success, JSON.stringify(portraitSrc)).toBe(false);
    }
    for (const instagramUrl of ['/\\evil.com', '/\t/evil.com', 'https://instagram.com/ a']) {
      expect(professionalDataSchema.safeParse({ ...base, instagramUrl }).success, JSON.stringify(instagramUrl)).toBe(false);
    }
    expect(professionalDataSchema.safeParse({ ...base, instagramUrl: 'https://instagram.com/ana' }).success).toBe(true);
    expect(professionalDataSchema.safeParse({ ...base, works: [{ imageSrc: 'https://x.com/a.png', alt: 'a', title: 't', tags: [] }] }).success).toBe(false);
  });
  it('publishReadiness lista o que falta e aceita dados completos', () => {
    const empty = professionalDataSchema.parse(base);
    expect(publishReadiness(empty).map((i) => i.field)).toEqual(
      expect.arrayContaining(['tagline', 'experienceYears', 'portraitSrc', 'cardPhotoSrc', 'bio', 'instagramUrl'])
    );
    const full = professionalDataSchema.parse({
      ...base, tagline: 'x', experienceYears: 3, portraitSrc: '/site/a.png', cardPhotoSrc: '/site/b.png',
      bio: ['texto'], instagramHandle: '@ana', instagramUrl: 'https://instagram.com/ana',
    });
    expect(publishReadiness(full)).toEqual([]);
  });
});

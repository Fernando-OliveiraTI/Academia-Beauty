export const VIEWPORTS = [
  { name: 'w1440', width: 1440, height: 900 },
  { name: 'w1024', width: 1024, height: 768 },
  { name: 'w900', width: 900, height: 800 },
  { name: 'w768', width: 768, height: 1024 },
  { name: 'w620', width: 620, height: 900 },
  { name: 'w390', width: 390, height: 844 },
] as const;

export const PAGES = [
  { id: 'home', file: 'site/Home.html' },
  { id: 'profissional', file: 'site/Lukas_20.html' },
  { id: 'curso', file: 'curso/index.html' },
] as const;

/** Rotas do app web que reproduzem cada referência (precisa de `next start` em 3100). */
export const TARGETS: Record<(typeof PAGES)[number]['id'], string> = {
  home: '/preview/home',
  profissional: '/preview/profissional',
  curso: '/preview/curso',
};

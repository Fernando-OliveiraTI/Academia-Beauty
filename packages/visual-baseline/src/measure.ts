import type { Page } from 'playwright-core';

/** PRNG fixo: as páginas usam Math.random() para partículas dos efeitos. */
export const SEED_SCRIPT = `(() => {
  let s = 0x9e3779b9;
  Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
})();`;

/** Percorre a página para disparar os reveals de rolagem (IntersectionObserver) e volta ao topo. */
export async function settlePage(tab: Page, viewportHeight: number): Promise<void> {
  await tab.waitForTimeout(1500);
  const height = await tab.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += Math.max(200, viewportHeight / 2)) {
    await tab.evaluate((top) => window.scrollTo(0, top), y);
    await tab.waitForTimeout(120);
  }
  await tab.waitForTimeout(1200);
  await tab.evaluate(() => window.scrollTo(0, 0));
  await tab.waitForTimeout(600);
}

export type SectionMetric = { tag: string; id?: string; cls?: string; top: number; height: number; width: number };
export type PageMetrics = {
  scrollHeight: number;
  scrollWidth: number;
  horizontalOverflow: boolean;
  activeAnimations: number;
  canvases: number;
  fonts: string[];
  sections: SectionMetric[];
};

export function collectMetrics(tab: Page): Promise<PageMetrics> {
  return tab.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('header, nav, main > *, section, footer'))
      .filter((el) => (el as HTMLElement).offsetHeight > 0)
      .slice(0, 80)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          cls: (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 4).join(' ') || undefined,
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
          width: Math.round(r.width),
        };
      });
    const fonts = Array.from(document.fonts).map((f) => `${f.family} ${f.weight} ${f.status}`);
    return {
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      activeAnimations: document.getAnimations().length,
      canvases: document.querySelectorAll('canvas').length,
      fonts,
      sections,
    };
  });
}

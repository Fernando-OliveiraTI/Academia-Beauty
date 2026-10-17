/**
 * Compara a página migrada (app web) com o baseline congelado da referência.
 *   pnpm compare curso [--origin http://127.0.0.1:3100] [--real-fonts] [--mask ".sel1,.sel2"]
 * Por padrão bloqueia /fonts/* para renderizar com a mesma fonte de reserva do baseline
 * (o baseline foi capturado sem o Google Fonts). Com --real-fonts usa a Geist hospedada.
 */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { PAGES, TARGETS, VIEWPORTS } from './pages.js';
import { serveReferences } from './server.js';
import { SEED_SCRIPT, collectMetrics, settlePage, type PageMetrics } from './measure.js';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const requested = args.find((a) => !a.startsWith('--'));
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const page = PAGES.find((p) => p.id === requested);
if (!page) {
  console.error('Uso: pnpm compare <home|profissional|curso> [--origin url] [--real-fonts] [--mask seletores] [--hide seletores] [--baseline-mode] [--max-diff 0.02]');
  process.exit(2);
}
const pageId = page.id;
const origin = flag('--origin') ?? 'http://127.0.0.1:3100';
const realFonts = args.includes('--real-fonts');
const maskSelectors = flag('--mask');
/** Oculta camadas de efeito (CSS injetado) nos DOIS lados e compara contra a referência capturada ao vivo. */
const hideSelectors = flag('--hide');
/** Liga `html[data-baseline]` na página migrada: desliga as correções aprovadas e prova que o restante é fiel. */
const baselineMode = args.includes('--baseline-mode');
const outDir = join(pkgRoot, 'output', 'compare', pageId + (realFonts ? '-realfonts' : '') + (hideSelectors ? '-nofx' : '') + (baselineMode ? '-baseline' : ''));
const referencesRoot = resolve(pkgRoot, '../../references');

/** Limite opcional de pixels diferentes (fração 0–1 da área comparada). Sem a opção, só o layout reprova (comportamento histórico). */
const maxDiffRaw = flag('--max-diff');
const MAX_DIFF = maxDiffRaw === undefined ? null : Number(maxDiffRaw);
if (MAX_DIFF !== null && !(MAX_DIFF >= 0 && MAX_DIFF <= 1)) {
  console.error('--max-diff deve ser um número entre 0 e 1 (ex.: 0.02 = 2%)');
  process.exit(2);
}

const LAYOUT_TOLERANCE_PX = 2;

type Baseline = PageMetrics & { viewport: { name: string; width: number; height: number } };

async function pngSize(buf: Buffer) {
  const p = PNG.sync.read(buf);
  return { w: p.width, h: p.height, png: p };
}

type Shot = { png: Buffer; metrics: PageMetrics; blocked: string[]; pageErrors: string[]; consoleErrors: string[]; maskRects: { x: number; y: number; w: number; h: number }[] };

async function shoot(browser: Awaited<ReturnType<typeof chromium.launch>>, url: string, ownOrigin: string, vp: (typeof VIEWPORTS)[number], blockFonts: boolean): Promise<Shot> {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await context.addInitScript(SEED_SCRIPT);
  if (baselineMode && ownOrigin === origin) await context.addInitScript("(() => { const set = () => document.documentElement?.setAttribute('data-baseline', '1'); set(); document.addEventListener('readystatechange', set); document.addEventListener('DOMContentLoaded', set); })()");
  const tab = await context.newPage();
  const blocked = new Set<string>();
  await tab.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== ownOrigin) {
      if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
      blocked.add(u.host);
      return route.abort();
    }
    if (blockFonts && u.pathname.startsWith('/fonts/')) return route.abort();
    return route.continue();
  });
  const pageErrors: string[] = [];
  tab.on('pageerror', (e) => pageErrors.push(e.message));
  const consoleErrors: string[] = [];
  tab.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await tab.goto(url, { waitUntil: 'load' });
  // Estilo inline !important vence qualquer regra escopada do template (um addStyleTag perderia em especificidade).
  const hide = () => hideSelectors && tab.evaluate((sel) => document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).style.setProperty('display', 'none', 'important')), hideSelectors);
  await hide();
  await settlePage(tab, vp.height);
  await hide();
  const png = await tab.screenshot({ fullPage: true });
  const maskRects = maskSelectors
    ? await tab.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
      }), maskSelectors)
    : [];
  const metrics = await collectMetrics(tab);
  await context.close();
  return { png, metrics, blocked: [...blocked].sort(), pageErrors, consoleErrors, maskRects };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const ref = hideSelectors ? await serveReferences(referencesRoot) : null; // referência ao vivo quando há --hide
  const report: Record<string, unknown> = {};
  let failures = 0;

  try {
    for (const vp of VIEWPORTS) {
      const mig = await shoot(browser, `${origin}${TARGETS[pageId]}`, origin, vp, !realFonts);
      await writeFile(join(outDir, `${vp.name}.png`), mig.png);
      await writeFile(join(outDir, `${vp.name}.metrics.json`), JSON.stringify(mig.metrics, null, 2));

      let base: { png: Buffer; metrics: PageMetrics };
      if (ref) {
        const live = await shoot(browser, `${ref.origin}/${page!.file}`, ref.origin, vp, false);
        await writeFile(join(outDir, `${vp.name}.reference.png`), live.png);
        await writeFile(join(outDir, `${vp.name}.reference.metrics.json`), JSON.stringify(live.metrics, null, 2));
        base = live;
      } else {
        const baseDir = join(pkgRoot, 'baseline', pageId);
        const json: Baseline = JSON.parse(await readFile(join(baseDir, `${vp.name}.json`), 'utf8'));
        base = { png: await readFile(join(baseDir, `${vp.name}.png`)), metrics: json };
      }
      const metrics = mig.metrics;

      // Layout: seção a seção (mesma ordem), tolerância em px.
      const layoutIssues: string[] = [];
      if (Math.abs(metrics.scrollHeight - base.metrics.scrollHeight) > LAYOUT_TOLERANCE_PX) {
        layoutIssues.push(`scrollHeight ${metrics.scrollHeight} (referência ${base.metrics.scrollHeight})`);
      }
      if (metrics.horizontalOverflow) layoutIssues.push('overflow horizontal');
      if (metrics.sections.length !== base.metrics.sections.length) {
        layoutIssues.push(`seções: ${metrics.sections.length} (referência ${base.metrics.sections.length})`);
      }
      base.metrics.sections.forEach((b, i) => {
        const m = metrics.sections[i];
        if (!m) return;
        for (const k of ['top', 'height', 'width'] as const) {
          if (Math.abs(m[k] - b[k]) > LAYOUT_TOLERANCE_PX) layoutIssues.push(`${b.id ?? b.tag}#${i}.${k}: ${m[k]} (referência ${b[k]})`);
        }
      });

      // Pixels: região comum às duas imagens; áreas mascaradas são pintadas nas duas antes do diff.
      const a = await pngSize(base.png);
      const b = await pngSize(mig.png);
      const w = Math.min(a.w, b.w);
      const h = Math.min(a.h, b.h);
      const crop = (p: PNG) => {
        const out = new PNG({ width: w, height: h });
        PNG.bitblt(p, out, 0, 0, w, h, 0, 0);
        return out;
      };
      const ca = crop(a.png);
      const cb = crop(b.png);
      let maskedArea = 0;
      for (const m of mig.maskRects) {
        for (let y = Math.max(0, m.y); y < Math.min(h, m.y + m.h); y++) {
          for (let x = Math.max(0, m.x); x < Math.min(w, m.x + m.w); x++) {
            const i = (y * w + x) * 4;
            for (const img of [ca, cb]) { img.data[i] = 255; img.data[i + 1] = 0; img.data[i + 2] = 255; img.data[i + 3] = 255; }
            maskedArea++;
          }
        }
      }
      const diff = new PNG({ width: w, height: h });
      const diffPixels = pixelmatch(ca.data, cb.data, diff.data, w, h, { threshold: 0.1 });
      await writeFile(join(outDir, `${vp.name}.diff.png`), PNG.sync.write(diff));
      const ratio = diffPixels / (w * h);

      const overDiff = MAX_DIFF !== null && ratio > MAX_DIFF;
      if (layoutIssues.length || overDiff) failures++;
      report[vp.name] = {
        size: { referencia: `${a.w}x${a.h}`, migrada: `${b.w}x${b.h}` },
        diffPixels,
        diffRatio: Number(ratio.toFixed(5)),
        maskedAreaPct: Number(((maskedArea / (w * h)) * 100).toFixed(1)),
        layoutIssues,
        blockedHosts: mig.blocked,
        pageErrors: mig.pageErrors,
        consoleErrors: mig.consoleErrors,
      };
      console.log(`${vp.name}: diff ${(ratio * 100).toFixed(3)}%${overDiff ? ` (acima do limite ${(MAX_DIFF! * 100).toFixed(2)}%)` : ''} · layout ${layoutIssues.length ? layoutIssues.length + ' diferença(s)' : 'ok'} · erros ${mig.pageErrors.length + mig.consoleErrors.length}`);
    }
  } finally {
    await browser.close();
    ref?.server.close();
  }
  await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Relatório: ${join(outDir, 'report.json')}`);
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

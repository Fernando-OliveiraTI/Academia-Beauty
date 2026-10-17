import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, VIEWPORTS } from './pages.js';
import { SEED_SCRIPT, collectMetrics, settlePage } from './measure.js';
import { serveReferences } from './server.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const referencesRoot = resolve(pkgRoot, '../../references');
const update = process.argv.includes('--update');
const outRoot = join(pkgRoot, update ? 'baseline' : 'output');

async function main() {
  const { server, origin } = await serveReferences(referencesRoot);
  const browser = await chromium.launch({ channel: 'chrome' });
  const summary: Record<string, unknown> = { origin: 'local', generatedAt: new Date().toISOString(), pages: {} };

  try {
    for (const page of PAGES) {
      const pageSummary: Record<string, unknown> = {};
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
          reducedMotion: 'no-preference',
        });
        await context.addInitScript(SEED_SCRIPT);
        const tab = await context.newPage();
        const blocked = new Set<string>();
        // Rede externa bloqueada para resultado determinístico; as URLs bloqueadas ficam registradas.
        await tab.route('**/*', (route) => {
          const url = route.request().url();
          if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
          blocked.add(new URL(url).host);
          return route.abort();
        });
        const consoleErrors: string[] = [];
        tab.on('pageerror', (e) => consoleErrors.push(e.message));

        await tab.goto(`${origin}/${page.file}`, { waitUntil: 'load' });
        await settlePage(tab, vp.height);

        const dir = join(outRoot, page.id);
        await mkdir(dir, { recursive: true });
        await tab.screenshot({ path: join(dir, `${vp.name}.png`), fullPage: true });

        const metrics = await collectMetrics(tab);

        await writeFile(
          join(dir, `${vp.name}.json`),
          JSON.stringify({ viewport: vp, blockedHosts: [...blocked].sort(), pageErrors: consoleErrors, ...metrics }, null, 2),
        );
        pageSummary[vp.name] = {
          scrollHeight: metrics.scrollHeight,
          horizontalOverflow: metrics.horizontalOverflow,
          blockedHosts: [...blocked].sort(),
          pageErrors: consoleErrors.length,
        };
        await context.close();
        console.log(`✓ ${page.id} @ ${vp.name}`);
      }
      (summary.pages as Record<string, unknown>)[page.id] = pageSummary;
    }
  } finally {
    await browser.close();
    server.close();
  }
  await writeFile(join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Concluído → ${outRoot}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

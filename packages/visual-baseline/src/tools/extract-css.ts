/**
 * Extrai o CSS efetivo de uma referência (as páginas têm dezenas de patches empilhados com !important).
 *   pnpm extract-css <home|profissional|curso> --scope pg-pro --kf pro --out ../page-renderer/src/professional/professional.css
 *
 * O que faz (a cascata original é preservada, nada é "reescrito à mão"):
 *  1. carrega a página real no Chrome e lê o CSSOM (blocos <style>, na ordem);
 *  2. descarta regras sem nenhum elemento alvo (antes e depois do scroll, ignorando :hover/::before etc.);
 *  3. descarta declarações que nunca vencem: mesma propriedade, mesmo seletor e mesmo @media, sobrescrita por regra posterior;
 *  4. prefixa os seletores com `.<scope>` (html/body/:root viram o wrapper) e renomeia @keyframes com `<kf>-`;
 *  5. descarta @keyframes não referenciados e ignora @font-face/@import (fontes são hospedadas pelo app).
 */
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../pages.js';
import { SEED_SCRIPT } from '../measure.js';
import { serveReferences } from '../server.js';

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const page = PAGES.find((p) => p.id === args[0]);
const scope = flag('--scope');
const kf = flag('--kf');
const out = flag('--out');
if (!page || !scope || !kf || !out) {
  console.error('Uso: extract-css <home|profissional|curso> --scope <classe> --kf <prefixo> --out <arquivo>');
  process.exit(2);
}

type Decl = { prop: string; value: string; important: boolean };
type RawRule = { kind: 'style'; media: string[]; selector: string; decls: Decl[]; alive: boolean };
type RawKeyframes = { kind: 'keyframes'; media: string[]; name: string; text: string };
type Raw = RawRule | RawKeyframes;

const here = dirname(fileURLToPath(import.meta.url));
const { server, origin } = await serveReferences(resolve(here, '../../../../references'));
const browser = await chromium.launch({ channel: 'chrome' });

async function collect(width: number, height: number): Promise<Raw[]> {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(SEED_SCRIPT);
  await ctx.addInitScript('window.__name = (f) => f;'); // tsx/esbuild injeta __name nas funções do evaluate
  const tab = await ctx.newPage();
  await tab.route('**/*', (r) => (r.request().url().startsWith(origin) || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  await tab.goto(`${origin}/${page!.file}`, { waitUntil: 'load' });
  await tab.waitForTimeout(1500);

  // Marca os elementos alvo antes e depois de percorrer a página (classes de estado, reveals, conteúdo gerado por JS).
  const probe = () => tab.evaluate(() => {
    const dynamic = /::?(before|after|marker|placeholder|selection|first-line|first-letter|backdrop|-webkit-[\w-]+|-moz-[\w-]+)|:(hover|focus|focus-visible|focus-within|active|visited|link|target|any-link|fullscreen|autofill)\b/g;
    const alive = new Map<string, boolean>();
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          const sel = rule.selectorText;
          if (alive.get(sel)) continue;
          const stripped = sel.split(',').map((s) => s.replace(dynamic, '').trim()).filter(Boolean);
          let hit = false;
          for (const s of stripped) {
            try { if (document.querySelector(s.replace(/[>+~]\s*$/, '').trim() || '*')) { hit = true; break; } } catch { hit = true; break; }
          }
          alive.set(sel, hit || stripped.length === 0);
        } else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) { try { walk(sheet.cssRules); } catch { /* folha externa */ } }
    return Array.from(alive.entries());
  });
  const before = new Map(await probe());
  const h = await tab.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += Math.max(200, height / 2)) { await tab.evaluate((t) => window.scrollTo(0, t), y); await tab.waitForTimeout(100); }
  await tab.waitForTimeout(1200);
  const after = new Map(await probe());
  await tab.evaluate(() => window.scrollTo(0, 0));
  await tab.hover('body').catch(() => undefined);
  const aliveSel = new Map<string, boolean>([...before.keys(), ...after.keys()].map((k) => [k, !!(before.get(k) || after.get(k))]));

  const raw = await tab.evaluate((aliveEntries) => {
    const alive = new Map(aliveEntries as [string, boolean][]);
    const res: unknown[] = [];
    const splitDecls = (css: string) => {
      const parts: string[] = []; let depth = 0; let q = ''; let cur = '';
      for (const ch of css) {
        if (q) { cur += ch; if (ch === q) q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        if (ch === '(') depth++; if (ch === ')') depth--;
        if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
      }
      if (cur.trim()) parts.push(cur);
      return parts.map((p) => p.trim()).filter(Boolean);
    };
    const walk = (rules: CSSRuleList, media: string[]) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          const decls = splitDecls(rule.style.cssText).map((d) => {
            const i = d.indexOf(':');
            const prop = d.slice(0, i).trim();
            let value = d.slice(i + 1).trim();
            const important = /\s*!important$/.test(value);
            if (important) value = value.replace(/\s*!important$/, '');
            return { prop, value, important };
          });
          res.push({ kind: 'style', media, selector: rule.selectorText, decls, alive: !!alive.get(rule.selectorText) });
        } else if (rule instanceof CSSKeyframesRule) {
          res.push({ kind: 'keyframes', media, name: rule.name, text: Array.from(rule.cssRules).map((r) => r.cssText).join('\n  ') });
        } else if (rule instanceof CSSMediaRule) {
          walk(rule.cssRules, [...media, `@media ${rule.conditionText}`]);
        } else if (rule instanceof CSSSupportsRule) {
          walk(rule.cssRules, [...media, `@supports ${rule.conditionText}`]);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) { try { walk(sheet.cssRules, []); } catch { /* externa */ } }
    return res;
  }, [...aliveSel.entries()]);
  await ctx.close();
  return raw as Raw[];
}

const rules = await collect(1440, 900);
// Uma segunda passada em largura de celular garante o alvo de regras que só existem em outro layout.
const mobile = await collect(390, 844);
await browser.close();
server.close();

const aliveBySel = new Map<string, boolean>();
for (const r of [...rules, ...mobile]) if (r.kind === 'style') aliveBySel.set(r.selector, (aliveBySel.get(r.selector) ?? false) || r.alive);

// 3. poda de declarações que nunca vencem (mesmo seletor + mesmo @media)
const live = rules.filter((r): r is RawRule => r.kind === 'style' && !!aliveBySel.get(r.selector));
const winners = new Map<string, { rule: RawRule; decl: Decl }>();
const dropped = new Set<Decl>();
for (const rule of live) {
  for (const decl of rule.decls) {
    const key = `${rule.media.join('|')}§${rule.selector}§${decl.prop}`;
    const prev = winners.get(key);
    if (prev) {
      if (prev.decl.important && !decl.important) { dropped.add(decl); continue; }
      dropped.add(prev.decl);
    }
    winners.set(key, { rule, decl });
  }
}

// 4/5. emissão
const SCOPE = `.${scope}`;
const scopeSel = (sel: string) => sel.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
  // :root e html viram o próprio <html> da página (variáveis lidas pela regra do html, ex.: font-size com calc(var())); body vira o wrapper.
  if (s === ':root' || s === 'html') return `html:has(${SCOPE})`;
  if (s === 'body') return SCOPE;
  if (/^(html|body)\s*[>\s]/.test(s)) return s.replace(/^(html\s+)?body/, SCOPE).replace(/^html\s+/, `html:has(${SCOPE}) `);
  if (/^:root\b/.test(s)) return s.replace(/^:root/, `html:has(${SCOPE})`);
  return `${SCOPE} ${s}`;
}).join(',\n');

const kfNames = new Set(rules.filter((r): r is RawKeyframes => r.kind === 'keyframes').map((r) => r.name));
const renameKf = (v: string) => [...kfNames].reduce((acc, n) => acc.replace(new RegExp(`(^|[\\s,])${n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=[\\s,;]|$)`, 'g'), `$1${kf}-${n}`), v);

const mediaOpen = (m: string[]) => m.map((x) => `${x} {`).join('\n');
const mediaClose = (m: string[]) => m.map(() => '}').join('\n');
let css = `/* Gerado por visual-baseline/src/tools/extract-css.ts a partir de references/${page.file}. Cascata original preservada. */\n`;
const usedText: string[] = [];
let kept = 0;
for (const rule of live) {
  const decls = rule.decls.filter((d) => !dropped.has(d));
  if (!decls.length) continue;
  const body = decls.map((d) => {
    let value = /^(animation(-name)?)$/.test(d.prop) ? renameKf(d.value) : d.value;
    // O wrapper substitui <body>; `clip` corta o transbordo horizontal sem virar contêiner de rolagem (preserva position:sticky).
    if (d.prop === 'overflow-x' && d.value === 'hidden' && scopeSel(rule.selector) === SCOPE) value = 'clip';
    return `  ${d.prop}: ${value}${d.important ? ' !important' : ''};`;
  }).join('\n');
  usedText.push(body);
  css += `${mediaOpen(rule.media)}\n${scopeSel(rule.selector)} {\n${body}\n}\n${mediaClose(rule.media)}\n`;
  kept++;
}
const usedKf = [...kfNames].filter((n) => usedText.some((t) => new RegExp(`${kf}-${n}\\b`).test(t)));
const seenKf = new Set<string>();
for (const r of rules) {
  if (r.kind !== 'keyframes' || !usedKf.includes(r.name) || seenKf.has(r.name)) continue;
  seenKf.add(r.name);
  css += `${mediaOpen(r.media)}\n@keyframes ${kf}-${r.name} {\n  ${r.text}\n}\n${mediaClose(r.media)}\n`;
}
css = css.replace(/\n{2,}/g, '\n');
await writeFile(resolve(out), css);

const styleRules = rules.filter((r) => r.kind === 'style').length;
console.log(`${page.id}: ${styleRules} regras no original → ${kept} mantidas · ${dropped.size} declarações sobrescritas removidas · ${usedKf.length}/${kfNames.size} keyframes · ${css.length} bytes`);

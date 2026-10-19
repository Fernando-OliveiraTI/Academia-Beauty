import { HomeHeroFx } from './HeroFx';
import { ProfessionalsSlider } from './Slider';
import type { RenderContext } from '../offer';
import type {
  BenefitsContent, BrandsContent, CoursesContent, CtaContent, FooterContent, HeroContent, NavContent, ProfessionalsContent,
} from './schemas';
import { mediaSrc } from '../media';

type Props<C> = { content: C; ctx: RenderContext; idSuffix?: string };

const ARROW = '↗';

export function Nav({ content: c }: Props<NavContent>) {
  return (
    <nav className="cb-nav" aria-label={c.ariaLabel}>
      <a className="cb-brand" href={c.brandHref}>{c.brandLead} <span>{c.brandAccent}</span></a>
      <div className="cb-navlinks">
        {c.links.map((l, ix) => <a key={`${ix}-${l.label}`} href={l.href}>{l.label}</a>)}
        <a className="cb-account" href={c.account.href}>{c.account.label} {ARROW}</a>
      </div>
    </nav>
  );
}

export function Hero({ content: c }: Props<HeroContent>) {
  return (
    <section className="cb-hero cb-grid-bg">
      <HomeHeroFx />
      {/* Camadas que os patches do original escondem (display:none); mantidas para o CSS extraído continuar válido. */}
      <div className="cb-noise" /><div className="cb-orb a" /><div className="cb-orb b" />
      <div className="cb-lettering">BEAUTY</div>
      <div className="cb-container cb-hero-grid">
        <div>
          <div className="cb-kicker cb-reveal cb-in"><i /> {c.kicker}</div>
          <h1 className="cb-reveal cb-delay-1 cb-in">{c.titleLead}<span className="outline">{c.titleOutline}</span></h1>
          <div className="cb-reveal cb-delay-2 cb-in cb-original-copy">
            {c.copy.map((p, ix) => <p key={`${ix}-${p.text}`}>{p.highlight ? <span className="cb-hero-texto-dourado">{p.text}</span> : p.text}</p>)}
          </div>
          <div className="cb-actions cb-reveal cb-delay-3 cb-in">
            <a href={c.cta.href} className="cb-btn primary">{c.cta.label} <b>{ARROW}</b></a>
          </div>
          <div className="cb-mini-proof cb-reveal cb-delay-4 cb-in"><span className="line" /><span>{c.miniProof}</span></div>
        </div>
        <div className="cb-visual cb-reveal cb-delay-2 cb-in">
          <span className="cb-cross c1" /><span className="cb-cross c2" />
          <div className="cb-portrait-stage"><img src={mediaSrc(c.image.src, 960)} alt={c.image.alt} /><div className="cb-scanline" /></div>
        </div>
      </div>
    </section>
  );
}

export function Professionals({ content: c }: Props<ProfessionalsContent>) {
  if (!c.items.length) return null;
  return (
    <section id="profissionais" className="professores cb-dobra2-dc32">
      <div className="cb-marquee"><span>{c.marquee}</span></div>
      <div className="professores-container">
        <h2 className="titulo-profissionais">{c.titleLead} <span className="tp-interno">{c.titleInner}</span> {c.titleTail}</h2>
        <ProfessionalsSlider items={c.items} prevLabel={c.prevLabel} nextLabel={c.nextLabel} cardLabel={c.cardLabel} />
      </div>
    </section>
  );
}

const DELAY = ['', ' cb-delay-1', ' cb-delay-2'];
/** No original, só os dois primeiros cursos já vêm revelados (estão acima da dobra). */
const ABOVE_THE_FOLD = 2;

export function Courses({ content: c }: Props<CoursesContent>) {
  return (
    <section className="cb-section white cb-grid-bg" id="cursos-home">
      <div className="cb-orb a" style={{ top: '28%', right: '-12%' }} />
      <div className="cb-container">
        <div className="cb-section-head cb-course-head-fixed">
          <div className="cb-course-heading-wrap">
            <div className="cb-reveal cb-in">
              <div className="cb-eyebrow">{c.eyebrow}</div>
              <h2>{c.titleLead} <span style={{ color: 'var(--cb-gold-deep)' }}>{c.titleAccent}</span></h2>
            </div>
            <p className="cb-section-copy cb-reveal cb-delay-1 cb-in cb-course-intro-copy">{c.intro}</p>
          </div>
        </div>
        <div className="cb-courses">
          {c.items.map((it, i) => (
            <article className={`cb-course cb-reveal${DELAY[i] ?? ''}${i < ABOVE_THE_FOLD ? ' cb-in' : ''}`} key={`${i}-${it.href}`}>
              <img className="cb-course-bg" src={mediaSrc(it.image.src, 640)} alt={it.image.alt} loading="lazy" />
              <div className="cb-course-content">
                <div className="cb-course-meta">
                  {it.tags.map((t, ix) => <span key={`${ix}-${t.label}`} className={t.gold ? 'cb-tag gold' : 'cb-tag'}>{t.label}</span>)}
                </div>
                <div className="cb-course-copy"><div className="cb-course-person">{it.person}</div><div className="cb-course-title">{it.title}</div></div>
              </div>
              <a className="cb-plus" href={it.href} aria-label={it.plusLabel}>+</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Benefits({ content: c }: Props<BenefitsContent>) {
  return (
    <section className="cb-section dark cb-grid-bg cb-beneficios-layout-final" id="beneficios">
      <div className="cb-container cb-benefit-layout">
        <div className="cb-benefit-sticky cb-reveal">
          <div className="cb-eyebrow">{c.eyebrow}</div>
          <h2>{c.titleLead} <span style={{ color: 'var(--cb-gold)' }}>{c.titleAccent}</span></h2>
          {c.paragraphs.map((p, i) => (
            <p className="cb-section-copy" key={`${i}-${p}`} style={i === 0 ? { marginTop: 24 } : undefined}>{p}</p>
          ))}
        </div>
        <div className="cb-benefit-list">
          {c.items.map((b, i) => (
            <div className={`cb-benefit cb-reveal${DELAY[i] ?? ''}`} key={`${i}-${b.num}`}>
              <span className="cb-benefit-num">{b.num}</span>
              <div><h3>{b.title}</h3><p>{b.text}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Brands({ content: c }: Props<BrandsContent>) {
  return (
    <section className="cb-section white cb-marcas-final" id="marcas">
      <div className="cb-container">
        <div className="cb-section-head">
          <div className="cb-reveal">
            <div className="cb-eyebrow">{c.eyebrow}</div>
            <h2>{c.titleLead} <span style={{ color: 'var(--cb-gold-deep)' }}>{c.titleAccent}</span></h2>
          </div>
          <p className="cb-section-copy cb-reveal cb-delay-1">{c.copy}</p>
        </div>
        <div className="cb-brands-stage cb-reveal">
          {c.logos.map((l, ix) => <div className="cb-brand-cell" key={`${ix}-${l.src}`}><img src={mediaSrc(l.src, 320)} alt={l.alt} loading="lazy" decoding="async" /></div>)}
        </div>
      </div>
    </section>
  );
}

export function Cta({ content: c }: Props<CtaContent>) {
  return (
    <section className="cb-cta">
      <div className="outline-word">{c.outlineWord}</div>
      <div className="cb-container cb-cta-inner">
        <div className="cb-reveal">
          <div className="cb-eyebrow" style={{ color: '#5f522f' }}>{c.eyebrow}</div>
          <h2>{c.title}</h2>
        </div>
        <div className="cb-reveal cb-delay-1">
          <p>{c.text}</p>
          <a href={c.cta.href} className="cb-btn primary">{c.cta.label} <b>{ARROW}</b></a>
        </div>
      </div>
    </section>
  );
}

const SOCIAL_SVG = {
  facebook: <svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.3l.7-4h-4V9c0-.7.3-1 1-1Z" /></svg>,
  instagram: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>,
  youtube: <svg viewBox="0 0 24 24"><path d="M21 8.2a3 3 0 0 0-2.1-2.1C17 5.6 12 5.6 12 5.6s-5 0-6.9.5A3 3 0 0 0 3 8.2 31 31 0 0 0 2.6 12 31 31 0 0 0 3 15.8a3 3 0 0 0 2.1 2.1c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8Z" /><path className="play" d="m10 9 5 3-5 3Z" /></svg>,
  tiktok: <svg viewBox="0 0 24 24"><path d="M15 3c.4 2.2 1.7 3.6 4 4v3c-1.5 0-2.8-.4-4-1.2V15a6 6 0 1 1-6-6h1v3a3 3 0 1 0 2 3V3h3Z" /></svg>,
  x: <svg viewBox="0 0 24 24"><path d="M5 4h4.2l3.4 4.8L16.8 4H19l-5.4 6.2L20 20h-4.2l-3.8-5.4L7.2 20H5l6-6.9L5 4Zm3.1 2 8.8 12h1L9.1 6h-1Z" /></svg>,
};

/** Rodapé com os arcos/feixes de energia (o HTML original os injetava por script). */
export function Footer({ content: c, ctx }: Props<FooterContent>) {
  return (
    <footer className="cb-footer-fx">
      <div className="cb-footer-energy" aria-hidden="true">
        <span className="arc" /><span className="arc arc-2" /><span className="beam" /><span className="scan" />
        <span className="node n1" /><span className="node n2" />
        <div className="cb-fx-extra">
          <span className="arc-extra arc-3" /><span className="arc-extra arc-4" />
          <span className="beam-extra beam-2" /><span className="beam-extra beam-3" />
          <span className="node-extra n3" /><span className="node-extra n4" /><span className="node-extra n5" /><span className="node-extra n6" />
          {[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={`spark s${n}`} />)}
        </div>
      </div>
      <div className="cb-footer-academia-social">
        <div className="cb-footer-brand-academia"><span>{c.brandLead}</span> <strong>{c.brandAccent}</strong></div>
        <div className="cb-footer-social-icons" aria-label={c.socialLabel}>
          {c.socials.map((s, ix) => <a key={`${ix}-${s.label}`} href={s.href} aria-label={s.label}>{SOCIAL_SVG[s.icon]}</a>)}
        </div>
        <div className="cb-footer-copyright">{c.copyright.replace('{year}', String(ctx.year))}</div>
      </div>
    </footer>
  );
}

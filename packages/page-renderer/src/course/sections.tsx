import type { ReactNode } from 'react';
import { Accordion } from './Accordion';
import { CtaLink } from './CtaLink';
import { Checkout } from './Checkout';
import { Icon } from './Icon';
import { StickyCta } from './StickyCta';
import { offerTexts, type RenderContext } from '../offer';
import type {
  BenefitsContent, CheckoutContent, CurriculumContent, DeliverablesContent, FaqContent, FinalCtaContent, FactsContent,
  FooterContent, GuaranteeContent, HeaderContent, HeroContent, InstructorContent, OfferContent, ProofContent,
  StickyCtaContent,
} from './schemas';
import { mediaSrc } from '../media';

type Props<C> = { content: C; ctx: RenderContext; idSuffix?: string };

const Arrow = () => <Icon name="arrow" className="arrow" size={18} />;
const Brand = ({ lead, accent, logo, label, href = '#top' }: { lead: string; accent: string; logo: string; label?: string; href?: string }) => (
  <a className="brand" href={href} aria-label={label}>
    <img src={logo} alt="" width={30} height={30} />
    <div>{lead}<span>{accent}</span></div>
  </a>
);

const CheckItem = ({ title, text }: { title: string; text?: string }) => (
  <li>
    <span className="check"><Icon name="check" /></span>
    <div><strong>{title}</strong>{text && <span>{text}</span>}</div>
  </li>
);

const DEFAULT_SITE_LINKS = [
  { label: 'CURSOS', href: '/#cursos-home' },
  { label: 'PROFISSIONAIS', href: '/#profissionais' },
  { label: 'QUEM SOMOS', href: '/#beneficios' },
];
const DEFAULT_ACCOUNT = { label: 'ACESSAR CONTA', href: '/admin/login' };

export function Header({ content: c, ctx }: Props<HeaderContent>) {
  const account = c.account ?? DEFAULT_ACCOUNT;
  const pro = c.hideBackLink ? undefined : ctx.professional;
  const back = pro ? { href: `/profissionais/${pro.slug}#cursos`, label: `Mais cursos de ${pro.name.split(' ')[0]}` } : null;
  return (
    <>
      <header className="header" id="header">
        <Brand lead={c.brandLead} accent={c.brandAccent} logo={c.logoSrc} label={c.brandLabel} href="/" />
        <nav className="site-nav" aria-label="Menu principal">
          <ul>{(c.siteLinks ?? DEFAULT_SITE_LINKS).map((l, ix) => <li key={`${ix}-${l.href}`}><a href={l.href}>{l.label}</a></li>)}</ul>
          <a className="btn btn--primary btn--sm header-cta" href={account.href}>{account.label} ↗</a>
        </nav>
      </header>
      <nav className="nav side-nav" aria-label={c.navLabel}>
        <ul>
          {c.nav.map((l, ix) => <li key={`${ix}-${l.href}`}><a href={l.href} title={l.label}><i aria-hidden="true" /><span>{l.label}</span></a></li>)}
          {back ? <li className="side-nav-more"><a href={back.href} title={back.label}><i aria-hidden="true" /><span>Mais cursos</span></a></li> : null}
        </ul>
      </nav>
    </>
  );
}

export function Hero({ content: c, ctx }: Props<HeroContent>) {
  const t = offerTexts(ctx.offer);
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-fx" aria-hidden="true"><div className="hero-glow" /></div>

      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="load-in"><span className="eyebrow">{c.eyebrow}</span></div>
          <h1 className="hero-title load-in" id="hero-title">{c.titleLead} <span>{c.titleAccent}</span></h1>
          <p className="lead load-in">{c.lead}</p>

          <div className="hero-by load-in">
            <span className="avatar" aria-hidden="true">{c.byInitials}</span>
            <p>{c.byPrefix} <strong>{c.byName}</strong> {c.bySuffix}</p>
          </div>

          <div className="price-inline load-in">
            {t.showBadge && <span className="badge badge--gold">{t.discountLabel}</span>}
            {t.showOld && <span className="price-old num">de <s>{t.list}</s></span>}
            <strong className="price-now num">{t.total}</strong>
            <span className="price-installments num">{t.installments}</span>
          </div>

          <div className="hero-actions load-in">
            <CtaLink className="btn btn--primary" id="hero-cta">{c.ctaLabel}<Arrow /></CtaLink>
            <a className="btn btn--ghost" href={c.secondary.href}>{c.secondary.label}</a>
          </div>

          <ul className="trust-row load-in">
            {c.trust.map((i, ix) => <li key={`${ix}-${i.label}`}><Icon name={i.icon} />{i.label}</li>)}
          </ul>
        </div>

        <div className="hero-visual load-in--visual">
          <figure className="product-frame">
            <img src={mediaSrc(c.image.src, 960)} alt={c.image.alt} width={800} height={1000} fetchPriority="high" />
            <figcaption className="frame-label">
              <div>
                <span className="caption">{c.frameKicker}</span>
                <strong>{c.frameTitle}</strong>
              </div>
              <span className="badge badge--outline-gold">{c.frameBadge}</span>
            </figcaption>
          </figure>

          {c.huds.map((h, i) => (
            <div key={`${i}-${h.kicker}`} className={`hud hud--${i === 0 ? 'a' : 'b'}`} aria-hidden="true">
              <span className="caption">{h.kicker}</span>
              <strong>{h.accent ? <><em>{h.accent}</em> {h.value}</> : h.value}</strong>
            </div>
          ))}

          {c.toneScale && (
            <div className="tone-scale" aria-label={c.toneScale.ariaLabel}>
              <ol>{c.toneScale.steps.map((s, ix) => <li key={`${ix}-${s}`}>{s}</li>)}</ol>
              <div className="caption"><span>{c.toneScale.from}</span><span>{c.toneScale.to}</span></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function Facts({ content: c }: Props<FactsContent>) {
  return (
    <section aria-label={c.ariaLabel}>
      <div className="container">
        <dl className="facts reveal-group">
          {c.items.map((i, ix) => (
            <div className="fact reveal" key={`${ix}-${i.label}`}>
              <dt className="caption">{i.label}</dt>
              <dd><strong>{i.value}</strong></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Benefits({ content: c, idSuffix: x = '' }: Props<BenefitsContent>) {
  return (
    <section className="section" id={`beneficios${x}`} aria-labelledby={`beneficios-title${x}`}>
      <div className="container">
        <div className="problem">
          <div className="section-head reveal">
            <span className="eyebrow">{c.eyebrow}</span>
            <h2 id={`beneficios-title${x}`}>{c.title}</h2>
          </div>
          {c.quoteEmphasis && <p className="problem-quote reveal">{c.quoteBefore} <em>{c.quoteEmphasis}</em>{c.quoteAfter}</p>}
        </div>

        <div className="benefits reveal-group">
          {c.cards.map((card, ix) => (
            <article className="card card--hover benefit reveal" key={`${ix}-${card.title}`}>
              <span className="icon-tile"><Icon name={card.icon} /></span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Curriculum({ content: c }: Props<CurriculumContent>) {
  return (
    <section className="section section--surface" id="conteudo" aria-labelledby="conteudo-title">
      <div className="container content-layout">
        <div className="section-head reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id="conteudo-title">{c.title}</h2>
          {c.lead && <p className="lead">{c.lead}</p>}
          <CtaLink className="btn btn--primary btn--start">{c.ctaLabel}<Arrow /></CtaLink>
        </div>
        <Accordion items={c.modules} idPrefix="mod" numbered defaultOpen={0} />
      </div>
    </section>
  );
}

export function Deliverables({ content: c }: Props<DeliverablesContent>) {
  return (
    <section className="section" id="entrega" aria-labelledby="entrega-title">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id="entrega-title">{c.title}</h2>
        </div>

        <div className="deliver-grid">
          <div className="card reveal">
            <ul className="check-list">{c.items.map((i, ix) => <CheckItem key={`${ix}-${i.title}`} title={i.title} text={i.text} />)}</ul>
          </div>
          <aside className="card reveal" aria-labelledby="ficha-title">
            <h3 id="ficha-title" className="spec-title">{c.specsTitle}</h3>
            <dl className="spec-list">
              {c.specs.map((s, ix) => <div key={`${ix}-${s.label}`}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function Instructor({ content: c }: Props<InstructorContent>) {
  const photo = c.hidePhoto ? undefined : c.photo;
  return (
    <section className="section section--surface" id="instrutor" aria-labelledby="instrutor-title">
      <div className="container instructor">
        <div className="instructor-portrait reveal">
          {!photo && <span className="monogram" aria-hidden="true">{c.monogram}</span>}
          {photo && <img src={mediaSrc(photo.src, 640)} alt={photo.alt} loading="lazy" />}
          <span className="badge badge--gold">{c.handle}</span>
        </div>
        <div className="instructor-copy reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id="instrutor-title">{c.title}</h2>
          {c.paragraphs.map((p, ix) => <p key={`${ix}-${p}`}>{p}</p>)}
          {c.places.length > 0 && (
            <div className="places" aria-label={c.placesLabel}>
              {c.places.map((p, ix) => <span className="badge" key={`${ix}-${p}`}>{p}</span>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const countFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function Proof({ content: c, idSuffix: x = '' }: Props<ProofContent>) {
  return (
    <section className="section" id={`depoimentos${x}`} aria-labelledby={`prova-title${x}`}>
      <div className="container">
        <div className="section-head section-head--center reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id={`prova-title${x}`}>{c.title}</h2>
        </div>

        {c.stats.length > 0 && <div className="stats reveal-group">
          {c.stats.map((s, ix) => (
            <div className="card stat reveal" key={`${ix}-${s.label}`}>
              <strong className="num" data-count={s.value} data-prefix={s.prefix} data-suffix={s.suffix}>
                {`${s.prefix ?? ''}${countFormat.format(s.value)}${s.suffix ?? ''}`}
              </strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>}

        <div className="testimonials reveal-group">
          {c.testimonials.map((t, ix) => (
            <figure className="card testimonial reveal" key={`${ix}-${t.quote}`}>
              <div className="stars" role="img" aria-label="5 de 5 estrelas">
                {[0, 1, 2, 3, 4].map((i) => <Icon name="star" key={i} />)}
              </div>
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                <span className="avatar icon-tile" aria-hidden="true"><Icon name="user" /></span>
                <div><strong>{t.name}</strong><span>{t.role}</span></div>
              </figcaption>
            </figure>
          ))}
        </div>
        {c.sampleNote && <div className="sample-note"><span className="badge">{c.sampleNote}</span></div>}
      </div>
    </section>
  );
}

export function Offer({ content: c, ctx }: Props<OfferContent>) {
  const t = offerTexts(ctx.offer);
  return (
    <section className="section section--flush-top" id="oferta" aria-labelledby="oferta-title">
      <div className="container offer">
        <div className="section-head reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id="oferta-title">{c.title}</h2>
          <p className="lead">{c.lead}</p>
        </div>
        <div className="card pricing-card reveal">
          <div className="pricing-top">
            <h3>{c.cardTitle}</h3>
            {t.showBadge && <span className="badge badge--gold">{t.discountLabel}</span>}
          </div>
          <div className="pricing-price">
            {t.showOld && <span className="price-old num">de <s>{t.list}</s> por</span>}
            <strong className="price-now num">{t.total}</strong>
            <span className="price-installments num">{t.installments}</span>
          </div>
          <hr />
          <ul className="check-list">{c.perks.map((p, ix) => <CheckItem key={`${ix}-${p}`} title={p} />)}</ul>
          <CtaLink className="btn btn--primary btn--block">{c.ctaLabel}<Arrow /></CtaLink>
          {(ctx.checkout?.mode === 'redirect' || ctx.checkout?.mode === 'embed') && !ctx.checkout.url && (
            <p className="field-error" role="status" style={{ marginTop: 'var(--space-3)' }}>A compra deste curso está temporariamente indisponível.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function Faq({ content: c, idSuffix: x = '' }: Props<FaqContent>) {
  return (
    <section className="section faq section--surface-top" id={`faq${x}`} aria-labelledby={`faq-title${x}`}>
      <div className="container content-layout">
        <div className="section-head reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id={`faq-title${x}`}>{c.title}</h2>
          {c.lead && <p className="lead">{c.lead}</p>}
        </div>
        <Accordion items={c.items} idPrefix={`faq${x}`} />
      </div>
    </section>
  );
}

export function CheckoutSection({ content, ctx }: Props<CheckoutContent>) {
  return <Checkout content={content} offer={ctx.offer} />;
}

export function Guarantee({ content: c }: Props<GuaranteeContent>) {
  return (
    <section className="section" id="garantia" aria-labelledby="garantia-title">
      <div className="container guarantee">
        <div className="guarantee-seal reveal" aria-hidden="true">
          <svg className="ring" viewBox="0 0 200 200">
            <defs><path id="ring-path" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" /></defs>
            <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(227,201,138,.35)" strokeWidth="1" />
            <circle cx="100" cy="100" r="68" fill="none" stroke="rgba(227,201,138,.35)" strokeWidth="1" />
            <text fill="#aaa194" fontFamily="Geist Mono, monospace" fontSize="11" letterSpacing="3.2"><textPath href="#ring-path">{c.ringText}</textPath></text>
          </svg>
          <div><strong>{c.sealValue}</strong><span>{c.sealUnit}</span></div>
        </div>
        <div className="guarantee-copy reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id="garantia-title">{c.title}</h2>
          <p className="lead">{c.lead}</p>
          {c.items.length > 0 && <ul className="security-list">{c.items.map((i, ix) => <li key={`${ix}-${i.label}`}><Icon name={i.icon} />{i.label}</li>)}</ul>}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ content: c, ctx, idSuffix: x = '' }: Props<FinalCtaContent>) {
  const t = offerTexts(ctx.offer);
  return (
    <section className="section section--flush-top" aria-labelledby={`final-title${x}`}>
      <div className="container">
        <div className="final-cta reveal">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 id={`final-title${x}`}>{c.titleLead} <span>{c.titleAccent}</span></h2>
          <p className="lead">{c.leadBefore} <strong className="num" style={{ color: 'var(--color-text)' }}>{t.total}</strong>{c.leadAfter}</p>
          <CtaLink className="btn btn--primary">{c.ctaLabel}<Arrow /></CtaLink>
        </div>
      </div>
    </section>
  );
}

export function Footer({ content: c, ctx }: Props<FooterContent>): ReactNode {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand lead={c.brandLead} accent={c.brandAccent} logo={c.logoSrc} />
          <small>{c.copyright.replace('{year}', String(ctx.year))}</small>
        </div>
        <ul className="footer-links" aria-label={c.socialLabel}>
          {c.links.map((l, ix) => (
            <li key={`${ix}-${l.label}`}>
              <a href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}>{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

export function StickyBar({ content: c, ctx }: Props<StickyCtaContent>) {
  const t = offerTexts(ctx.offer);
  return <StickyCta price={t.total} installments={t.installmentsShort} ctaLabel={c.ctaLabel} />;
}

import { HeroTelemetry } from '../fx/HeroTelemetry';
import type { RenderContext } from '../offer';
import type { BioContent, CoursesContent, CtaContent, HeroContent, NavContent, StatsContent, VideoContent, WorksContent } from './schemas';
import { mediaSrc } from '../media';

type Props<C> = { content: C; ctx: RenderContext; idSuffix?: string };

const DEFAULT_SITE_LINKS = [
  { label: 'CURSOS', href: '/#cursos-home' },
  { label: 'PROFISSIONAIS', href: '/#profissionais' },
  { label: 'QUEM SOMOS', href: '/#beneficios' },
];

export function Nav({ content: c }: Props<NavContent>) {
  return (
    <>
      <nav className="cb-nav">
        <a className="cb-brand" href="/">{c.brandLead} <span>{c.brandAccent}</span></a>
        <div className="cb-links">{(c.siteLinks ?? DEFAULT_SITE_LINKS).map((l, ix) => <a key={`${ix}-${l.href}`} href={l.href}>{l.label}</a>)}</div>
        <a className="cb-account" href={c.account.href}>{c.account.label}</a>
      </nav>
      {c.links.length ? (
        <nav className="pro-side-nav" aria-label="Seções da página">
          <ul>{c.links.map((l, ix) => <li key={`${ix}-${l.href}`}><a href={l.href} title={l.label}><i aria-hidden="true" /><span>{l.label}</span></a></li>)}</ul>
        </nav>
      ) : null}
    </>
  );
}

export function Hero({ content: c }: Props<HeroContent>) {
  return (
    <header className="profile-hero cb-hero">
      <HeroTelemetry heroSelector=".profile-hero" />
      <div className="cb-container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow reveal"><i /> {c.eyebrow}</div>
          <h1 className="hero-name reveal">{c.nameFirst}<span>{c.nameAccent}</span></h1>
          <p className="hero-sub reveal">{c.sub}</p>
          <div className="hero-meta reveal">
            {c.meta.map((m, ix) => (
              <div className="meta-item" key={`${ix}-${m.label}`}>
                <div className="meta-label">{m.label}</div>
                <div className={m.gold ? 'meta-value gold' : 'meta-value'}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-portrait">
        <img src={mediaSrc(c.portrait.src, 960)} alt={c.portrait.alt} />
      </div>

      <div className="hero-hud">
        <small>{c.hud.label}</small>
        <strong><em>{c.hud.accent}</em> {c.hud.value}</strong>
      </div>
    </header>
  );
}

const TICKER_REPEAT = 4;

export function Bio({ content: c }: Props<BioContent>) {
  return (
    <section className="bio-section">
      <div className="bio-bg" aria-hidden="true">{c.tickerUnit.repeat(TICKER_REPEAT)}</div>
      <div className="cb-container bio-grid">
        <div>
          <div className="section-index">{c.sectionIndex}</div>
          <h2 className="bio-title reveal">{c.titleLead} <strong>{c.titleStrong}</strong></h2>
        </div>
        <div className="bio-text reveal">
          {c.paragraphs.map((p, ix) => <p key={`${ix}-${p}`}>{p}</p>)}
          <a className="instagram-card" href={c.instagram.href} target="_blank" rel="noopener">
            <div>
              <strong>{c.instagram.handle}</strong>
              <small>{c.instagram.followers}</small>
            </div>
            <div className="ig-circle">↗</div>
          </a>
        </div>
      </div>
    </section>
  );
}

export function Works({ content: c, idSuffix: x = '' }: Props<WorksContent>) {
  const showInfo = Boolean(c.showPerson || c.showTitle || c.showPlus);
  return (
    <section className="work-section" id={`trabalhos${x}`}>
      <div className="cb-container">
        <div className="cb-course-heading-wrap reveal">
          <div className="cb-eyebrow">{c.eyebrow}</div>
          <h2>{c.titleLead} <span style={{ color: 'var(--gold)' }}>{c.titleAccent}</span></h2>
          <p className="cb-section-copy">{c.copy}</p>
        </div>

        <div className="cb-courses" data-cols={c.columns ?? '4'}>
          {c.items.map((w, ix) => (
            <article className="cb-course reveal" key={`${ix}-${w.title}`}>
              <div className="cb-course-img-wrap">
                <img className="cb-course-bg" src={mediaSrc(w.image.src, 640)} alt={w.image.alt} loading="lazy" />
              </div>
              {showInfo ? (
                <div className="cb-course-content">
                  {c.showTitle ? (
                    <div className="cb-course-meta">
                      {w.tags.map((t, ix) => <span key={`${ix}-${t.label}`} className={t.gold ? 'cb-tag gold' : 'cb-tag'}>{t.label}</span>)}
                    </div>
                  ) : null}
                  {c.showPerson || c.showTitle ? (
                    <div className="cb-course-copy">
                      {c.showPerson ? <div className="cb-course-person">{w.person}</div> : null}
                      {c.showTitle ? <div className="cb-course-title">{w.title}</div> : null}
                    </div>
                  ) : null}
                  {c.showPlus ? <a className="cb-plus" href={w.href} aria-label={w.plusLabel}>+</a> : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Video({ content: c, idSuffix: x = '' }: Props<VideoContent>) {
  return (
    <section className="video-section" id={`video${x}`}>
      <div className="cb-container video-shell reveal">
        <div className="video-info">
          <div>
            <div className="section-index">{c.sectionIndex}</div>
            <h2>{c.titleLead}<br /><span>{c.titleAccent}</span></h2>
          </div>
          <p>{c.text}</p>
        </div>
        <div className="video-frame">
          {/* Sem autoplay: o original usava autoplay sem muted, que os navegadores bloqueiam; o comportamento visível é o mesmo. */}
          <video controls playsInline preload="metadata" aria-label={c.video.ariaLabel}>
            <source src={c.video.src} type={c.video.type} />
            {c.video.fallback}
          </video>
        </div>
      </div>
    </section>
  );
}

export function Courses({ content: c }: Props<CoursesContent>) {
  if (!c.cards.length) return null;
  return (
    <section className="course-section" id="cursos">
      <div className="cb-container">
        <div className="course-head">
          <div>
            <div className="section-index section-index--courses">{c.sectionIndex}</div>
            <h2>{c.title}</h2>
          </div>
          <p>{c.text}</p>
        </div>

        <div className="course-grid" data-cols={c.columns ?? '4'}>
        {c.cards.map((card, ix) => (
          <a className="course-card reveal" href={card.href} key={`${ix}-${card.href}`}>
            <img className="course-card-bg" src={mediaSrc(card.image.src, 640)} alt={card.image.alt} loading="lazy" decoding="async" />
            <div className="course-card-overlay" />
            <div className="course-card-body">
              <div className="course-tags">
                {card.badge && <span className="tag">{card.badge}</span>}
                <span className="tag dark">{card.person}</span>
              </div>
              <div className="course-bottom">
                <div className="course-copy">
                  <h3>{card.titleLead} <span>{card.titleAccent}</span></h3>
                  {card.price && (
                    <p className="course-price num">
                      {card.priceOld && <s>{card.priceOld}</s>}
                      <strong>{card.price}</strong>
                    </p>
                  )}
                </div>
                <span className="course-plus">+</span>
              </div>
            </div>
          </a>
        ))}
        </div>
      </div>
    </section>
  );
}

/** Faixa de números: o valor aparece em destaque e o rótulo logo abaixo (a ordem no DOM é rótulo → valor, como leitores de tela esperam em `dl`). */
export function Stats({ content: c }: Props<StatsContent>) {
  return (
    <section className="stats-section" id="numeros">
      <div className="cb-container">
        <div className="section-index">{c.sectionIndex}</div>
        <h2 className="stats-title reveal">{c.title}</h2>
        <dl className="stats-grid">
          {c.items.map((item, ix) => (
            <div className="stat reveal" key={`${ix}-${item.label}`}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Cta({ content: c, idSuffix: x = '' }: Props<CtaContent>) {
  const external = /^https:\/\//i.test(c.cta.href);
  return (
    <section className="cta-section" id={`chamada${x}`}>
      <div className="cb-container cta-shell reveal">
        <div className="cta-copy">
          <div className="section-index">{c.sectionIndex}</div>
          <h2>{c.title}</h2>
          <p>{c.text}</p>
        </div>
        <a className="cta-button" href={c.cta.href} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>{c.cta.label}</a>
      </div>
    </section>
  );
}

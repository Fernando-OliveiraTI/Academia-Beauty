import type { RenderContext } from '../offer';
import type { ProfessionalFooterContent } from './footer-schema';

type IconName = ProfessionalFooterContent['socials'][number]['icon'];

const ICONS: Record<IconName, React.ReactNode> = {
  facebook: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-4h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>,
  instagram: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>,
  youtube: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.56-1.36 1.52-1.36 2.53-.01 1.01.51 1.97 1.35 2.55.83.58 1.97.68 2.94.28.84-.33 1.52-1.07 1.78-1.93.12-.41.14-.85.14-1.28V.02z" /></svg>,
  x: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
};

/** Rodapé da página de Profissional: ondas, pontos e redes. (A Home tem outro rodapé, com energia animada.) */
export function ProfessionalFooter({ content: c, ctx }: { content: ProfessionalFooterContent; ctx: RenderContext }) {
  return (
    <footer className="cb-footer-exact">
      <div className="cb-footer-bg-fx" aria-hidden="true">
        <div className="cb-glow-ambient" />
        <div className="cb-wave w1" />
        <div className="cb-wave w2" />
        <div className="cb-dots">
          {[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={`dot d${n}`} />)}
        </div>
      </div>

      <div className="cb-footer-content">
        <h2 className="cb-footer-logo">{c.logoLead} <span>{c.logoAccent}</span></h2>
        <div className="cb-social-links">
          {c.socials.map((s) => <a key={s.label} href={s.href} aria-label={s.label}>{ICONS[s.icon]}</a>)}
        </div>
        <div className="cb-footer-divider" />
        <p className="cb-copyright">{c.copyright.replace('{year}', String(ctx.year))}</p>
      </div>
    </footer>
  );
}

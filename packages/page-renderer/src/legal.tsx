/**
 * Informações legais do rodapé (D-041), com os textos do jurídico (`Footer_Termo_De_Uso_Politica/footer.html`).
 * Entram no fim do rodapé de cada página pública, sem mudar o que já existe nele, e não são editáveis no editor
 * (texto legal). "Preferências de cookies" reabre o banner de cookies do site (`data-cookie-preferences`).
 */
export const COMPANY = {
  name: 'Academia Beauty LTDA.',
  cnpj: '69.111.867/0001-10',
  address: 'Rua Manuel da Nóbrega, 1088, apto 15, Paraíso, São Paulo/SP, CEP 04001-003',
  email: 'suporte@academiabeauty.com.br',
} as const;

export function LegalFooter({ year }: { year: number }) {
  return (
    <div className="ab-legal">
      <div className="ab-legal__inner">
        <ul className="ab-legal__badges" aria-label="Resumo">
          <li>Maiores de 18</li>
          <li>LGPD</li>
          <li>Pagamento seguro</li>
        </ul>
        <div className="ab-legal__cols">
          <div>
            <h3>Faixa etária</h3>
            <p>Cursos para maiores de 18 anos. Adolescentes de 16 e 17 anos com autorização do responsável legal. Conteúdo com classificação indicativa Livre.</p>
          </div>
          <div>
            <h3>Seus dados</h3>
            <p>Tratamos seus dados conforme a LGPD (Lei 13.709/2018) apenas para oferecer os cursos, processar compras e cumprir a lei. Não vendemos seus dados.</p>
          </div>
          <div>
            <h3>Compras</h3>
            <p>Pagamentos por gateway parceiro; não armazenamos os dados do seu cartão. Desistência em até 7 dias com reembolso integral (CDC, art. 49).</p>
          </div>
        </div>
        <nav className="ab-legal__links" aria-label="Links legais">
          <a href="/termos-de-uso">Termos de Uso</a>
          <a href="/politica-de-privacidade">Política de Privacidade</a>
          <a href="#preferencias-de-cookies" data-cookie-preferences="">Preferências de cookies</a>
          <a className="ab-legal__mail" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </nav>
        <p className="ab-legal__company">
          © {year} {COMPANY.name} · CNPJ {COMPANY.cnpj} · {COMPANY.address}
        </p>
      </div>
    </div>
  );
}

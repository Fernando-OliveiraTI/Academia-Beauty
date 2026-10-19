import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
  /** Marca o rótulo com asterisco (não ativa a validação nativa do navegador). */
  requiredMark?: boolean;
  /** Ícone à esquerda do campo. */
  icon?: ReactNode;
  /** Texto fixo antes do valor (ex.: `/cursos/`). */
  prefix?: string;
  /** Elemento à direita (ex.: ícone). */
  suffix?: ReactNode;
  hint?: ReactNode;
};

/** Campo com rótulo associado e erro anunciado por leitores de tela. */
export function Field({ label, error, id, requiredMark, icon, prefix, suffix, hint, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  const input = (
    <input
      id={inputId}
      className="ds-input"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      {...rest}
    />
  );
  const decorated = icon || prefix || suffix;
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={inputId}>
        {label}{requiredMark ? <span className="ds-req" aria-hidden="true"> *</span> : null}
      </label>
      {decorated ? (
        <div className="ds-input-wrap" data-invalid={error ? true : undefined} data-disabled={rest.disabled || undefined}>
          {icon ? <span className="ds-icon" aria-hidden="true">{icon}</span> : null}
          {prefix ? <span className="ds-prefix" aria-hidden="true">{prefix}</span> : null}
          {input}
          {suffix ? <span className="ds-suffix" aria-hidden="true">{suffix}</span> : null}
        </div>
      ) : input}
      {hint ? <p className="ds-hint">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="ds-error">{error}</p> : null}
    </div>
  );
}

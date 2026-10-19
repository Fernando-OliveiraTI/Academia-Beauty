import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  error?: string;
  requiredMark?: boolean;
  icon?: ReactNode;
  hint?: ReactNode;
};

/** Área de texto com rótulo associado e erro anunciado por leitores de tela. Com `maxLength` e valor controlado mostra o contador. */
export function TextArea({ label, error, id, rows = 4, requiredMark, icon, hint, ...rest }: TextAreaProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  const area = (
    <textarea
      id={inputId}
      rows={rows}
      className="ds-input"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      {...rest}
    />
  );
  const counter = typeof rest.value === 'string' && rest.maxLength ? <span className="ds-counter">{rest.value.length}/{rest.maxLength}</span> : null;
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={inputId}>
        {label}{requiredMark ? <span className="ds-req" aria-hidden="true"> *</span> : null}
      </label>
      {icon ? (
        <div className="ds-input-wrap ds-input-wrap--area" data-invalid={error ? true : undefined} data-disabled={rest.disabled || undefined}>
          <span className="ds-icon" aria-hidden="true">{icon}</span>
          {area}
        </div>
      ) : area}
      {hint || counter ? <p className="ds-hint ds-hint--row"><span>{hint}</span>{counter}</p> : null}
      {error ? <p id={errorId} role="alert" className="ds-error">{error}</p> : null}
    </div>
  );
}

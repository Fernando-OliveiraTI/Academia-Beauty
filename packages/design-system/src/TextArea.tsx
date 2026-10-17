import { useId, type TextareaHTMLAttributes } from 'react';

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

/** Área de texto com rótulo associado e erro anunciado por leitores de tela. */
export function TextArea({ label, error, id, rows = 4, ...rest }: TextAreaProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        rows={rows}
        className="ds-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error ? <p id={errorId} role="alert" className="ds-error">{error}</p> : null}
    </div>
  );
}

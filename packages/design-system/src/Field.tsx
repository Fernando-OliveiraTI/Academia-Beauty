import { useId, type InputHTMLAttributes } from 'react';

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

/** Campo com rótulo associado e erro anunciado por leitores de tela. */
export function Field({ label, error, id, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className="ds-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error ? <p id={errorId} role="alert" className="ds-error">{error}</p> : null}
    </div>
  );
}

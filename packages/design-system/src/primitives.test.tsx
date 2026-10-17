import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { Field } from './Field';

describe('Button', () => {
  it('usa type=button por padrão (não envia formulários sem querer)', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button');
  });
  it('respeita disabled', () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Field', () => {
  it('associa o rótulo ao campo', () => {
    render(<Field label="E-mail" />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });
  it('anuncia erro e marca o campo como inválido', () => {
    render(<Field label="E-mail" error="Informe um e-mail válido" />);
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});

import { describe, expect, it } from 'vitest';
import { mediaSrc } from './media';

const id = 'ab'.repeat(16);

describe('mediaSrc', () => {
  it('pede a largura de exibição para imagens da biblioteca', () => {
    expect(mediaSrc(`/media/${id}`, 480)).toBe(`/media/${id}?w=480`);
    expect(mediaSrc(`/media/${id}?w=999`, 320.4)).toBe(`/media/${id}?w=320`);
  });
  it('não mexe em caminhos do site nem em URLs externas', () => {
    expect(mediaSrc('/site/home/foto.png', 480)).toBe('/site/home/foto.png');
    expect(mediaSrc('https://cdn.exemplo.com/a.webp', 480)).toBe('https://cdn.exemplo.com/a.webp');
    expect(mediaSrc(`/media/${id}/x`, 480)).toBe(`/media/${id}/x`);
  });
});

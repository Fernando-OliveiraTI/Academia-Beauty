import type { PageDocument } from '@academia/page-schema';

/** Histórico linear de edição: `past` (mais antigo primeiro), `present` e `future` (próximo refazer primeiro). */
export type History = {
  readonly past: readonly PageDocument[];
  readonly present: PageDocument;
  readonly future: readonly PageDocument[];
  /** Chave e instante da última gravação, para agrupar edições contínuas (digitação) numa só entrada. */
  readonly lastKey?: string;
  readonly lastAt?: number;
};

export type CommitOptions = {
  /** Edições com a mesma chave em sequência curta viram uma entrada (ex.: `content:hero`). */
  coalesceKey?: string;
  /** Janela de agrupamento em ms (padrão 1000). */
  coalesceMs?: number;
  /** Relógio injetável para testes. */
  now?: number;
  /** Máximo de passos desfazíveis (padrão 100). */
  limit?: number;
};

export const createHistory = (doc: PageDocument): History => ({ past: [], present: doc, future: [] });

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

/** Registra `next` como estado atual. Documento idêntico (mesma referência) não cria entrada. */
export function commit(h: History, next: PageDocument, options: CommitOptions = {}): History {
  if (next === h.present) return h;
  const now = options.now ?? Date.now();
  const key = options.coalesceKey;
  const window = options.coalesceMs ?? 1000;
  const merge = key !== undefined && key === h.lastKey && h.lastAt !== undefined && now - h.lastAt <= window && h.past.length > 0;

  // `limit` inválido (0, negativo, NaN) cai no padrão: `slice(-0)` devolveria tudo.
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : 100;
  const past = merge ? h.past : [...h.past, h.present].slice(-limit);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undo(h: History): History {
  const previous = h.past[h.past.length - 1];
  if (!previous) return h;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  const [next, ...rest] = h.future;
  if (!next) return h;
  return { past: [...h.past, h.present], present: next, future: rest };
}

/** Define um estado novo sem histórico (ex.: depois de salvar com conflito resolvido ou restaurar versão). */
export const reset = createHistory;

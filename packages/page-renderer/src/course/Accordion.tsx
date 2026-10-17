'use client';

import { useState } from 'react';

export type AccordionItem = { title: string; text: string; bullets?: string[] };

/** Um item aberto por vez; clicar no aberto fecha. `modules` mostra o índice 01, 02… */
export function Accordion({
  items, idPrefix, numbered = false, defaultOpen = null,
}: { items: AccordionItem[]; idPrefix: string; numbered?: boolean; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className="accordion reveal">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `${idPrefix}-${i + 1}`;
        return (
          <div key={id} className={isOpen ? 'acc-item is-open' : 'acc-item'}>
            <button
              type="button"
              className="acc-trigger"
              aria-expanded={isOpen}
              aria-controls={id}
              id={`${id}-btn`}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {numbered && <span className="acc-index">{String(i + 1).padStart(2, '0')}</span>}
              <h3>{item.title}</h3>
              <span className="acc-icon" aria-hidden="true" />
            </button>
            <div className="acc-panel" id={id} role="region" aria-labelledby={`${id}-btn`}>
              <div>
                <div className="acc-body">
                  <p>{item.text}</p>
                  {item.bullets && (
                    <ul>{item.bullets.map((b, ix) => <li key={`${ix}-${b}`}>{b}</li>)}</ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

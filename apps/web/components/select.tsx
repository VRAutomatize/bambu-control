'use client';

/**
 * Dropdown customizado — substitui o <select> nativo em todo o app.
 *
 * Por quê: o popup de opções de um <select> nativo é renderizado pelo
 * sistema operacional/browser e não pode ser estilizado via CSS — em dark
 * mode ele aparece com fundo branco/cinza do SO, destoando do resto da UI
 * (ficava "feio"/inconsistente). Este componente reproduz a caixa (`.input`)
 * como gatilho e desenha a lista de opções nós mesmos, com o mesmo tema
 * claro/escuro do resto do app.
 *
 * Continua funcionando dentro de <form action={serverAction}> normalmente:
 * mantém um <input type="hidden" name={name}> sincronizado com o valor
 * selecionado, então FormData/Server Actions leem exatamente como leriam
 * de um <select> nativo.
 *
 * `searchable`: para listas que podem crescer (clientes, filamentos,
 * impressoras...), abre com um campo de busca focado — filtra as opções
 * por texto (ignorando acento/maiúscula) em vez de forçar o usuário a
 * rolar tudo procurando.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { IconCheck, IconChevronDown, IconSearch } from './icons';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function Select({
  name,
  options,
  defaultValue,
  value: controlledValue,
  onChange,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar…',
  required,
  disabled,
  searchable = false,
  id,
  className = '',
}: {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Mostra um campo de busca no topo da lista, focado ao abrir. */
  searchable?: boolean;
  id?: string;
  className?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const value = isControlled ? controlledValue : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = normalize(query);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query, searchable]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Ao abrir: limpa a busca, realça a opção selecionada (ou a primeira) e
  // foca o campo de busca (se houver).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    if (searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Busca muda a lista visível — realça sempre a primeira opção filtrada.
  useEffect(() => {
    if (open && searchable) setHighlight(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function commit(v: string) {
    if (!isControlled) setUncontrolledValue(v);
    onChange?.(v);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function closeAndRefocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleListNav(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRefocus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filteredOptions.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filteredOptions[highlight];
      if (opt && !opt.disabled) commit(opt.value);
    }
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    // Foco só fica no botão quando não há busca (com busca, o foco já foi
    // pro campo de texto ao abrir — lá espaço precisa digitar, não selecionar).
    if (e.key === ' ') {
      e.preventDefault();
      const opt = filteredOptions[highlight];
      if (opt && !opt.disabled) commit(opt.value);
      return;
    }
    handleListNav(e);
  }

  const emptyMessage =
    options.length === 0
      ? 'Nenhuma opção disponível'
      : searchable && query.trim()
        ? `Nenhum resultado para "${query.trim()}"`
        : 'Nenhuma opção disponível';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name &&
        (required ? (
          // `required` não tem efeito num <input type="hidden"> — o HTML
          // isenta esse tipo de validação. Pra validação nativa do form
          // funcionar de verdade (e o navegador focar/apontar pro campo
          // certo em vez de deixar passar um valor vazio até um erro cru
          // do servidor), usamos um input real, só visualmente oculto.
          <input
            name={name}
            value={value}
            readOnly
            required
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
          />
        ) : (
          <input type="hidden" name={name} value={value} />
        ))}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="input flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${selected ? '' : 'text-neutral-400 dark:text-neutral-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <IconChevronDown
          width={16}
          height={16}
          strokeWidth={2}
          className={`shrink-0 text-neutral-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-neutral-900/95">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-2 dark:border-white/[0.08]">
              <IconSearch width={14} height={14} strokeWidth={2} className="shrink-0 text-neutral-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleListNav}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[13.5px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </div>
          )}
          <div role="listbox" className="max-h-64 overflow-auto p-1.5">
            {filteredOptions.length === 0 && (
              <p className="px-3 py-2 text-[13px] text-neutral-400 dark:text-neutral-500">{emptyMessage}</p>
            )}
            {filteredOptions.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => !opt.disabled && commit(opt.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[14px] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                  i === highlight
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
                    : 'text-neutral-800 dark:text-neutral-100'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && (
                  <IconCheck
                    width={14}
                    height={14}
                    strokeWidth={2.25}
                    className="shrink-0 text-brand-600 dark:text-brand-400"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

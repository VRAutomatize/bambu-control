'use client';

/**
 * Campo de cor reutilizável: nome + hex + seletor visual completo.
 *
 * - O quadradinho abre o color picker nativo do sistema (roda visto por
 *   `<input type="color">`), com a paleta completa do SO — não é uma cor
 *   "próxima", é qualquer cor.
 * - Ao digitar um nome de cor comum (ex.: "preto", "vermelho", "prata
 *   metálico") e sair do campo, preenche o hex automaticamente com o valor
 *   padrão dessa cor — só quando o usuário ainda não editou o hex à mão
 *   (edição manual sempre tem prioridade e nunca é sobrescrita).
 */
import { useRef, useState, type ChangeEvent } from 'react';

/** Nomes de cor comuns (PT-BR, com variações/EN) → hex "padrão" da cor. */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  // Neutros
  preto: '#000000',
  black: '#000000',
  branco: '#ffffff',
  white: '#ffffff',
  cinza: '#808080',
  gray: '#808080',
  grey: '#808080',
  'cinza claro': '#d3d3d3',
  'cinza escuro': '#404040',
  prata: '#c0c0c0',
  silver: '#c0c0c0',
  grafite: '#383838',
  chumbo: '#4a4a4a',

  // Metálicos / especiais
  dourado: '#ffd700',
  ouro: '#ffd700',
  gold: '#ffd700',
  bronze: '#cd7f32',
  cobre: '#b87333',
  latao: '#b5a642',

  // Vermelhos / rosas
  vermelho: '#ff0000',
  red: '#ff0000',
  bordo: '#800000',
  vinho: '#800000',
  maroon: '#800000',
  carmesim: '#dc143c',
  rosa: '#ffc0cb',
  pink: '#ffc0cb',
  magenta: '#ff00ff',
  salmao: '#fa8072',
  coral: '#ff7f50',

  // Laranjas / amarelos
  laranja: '#ffa500',
  orange: '#ffa500',
  amarelo: '#ffff00',
  yellow: '#ffff00',
  mostarda: '#ffdb58',
  caqui: '#f0e68c',
  bege: '#f5f5dc',
  beige: '#f5f5dc',
  marfim: '#fffff0',
  creme: '#fffdd0',

  // Verdes
  verde: '#008000',
  green: '#008000',
  'verde limao': '#00ff00',
  lima: '#00ff00',
  lime: '#00ff00',
  oliva: '#808000',
  olive: '#808000',
  'verde-agua': '#008080',
  'verde agua': '#008080',
  teal: '#008080',
  esmeralda: '#50c878',
  menta: '#98ff98',

  // Azuis / roxos
  azul: '#0000ff',
  blue: '#0000ff',
  'azul marinho': '#000080',
  marinho: '#000080',
  navy: '#000080',
  'azul celeste': '#87ceeb',
  celeste: '#87ceeb',
  ciano: '#00ffff',
  cyan: '#00ffff',
  turquesa: '#40e0d0',
  indigo: '#4b0082',
  roxo: '#800080',
  purple: '#800080',
  violeta: '#ee82ee',
  violet: '#ee82ee',
  lavanda: '#e6e6fa',
  lilas: '#c8a2c8',

  // Marrons
  marrom: '#a52a2a',
  brown: '#a52a2a',
  chocolate: '#d2691e',
  canela: '#d2b48c',
  caramelo: '#c68e17',
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .trim();
}

/** Acha um hex "padrão" pro nome digitado. Casa nome exato primeiro
 * ("prata"); se não achar, tenta achar uma cor conhecida como parte do
 * texto ("preto fosco" → preto), pra cobrir variações comuns de catálogo. */
function guessHexFromName(name: string): string | null {
  const n = normalize(name);
  if (!n) return null;
  const exact = COLOR_NAME_TO_HEX[n];
  if (exact) return exact;
  let best: string | undefined;
  let bestLen = 0;
  for (const key of Object.keys(COLOR_NAME_TO_HEX)) {
    if (n.includes(key) && key.length > bestLen) {
      best = COLOR_NAME_TO_HEX[key];
      bestLen = key.length;
    }
  }
  return best ?? null;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function ColorPickerField({
  nameField,
  hexField,
  defaultName = '',
  defaultHex = '',
}: {
  nameField: string;
  hexField: string;
  defaultName?: string;
  defaultHex?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [hex, setHex] = useState(defaultHex);
  // Uma vez que o usuário mexe no hex diretamente (digitando ou no seletor
  // visual), paramos de sobrescrever com o palpite automático do nome.
  const hexEditedManually = useRef(Boolean(defaultHex));

  function handleNameBlur() {
    if (hexEditedManually.current) return;
    const guess = guessHexFromName(name);
    if (guess) setHex(guess);
  }

  function handleHexChange(e: ChangeEvent<HTMLInputElement>) {
    hexEditedManually.current = true;
    setHex(e.target.value);
  }

  function handleSwatchChange(e: ChangeEvent<HTMLInputElement>) {
    hexEditedManually.current = true;
    setHex(e.target.value);
  }

  const swatchValue = HEX_RE.test(hex) ? hex : '#000000';

  return (
    <div className="flex gap-2.5">
      <input
        name={nameField}
        className="input flex-1"
        placeholder="Cor (ex.: Preto)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleNameBlur}
        autoComplete="off"
      />
      <input
        name={hexField}
        className="input flex-1 font-mono uppercase"
        placeholder="#00A651"
        value={hex}
        onChange={handleHexChange}
        maxLength={7}
        autoComplete="off"
      />
      <label
        className="relative w-11 shrink-0 cursor-pointer overflow-hidden rounded-[10px] ring-1 ring-inset ring-black/[0.06] transition-shadow dark:ring-white/[0.08]"
        style={{ backgroundColor: swatchValue }}
        title="Escolher cor"
      >
        <input
          type="color"
          value={swatchValue}
          onChange={handleSwatchChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Seletor de cor completo"
        />
      </label>
    </div>
  );
}

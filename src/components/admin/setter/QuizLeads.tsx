'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Swords, MessageCircle, AtSign, AlertTriangle } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { APP_TZ } from '@/lib/dates';

interface Item {
  session_id: string;
  nombre: string | null;
  instagram: string | null;
  whatsapp: string | null;
  match_arquetipo: string | null;
  match_pct: number | null;
  vision: string | null;
  dolor: string | null;
  frecuencia: string | null;
  peso: string | null;
  clicked_form: boolean;
  created_at: string;
  /** false = abandonó antes de terminar el quiz. */
  completo: boolean;
}

interface Resp {
  items: Item[];
  total: number;
  incompletos: number;
}

const ARQUETIPO_NOMBRE: Record<string, string> = {
  marcelo: 'Marcelo Garcia',
  gordon: 'Gordon Ryan',
  buchecha: 'Buchecha',
  bernardo: 'Bernardo Faria',
  cobrinha: 'Cobrinha',
  roger: 'Roger Gracie',
  adam: 'Adam Wardzinski',
};

const DOLOR_CORTO: Record<string, string> = {
  'me-aplastan': 'No controla desde la guardia',
  'no-paso': 'No logra pasar',
  'no-defiendo': 'No defiende',
  'no-finalizo': 'No finaliza',
  'no-se-que-buscar': 'No sabe qué buscar',
};

const VISION_CORTA: Record<string, string> = {
  aire: 'Cardio',
  lesiones: 'No lesionarse',
  imponer: 'Imponer su juego',
  respeto: 'Aguantar a los mayores',
  competir: 'Competir',
  disfrutar: 'Disfrutar',
};

const FRECUENCIA_CORTA: Record<string, string> = {
  'no-entreno': 'No entrena',
  '1-2': '1-2 x sem',
  '3': '3 x sem',
  '4-5': '4-5 x sem',
  '6+': '6+ x sem',
};

type Filtro = 'todos' | 'incompletos' | 'completos';

/**
 * La gente que pasó por el quiz "¿A qué luchador te parecés?".
 *
 * Lo importante son los INCOMPLETOS: cargaron nombre, Instagram y WhatsApp y
 * después abandonaron. Antes esa gente no quedaba registrada en ningún lado
 * porque la fila se creaba recién al terminar. Son los más fáciles de
 * recuperar, porque dejaron el contacto y ya mostraron interés.
 */
export default function QuizLeads() {
  const { data, error, isLoading } = useSWR<Resp>('/api/admin/setter/quiz-leads', fetcher, {
    revalidateOnFocus: false,
  });
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const visibles = useMemo(() => {
    const items = data?.items ?? [];
    if (filtro === 'incompletos') return items.filter((i) => !i.completo);
    if (filtro === 'completos') return items.filter((i) => i.completo);
    return items;
  }, [data, filtro]);

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-[13px] text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          No se pudo leer el quiz.
        </div>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const incompletos = data?.incompletos ?? 0;

  return (
    <div className="overflow-hidden rounded-xl border border-jjl-border bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-3 border-b border-jjl-border px-4 py-3">
        <Swords className="h-4 w-4 text-jjl-red" />
        <h3 className="text-[13px] font-bold text-white">Quiz &quot;¿A qué luchador te parecés?&quot;</h3>
        {incompletos > 0 && (
          <span className="inline-flex h-5 items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-bold text-amber-300">
            {incompletos} sin terminar
          </span>
        )}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-jjl-border">
          {(
            [
              ['todos', `Todos (${total})`],
              ['incompletos', `Sin terminar (${incompletos})`],
              ['completos', `Completos (${total - incompletos})`],
            ] as [Filtro, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`h-7 px-2.5 text-[11px] font-semibold transition-colors ${
                filtro === id ? 'bg-jjl-red text-white' : 'text-jjl-muted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-jjl-red border-t-transparent" />
        </div>
      ) : visibles.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-jjl-muted">
          {filtro === 'incompletos'
            ? 'Nadie abandonó el quiz a mitad.'
            : 'Todavía no hay respuestas.'}
        </p>
      ) : (
        <div className="max-h-[26rem] divide-y divide-white/[0.06] overflow-y-auto">
          {visibles.map((i) => (
            <Fila key={i.session_id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Fila({ item }: { item: Item }) {
  const fecha = new Date(item.created_at).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: APP_TZ,
  });

  // El numero ya viene normalizado a digitos desde la API.
  const wpp = item.whatsapp ? item.whatsapp.replace(/[^0-9]/g, '') : null;

  const contexto = [
    item.frecuencia ? FRECUENCIA_CORTA[item.frecuencia] : null,
    item.dolor ? DOLOR_CORTO[item.dolor] : null,
    item.vision ? VISION_CORTA[item.vision] : null,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-white">
            {item.nombre || 'Sin nombre'}
          </span>
          {item.completo ? (
            <span className="inline-flex h-5 items-center rounded border border-jjl-border bg-white/[0.04] px-1.5 text-[10px] font-bold text-jjl-muted">
              {ARQUETIPO_NOMBRE[item.match_arquetipo || ''] || item.match_arquetipo} · {item.match_pct}%
            </span>
          ) : (
            <span className="inline-flex h-5 items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-bold text-amber-300">
              Abandonó el quiz
            </span>
          )}
          {item.clicked_form && (
            <span className="inline-flex h-5 items-center rounded border border-green-500/40 bg-green-500/10 px-1.5 text-[10px] font-bold text-green-300">
              Pasó al formulario
            </span>
          )}
          <span className="text-[11px] text-jjl-muted">{fecha}</span>
        </div>

        {contexto.length > 0 && (
          <p className="mt-1 text-[12px] text-jjl-muted">{contexto.join(' · ')}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-1.5">
        {item.instagram && (
          <a
            href={`https://ig.me/m/${item.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`@${item.instagram}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-jjl-border text-jjl-muted transition-colors hover:border-jjl-red hover:text-white"
          >
            <AtSign className="h-4 w-4" />
          </a>
        )}
        {wpp && (
          <a
            href={`https://wa.me/${wpp}`}
            target="_blank"
            rel="noopener noreferrer"
            title={item.whatsapp || ''}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-jjl-border text-jjl-muted transition-colors hover:border-green-500 hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

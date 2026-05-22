'use client';

import { useState, useTransition } from 'react';
import { clsx } from 'clsx';
import {
  lookupCustomer,
  grantAccess,
  revokeAccess,
  type CustomerLookup,
} from '../actions';

interface Option {
  id: string;
  titulo: string;
}

const VENCIMIENTOS = [
  { label: '1 año', meses: 12 },
  { label: '2 años', meses: 24 },
  { label: 'De por vida', meses: 0 },
];

function fmtDate(iso: string | null): string {
  if (!iso) return 'De por vida';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AccessManager({
  courses,
  bundles,
}: {
  courses: Option[];
  bundles: Option[];
}) {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CustomerLookup | null>(null);
  const [target, setTarget] = useState('');
  const [meses, setMeses] = useState(24);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  const search = () =>
    start(async () => {
      setMsg('');
      const r = await lookupCustomer(email);
      setResult(r);
    });

  const refresh = async () => {
    const r = await lookupCustomer(email);
    setResult(r);
  };

  const doGrant = () =>
    start(async () => {
      setMsg('');
      if (!target) {
        setMsg('Elegí un curso o pack.');
        return;
      }
      const [tipo, id] = target.split(':');
      const r = await grantAccess({
        email,
        courseId: tipo === 'course' ? id : undefined,
        bundleId: tipo === 'bundle' ? id : undefined,
        meses: meses || null,
      });
      if (r.error) setMsg(r.error);
      else {
        setMsg('Acceso otorgado.');
        await refresh();
      }
    });

  const toggleRevoke = (id: string, revoked: boolean) =>
    start(async () => {
      await revokeAccess(id, revoked);
      await refresh();
    });

  const inputCls =
    'rounded-lg border border-jjl-border bg-jjl-gray-light px-3.5 py-2.5 text-sm text-white outline-none focus:border-jjl-red';

  return (
    <div className="max-w-2xl">
      {/* búsqueda */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="email del cliente"
          className={clsx(inputCls, 'flex-1')}
        />
        <button
          type="button"
          onClick={search}
          disabled={pending || !email}
          className="h-[42px] rounded-lg bg-white/10 px-5 text-sm font-semibold transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          Buscar
        </button>
      </div>

      {result?.error && (
        <p className="mt-4 rounded-lg bg-error-soft px-3 py-2.5 text-[13px] text-error">
          {result.error}
        </p>
      )}

      {result?.customer && (
        <div className="mt-6 rounded-xl border border-jjl-border bg-jjl-gray p-5">
          <p className="text-[13px] text-jjl-muted">Cliente</p>
          <p className="font-bold">{result.customer.nombre}</p>
          <p className="text-[13px] text-jjl-muted">{result.customer.email}</p>

          {/* otorgar */}
          <div className="mt-5 border-t border-jjl-border pt-5">
            <p className="mb-2 text-[13px] font-semibold">Otorgar acceso</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={clsx(inputCls, 'flex-1')}
              >
                <option value="">Elegí un curso o pack…</option>
                {bundles.length > 0 && (
                  <optgroup label="Packs">
                    {bundles.map((b) => (
                      <option key={b.id} value={`bundle:${b.id}`}>
                        {b.titulo}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Cursos">
                  {courses.map((c) => (
                    <option key={c.id} value={`course:${c.id}`}>
                      {c.titulo}
                    </option>
                  ))}
                </optgroup>
              </select>
              <select
                value={meses}
                onChange={(e) => setMeses(Number(e.target.value))}
                className={inputCls}
              >
                {VENCIMIENTOS.map((v) => (
                  <option key={v.label} value={v.meses}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={doGrant}
                disabled={pending}
                className="h-[42px] rounded-lg bg-jjl-red px-5 text-sm font-semibold transition-colors hover:bg-jjl-red-hover disabled:opacity-50"
              >
                Otorgar
              </button>
            </div>
            {msg && <p className="mt-2 text-[13px] text-jjl-muted">{msg}</p>}
          </div>

          {/* accesos actuales */}
          <div className="mt-5 border-t border-jjl-border pt-5">
            <p className="mb-2 text-[13px] font-semibold">
              Accesos ({result.grants?.length ?? 0})
            </p>
            {result.grants && result.grants.length > 0 ? (
              <ul className="space-y-1.5">
                {result.grants.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p
                        className={clsx(
                          'truncate text-[13.5px] font-semibold',
                          g.revoked && 'text-jjl-muted line-through'
                        )}
                      >
                        {g.courseTitulo}
                      </p>
                      <p className="text-[12px] text-jjl-muted">
                        Vence: {fmtDate(g.expires_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleRevoke(g.id, !g.revoked)}
                      disabled={pending}
                      className={clsx(
                        'shrink-0 rounded-md px-2.5 py-1 text-[12px] font-semibold disabled:opacity-50',
                        g.revoked
                          ? 'bg-white/10 text-white'
                          : 'bg-error-soft text-error'
                      )}
                    >
                      {g.revoked ? 'Reactivar' : 'Revocar'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-jjl-muted">Sin accesos todavía.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

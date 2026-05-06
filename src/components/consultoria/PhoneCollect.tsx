'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Phone, Loader2 } from 'lucide-react';

// Países hispanohablantes + Brasil + USA. value = código de marcado E.164 sin "+".
const COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: '591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '55', flag: '🇧🇷', name: 'Brasil' },
  { code: '56', flag: '🇨🇱', name: 'Chile' },
  { code: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: '506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '53', flag: '🇨🇺', name: 'Cuba' },
  { code: '1809', flag: '🇩🇴', name: 'Rep. Dominicana' },
  { code: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '34', flag: '🇪🇸', name: 'España' },
  { code: '1', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '504', flag: '🇭🇳', name: 'Honduras' },
  { code: '52', flag: '🇲🇽', name: 'México' },
  { code: '505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '507', flag: '🇵🇦', name: 'Panamá' },
  { code: '595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '51', flag: '🇵🇪', name: 'Perú' },
  { code: '1787', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: '598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '58', flag: '🇻🇪', name: 'Venezuela' },
];

interface PhoneCollectProps {
  sessionId: string;
}

export default function PhoneCollect({ sessionId }: PhoneCollectProps) {
  const [country, setCountry] = useState('54'); // default Argentina
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) {
      setError('Ingresá un número válido.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/leads/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          telefono: `+${country}${digits}`,
          pais: country,
        }),
      });
      if (!res.ok) {
        setError('No pudimos guardar tu número. Probá de nuevo.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError('No pudimos guardar tu número. Probá de nuevo.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
        <div className="flex items-center gap-2 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
          <CheckCircle2 className="h-4 w-4" />
          Listo
        </div>
        <h3 className="mt-3 text-2xl font-bold leading-tight">
          Reservamos tu sesión.
        </h3>
        <p className="mt-3 text-[14px] text-white/85 leading-relaxed">
          Te vamos a contactar por WhatsApp al número que dejaste para confirmar la
          sesión y enviarte el link unas horas antes. Si necesitás reagendar, escribinos.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
      <div className="flex items-center gap-2 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
        <CheckCircle2 className="h-4 w-4" />
        Sesión reservada
      </div>
      <h3 className="mt-3 text-xl sm:text-2xl font-bold leading-snug">
        Último paso: ¿a qué número te escribimos?
      </h3>
      <p className="mt-2 text-[13px] text-jjl-muted leading-relaxed">
        Te confirmamos por WhatsApp y te recordamos la sesión unas horas antes.
        Solo lo usamos para esta consultoría.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="flex gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-black/30 border border-jjl-border rounded-xl px-3 py-3 text-[14px] text-white focus:outline-none focus:border-jjl-red/60 min-w-[155px]"
            aria-label="País"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} +{c.code}
              </option>
            ))}
          </select>
          <div className="flex-1 flex items-center bg-black/30 border border-jjl-border rounded-xl px-3 focus-within:border-jjl-red/60">
            <Phone className="h-4 w-4 text-jjl-muted shrink-0" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="Ej. 11 5555 5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border-0 px-3 py-3 text-[15px] text-white placeholder:text-jjl-muted/60 focus:outline-none"
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-[12px] text-jjl-red">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 h-12 bg-jjl-red hover:bg-jjl-red-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-[0_8px_24px_-8px_rgba(220,38,38,0.5)] transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Confirmar mi sesión'
          )}
        </button>
        <p className="text-[11px] text-jjl-muted text-center">
          No recibís promociones. Solo el contacto de esta consultoría.
        </p>
      </form>
    </div>
  );
}

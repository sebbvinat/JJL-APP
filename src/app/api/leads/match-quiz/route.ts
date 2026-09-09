import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { ARQUETIPOS, calculateMatch, construirBrecha, type ArquetipoId, type QuizAnswers } from '@/lib/match-arquetipos';

export const runtime = 'nodejs';

/**
 * Deja el usuario de Instagram limpio: sin arroba y sin la URL completa.
 * Es la clave con la que el setter lo busca despues, asi que no puede quedar
 * guardado como "https://instagram.com/fulano/".
 */
function handleInstagram(crudo: string | null): string | null {
  if (!crudo) return null;
  const handle = crudo
    .replace(/^https?:[/][/](www[.])?instagram[.]com[/]/i, '')
    .replace(/^@/, '')
    .split('/')[0]
    .trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/** Deja el telefono en digitos (y el + inicial) para poder armar el wa.me. */
function normalizarWhatsapp(crudo: string | null): string | null {
  if (!crudo) return null;
  const limpio = crudo.replace(/[^0-9+]/g, '').replace(/(?!^)[+]/g, '');
  // 8 digitos es un numero local corto; menos que eso es basura.
  return limpio.replace(/[^0-9]/g, '').length >= 8 ? limpio.slice(0, 20) : null;
}

/**
 * POST /api/leads/match-quiz
 *
 * Persiste un resultado del quiz "¿A qué luchador te parecés?" y devuelve
 * el match calculado (el frontend lo usa para renderizar la ficha).
 *
 * Body: {
 *   session_id, frecuencia, antiguedad, peso, fisico, estilo, posicion,
 *   finalizacion, dolor, vision, nombre, instagram, ocupacion
 * }
 *
 * Idempotente: re-postear el mismo session_id update-ea la fila existente.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: 'Body vacío' }, { status: 400 });

  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'session_id inválido (esperado UUID)' }, { status: 400 });
  }

  const pick = (k: string): string | null => {
    const v = body![k];
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null;
  };

  // Guardado parcial: se llama al terminar la pantalla de datos, antes de la
  // primera pregunta. Deja la fila creada con el contacto para que el que
  // abandona a mitad igual aparezca en el panel y se lo pueda seguir.
  if (body.parcial === true) {
    const contacto = {
      session_id: sessionId,
      nombre: pick('nombre'),
      instagram: handleInstagram(pick('instagram')),
      whatsapp: normalizarWhatsapp(pick('whatsapp')),
    };
    if (!contacto.nombre && !contacto.instagram && !contacto.whatsapp) {
      return NextResponse.json({ error: 'Sin datos de contacto' }, { status: 400 });
    }
    try {
      const admin = createAdminSupabaseClient();
      const { error } = await admin
        .from('match_quiz_responses')
        .upsert(contacto, { onConflict: 'session_id' });
      if (error) logger.warn('match-quiz.parcial.failed', { err: error });
    } catch (err) {
      logger.warn('match-quiz.parcial.unhandled', { err });
    }
    // Nunca bloquea: si esto falla la persona igual tiene que poder seguir.
    return NextResponse.json({ ok: true, parcial: true });
  }

  const answers: Partial<QuizAnswers> = {
    frecuencia: pick('frecuencia') || '',
    antiguedad: pick('antiguedad') || '',
    peso: pick('peso') || '',
    fisico: pick('fisico') || '',
    estilo: pick('estilo') || '',
    posicion: pick('posicion') || '',
    finalizacion: pick('finalizacion') || '',
    dolor: pick('dolor') || '',
    vision: pick('vision') || '',
  };

  // Mínimo necesario: 5 de las 6 preguntas con score (todas menos visión).
  const scoring = ['frecuencia', 'antiguedad', 'peso', 'fisico', 'estilo', 'posicion', 'finalizacion', 'dolor'] as const;
  const answered = scoring.filter((k) => answers[k]).length;
  if (answered < 5) {
    return NextResponse.json({ error: 'Faltan respuestas (mínimo 5 de 8)' }, { status: 400 });
  }

  const match = calculateMatch(answers);
  const arquetipo = ARQUETIPOS[match.winner as ArquetipoId];

  try {
    const admin = createAdminSupabaseClient();
    const row = {
      session_id: sessionId,
      ...answers,
      nombre: pick('nombre'),
      instagram: handleInstagram(pick('instagram')),
      ocupacion: pick('ocupacion'),
      whatsapp: normalizarWhatsapp(pick('whatsapp')),
      match_arquetipo: match.winner,
      match_pct: match.matchPct,
    };
    const { error } = await admin
      .from('match_quiz_responses')
      .upsert(row, { onConflict: 'session_id' });
    if (error) {
      // Las columnas frecuencia/antiguedad son nuevas. Si todavia no existen en
      // la tabla, Supabase tira PGRST204 y se perderia TODA la respuesta.
      // Reintentamos sin ellas para no perder el lead, y dejamos aviso en el log.
      const faltanColumnas = /frecuencia|antiguedad|column/i.test(error.message || '');
      if (faltanColumnas) {
        const { frecuencia: _f, antiguedad: _a, ...legacy } = row;
        const retry = await admin
          .from('match_quiz_responses')
          .upsert(legacy, { onConflict: 'session_id' });
        logger.warn('match-quiz.upsert.sin-columnas-nuevas', {
          hint: 'ALTER TABLE match_quiz_responses ADD COLUMN frecuencia text, ADD COLUMN antiguedad text;',
          retryError: retry.error,
        });
      } else {
        logger.error('match-quiz.upsert.failed', { err: error });
      }
    }
  } catch (err) {
    logger.error('match-quiz.unhandled', { err });
  }

  return NextResponse.json({
    ok: true,
    match: {
      arquetipo,
      matchPct: match.matchPct,
      // "Lo que te separa": la mitad que faltaba. Sin esto el resultado es
      // solo un halago y el lead no tiene motivo para escribir.
      brecha: construirBrecha(arquetipo, answers),
      dolor: answers.dolor || null,
    },
  });
}

/**
 * PATCH /api/leads/match-quiz
 *
 * Dos usos sobre la misma fila, identificada por session_id:
 *   - contacto: { nombre?, instagram?, ocupacion? } - la ficha de resultado
 *     los pide y los guarda a medida que la persona escribe. Sin esto el
 *     quiz no capturaba a nadie: el que no mandaba el WhatsApp se perdia.
 *   - tracking: { action: 'shared' | 'dm' }
 *
 * Los dos pueden venir juntos (el boton de WhatsApp manda contacto + accion).
 */
export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'session_id inválido' }, { status: 400 });
  }

  const texto = (k: string, max: number): string | null => {
    const v = body![k];
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  };

  const updates: Record<string, unknown> = {};

  const nombre = texto('nombre', 80);
  if (nombre) updates.nombre = nombre;

  const ocupacion = texto('ocupacion', 120);
  if (ocupacion) updates.ocupacion = ocupacion;

  // El handle se guarda normalizado (sin @, sin la URL completa) porque es la
  // clave con la que el setter lo busca despues en Instagram.
  const wpp = normalizarWhatsapp(texto('whatsapp', 40));
  if (wpp) updates.whatsapp = wpp;

  const handle = handleInstagram(texto('instagram', 120));
  if (handle) updates.instagram = handle;

  const action = body?.action;
  if (action === 'shared') updates.shared_to_ig = true;
  if (action === 'dm') updates.clicked_dm = true;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from('match_quiz_responses')
      .update(updates)
      .eq('session_id', sessionId);
    if (error) {
      // Si todavia no corrieron la migracion de `ocupacion`, guardamos el
      // resto igual en vez de perder el contacto entero.
      if (/ocupacion|column/i.test(error.message || '')) {
        const { ocupacion: _o, ...resto } = updates;
        if (Object.keys(resto).length > 0) {
          await admin.from('match_quiz_responses').update(resto).eq('session_id', sessionId);
        }
        logger.warn('match-quiz.patch.sin-ocupacion', {
          hint: 'Falta correr supabase/migrations/2026_09_08_match_quiz_captura.sql',
        });
      } else {
        logger.warn('match-quiz.patch.failed', { err: error });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.warn('match-quiz.patch.unhandled', { err });
    return NextResponse.json({ ok: false });
  }
}

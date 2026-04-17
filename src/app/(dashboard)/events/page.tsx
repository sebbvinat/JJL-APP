'use client';

import { useState, useEffect } from 'react';
import { format, isPast, isSameDay, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar, Clock, Video, Users, CheckCircle, XCircle, Plus,
  ChevronDown, ExternalLink, Trash2, MapPin,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useUser } from '@/hooks/useUser';

interface Event {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_hora: string;
  duracion_min: number;
  timezone: string;
  meet_link: string | null;
  recurrencia: string;
  myRsvp: string | null;
  confirmedCount: number;
  totalRsvps: number;
}

interface Attendee {
  userId: string;
  nombre: string;
  status: string;
}

export default function EventsPage() {
  const { profile } = useUser();
  const isAdmin = profile?.rol === 'admin';
  const [events, setEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Record<string, Attendee[]>>({});

  // Create form
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('19:00');
  const [duracion, setDuracion] = useState(60);
  const [meetLink, setMeetLink] = useState('');
  const [recurrencia, setRecurrencia] = useState('none');
  const [recurrenciaFin, setRecurrenciaFin] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setPastEvents(data.pastEvents || []);
      }
    } catch {}
    setLoading(false);
  }

  async function handleRsvp(eventId: string, status: 'confirmed' | 'declined') {
    // Optimistic update
    setEvents((prev) => prev.map((e) =>
      e.id === eventId
        ? {
            ...e,
            myRsvp: status,
            confirmedCount: e.confirmedCount + (status === 'confirmed' ? 1 : (e.myRsvp === 'confirmed' ? -1 : 0)),
          }
        : e
    ));

    await fetch('/api/events/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, status }),
    });
  }

  async function loadAttendees(eventId: string) {
    if (attendees[eventId]) return;
    const res = await fetch(`/api/events/rsvp?eventId=${eventId}`);
    if (res.ok) {
      const data = await res.json();
      setAttendees((prev) => ({ ...prev, [eventId]: data.attendees }));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !fecha) return;
    setCreating(true);

    const fechaHora = new Date(`${fecha}T${hora}:00`).toISOString();

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo,
        descripcion,
        fecha_hora: fechaHora,
        duracion_min: duracion,
        meet_link: meetLink || null,
        recurrencia,
        recurrencia_fin: recurrenciaFin || null,
      }),
    });

    setTitulo('');
    setDescripcion('');
    setFecha('');
    setMeetLink('');
    setRecurrencia('none');
    setShowCreate(false);
    setCreating(false);
    loadEvents();
  }

  async function handleDelete(eventId: string) {
    if (!confirm('Eliminar este evento y todas sus repeticiones?')) return;
    await fetch('/api/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    loadEvents();
  }

  function toggleExpand(eventId: string) {
    if (expandedEvent === eventId) {
      setExpandedEvent(null);
    } else {
      setExpandedEvent(eventId);
      loadAttendees(eventId);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        <div className="h-40 bg-jjl-gray-light/50 rounded-xl" />
        <div className="h-40 bg-jjl-gray-light/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-jjl-muted text-sm mt-1">Proximas clases, seminarios y entrenamientos</p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Crear Evento
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <h2 className="font-semibold mb-4">Nuevo Evento</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input id="ev-titulo" label="Titulo" placeholder="Ej: Clase grupal de guardia" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />

            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripcion (opcional)"
              rows={2}
              className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-jjl-muted uppercase tracking-wider font-semibold mb-1 block">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required
                  className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-jjl-red" />
              </div>
              <div>
                <label className="text-[11px] text-jjl-muted uppercase tracking-wider font-semibold mb-1 block">Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                  className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-jjl-red" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-jjl-muted uppercase tracking-wider font-semibold mb-1 block">Duracion (min)</label>
                <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}
                  className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-jjl-red">
                  <option value={30}>30 min</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1:30 hs</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-jjl-muted uppercase tracking-wider font-semibold mb-1 block">Repetir</label>
                <select value={recurrencia} onChange={(e) => setRecurrencia(e.target.value)}
                  className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-jjl-red">
                  <option value="none">No repetir</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            </div>

            {recurrencia !== 'none' && (
              <div>
                <label className="text-[11px] text-jjl-muted uppercase tracking-wider font-semibold mb-1 block">Repetir hasta</label>
                <input type="date" value={recurrenciaFin} onChange={(e) => setRecurrenciaFin(e.target.value)}
                  className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-jjl-red" />
              </div>
            )}

            <Input id="ev-meet" label="Link de Zoom / Meet (opcional)" placeholder="https://meet.google.com/..." value={meetLink} onChange={(e) => setMeetLink(e.target.value)} />

            <div className="flex gap-2">
              <Button type="submit" variant="primary" loading={creating}>Crear Evento</Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Upcoming events */}
      {events.length === 0 && !showCreate ? (
        <Card>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
            <p className="text-jjl-muted">No hay eventos proximos</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const eventDate = new Date(event.fecha_hora);
            const isToday = isSameDay(eventDate, new Date());
            const isExpanded = expandedEvent === event.id;
            const eventAttendees = attendees[event.id] || [];

            return (
              <Card key={event.id} className={isToday ? 'border-jjl-red/30 bg-jjl-red/5' : ''}>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{event.titulo}</h3>
                        {isToday && (
                          <span className="text-[10px] bg-jjl-red/20 text-jjl-red px-2 py-0.5 rounded-full font-bold uppercase">Hoy</span>
                        )}
                        {event.recurrencia !== 'none' && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                            {event.recurrencia === 'weekly' ? 'Semanal' : event.recurrencia === 'biweekly' ? 'Quincenal' : 'Mensual'}
                          </span>
                        )}
                      </div>
                      {event.descripcion && (
                        <p className="text-sm text-jjl-muted mt-1">{event.descripcion}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDelete(event.id)} className="p-1.5 text-jjl-muted hover:text-red-400 rounded-lg hover:bg-red-900/20">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-jjl-muted">
                      <Calendar className="h-4 w-4" />
                      <span className="capitalize">{format(eventDate, "EEE d 'de' MMM", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-jjl-muted">
                      <Clock className="h-4 w-4" />
                      <span>{format(eventDate, 'HH:mm')} hs · {event.duracion_min} min</span>
                    </div>
                    {event.confirmedCount > 0 && (
                      <div className="flex items-center gap-1.5 text-green-400">
                        <Users className="h-4 w-4" />
                        <span>{event.confirmedCount} confirmado{event.confirmedCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Meet link */}
                  {event.meet_link && (
                    <a
                      href={event.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
                    >
                      <Video className="h-4 w-4" />
                      Unirse a la reunion
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* RSVP buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRsvp(event.id, 'confirmed')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        event.myRsvp === 'confirmed'
                          ? 'bg-green-500/20 border-green-500/40 text-green-400'
                          : 'border-jjl-border text-jjl-muted hover:border-green-500/40 hover:text-green-400'
                      }`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {event.myRsvp === 'confirmed' ? 'Confirmado' : 'Asistire'}
                    </button>
                    <button
                      onClick={() => handleRsvp(event.id, 'declined')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        event.myRsvp === 'declined'
                          ? 'bg-red-500/20 border-red-500/40 text-red-400'
                          : 'border-jjl-border text-jjl-muted hover:border-red-500/40 hover:text-red-400'
                      }`}
                    >
                      <XCircle className="h-4 w-4" />
                      No puedo
                    </button>

                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-jjl-muted hover:text-white"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Asistentes
                      <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Attendees list */}
                  {isExpanded && (
                    <div className="border-t border-jjl-border/30 pt-3 space-y-1.5">
                      {eventAttendees.length === 0 ? (
                        <p className="text-xs text-jjl-muted">Nadie confirmo todavia</p>
                      ) : (
                        eventAttendees.map((a) => (
                          <div key={a.userId} className="flex items-center gap-2 text-sm">
                            {a.status === 'confirmed' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                            )}
                            <span className={a.status === 'confirmed' ? 'text-white' : 'text-jjl-muted'}>
                              {a.nombre}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Past events */}
      {pastEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-jjl-muted uppercase tracking-wider mb-3">Eventos pasados</h2>
          <div className="space-y-2">
            {pastEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-jjl-gray-light/20 text-jjl-muted">
                <Calendar className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{event.titulo}</p>
                  <p className="text-xs capitalize">{format(new Date(event.fecha_hora), "d MMM · HH:mm", { locale: es })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

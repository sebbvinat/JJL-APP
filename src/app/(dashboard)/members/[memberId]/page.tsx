'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, BookOpen, Dumbbell, MessageSquare, Trophy, MessageCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface MemberProfile {
  id: string;
  nombre: string;
  cinturon_actual: string;
  puntos: number;
  avatar_url: string | null;
  created_at: string;
  lessonsCompleted: number;
  trainingDays: number;
  postsCount: number;
}

export default function MemberPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/members?id=${memberId}`);
      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
        setIsAdmin(data.isAdmin);
      }
      setLoading(false);
    }
    load();
  }, [memberId]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg mx-auto animate-pulse">
        <div className="h-48 bg-jjl-gray-light/50 rounded-xl" />
        <div className="h-24 bg-jjl-gray-light/50 rounded-xl" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-jjl-muted">Miembro no encontrado</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-jjl-muted hover:text-white text-sm">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      {/* Profile card */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-jjl-red/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col items-center text-center py-4">
          <Avatar src={member.avatar_url} name={member.nombre} size="lg" />
          <h1 className="text-xl font-bold mt-3">{member.nombre}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge belt={member.cinturon_actual} />
            <span className="text-sm text-jjl-muted">{member.puntos} puntos</span>
          </div>
          <p className="text-xs text-jjl-muted mt-2">
            Miembro desde {format(new Date(member.created_at), "MMMM yyyy", { locale: es })}
          </p>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-center py-2">
            <BookOpen className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{member.lessonsCompleted}</p>
            <p className="text-[10px] text-jjl-muted">Lecciones</p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-2">
            <Dumbbell className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{member.trainingDays}</p>
            <p className="text-[10px] text-jjl-muted">Dias entrenados</p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-2">
            <MessageSquare className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{member.postsCount}</p>
            <p className="text-[10px] text-jjl-muted">Posts</p>
          </div>
        </Card>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <Card>
          <h3 className="text-sm font-semibold mb-3">Acciones de Admin</h3>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/${member.id}`)}>
              <Trophy className="h-4 w-4 mr-1.5" /> Ver curso
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/chat')}>
              <MessageCircle className="h-4 w-4 mr-1.5" /> Chat
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/analytics`)}>
              📊 Analytics
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

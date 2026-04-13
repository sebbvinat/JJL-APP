'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import CommentSection from '@/components/community/CommentSection';

const POSTS_DATA: Record<string, {
  author: string;
  belt: string;
  title: string;
  content: string;
  likes: number;
  time: string;
  category: string;
  comments: Array<{ id: string; author: string; belt: string; content: string; time: string; likes: number }>;
}> = {
  '1': {
    author: 'Carlos M.',
    belt: 'blue',
    title: 'Tip para mejorar la guardia cerrada',
    content: 'Descubri que mantener los codos pegados y controlar la postura con los pies en la cadera hace una gran diferencia. Tambien ayuda mucho trabajar el angulo del cuerpo para crear oportunidades de sweep.\n\nLo que me funciono:\n1. Romper la postura inmediatamente\n2. Controlar una manga y el cuello\n3. Usar los pies activamente en la cadera\n4. Buscar el angulo para atacar\n\nAlguien mas tiene tips para mejorar el control desde guardia cerrada?',
    likes: 12,
    time: 'Hace 2h',
    category: 'technique',
    comments: [
      { id: 'c1', author: 'Ana R.', belt: 'purple', content: 'Excelente tip! Yo agrego que el overhook desde guardia cerrada te da muchas opciones de ataque.', time: 'Hace 1h', likes: 3 },
      { id: 'c2', author: 'Pedro G.', belt: 'white', content: 'Gracias por compartir! Voy a probar esto en mi proximo entrenamiento.', time: 'Hace 45min', likes: 1 },
      { id: 'c3', author: 'Maria L.', belt: 'purple', content: 'El angulo es clave. Cuando giras la cadera 30-45 grados se abren muchas posibilidades.', time: 'Hace 30min', likes: 5 },
    ],
  },
  '2': {
    author: 'Maria L.',
    belt: 'purple',
    title: 'Primer torneo completado!',
    content: 'Despues de 3 meses de preparacion, finalmente compete en mi primer torneo. Gane 2 de 3 combates, uno por sumision (triangle!) y otro por puntos.\n\nEl que perdi fue contra una chica con mucha mas experiencia pero aprendi mucho. Los nervios del primer combate fueron intensos pero despues me relaje y pude aplicar lo que entreno.\n\nSuper agradecida con el programa y toda la comunidad que me apoyo!',
    likes: 24,
    time: 'Hace 5h',
    category: 'progress',
    comments: [
      { id: 'c4', author: 'Carlos M.', belt: 'blue', content: 'Felicidades! El primer torneo siempre es especial. Grande!', time: 'Hace 4h', likes: 2 },
      { id: 'c5', author: 'Juan P.', belt: 'white', content: 'Inspirador! Espero poder competir pronto tambien.', time: 'Hace 3h', likes: 1 },
    ],
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  question: 'Pregunta',
  technique: 'Tecnica',
  progress: 'Progreso',
  discussion: 'Discusion',
  competition: 'Competencia',
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  const post = POSTS_DATA[postId];

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-jjl-muted">Post no encontrado</p>
        <button onClick={() => router.push('/community')} className="text-jjl-red hover:underline">
          Volver a Comunidad
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.push('/community')}
        className="flex items-center gap-2 text-jjl-muted hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Comunidad
      </button>

      {/* Post */}
      <Card>
        <div className="flex gap-3 mb-4">
          <Avatar name={post.author} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{post.author}</span>
              <Badge belt={post.belt} />
            </div>
            <span className="text-xs text-jjl-muted">{post.time}</span>
          </div>
        </div>

        <h1 className="text-xl font-bold">{post.title}</h1>
        <div className="mt-3 text-jjl-muted whitespace-pre-line text-sm leading-relaxed">
          {post.content}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-jjl-border">
          <button className="flex items-center gap-1.5 text-jjl-muted hover:text-jjl-red transition-colors text-sm">
            <Heart className="h-4 w-4" />
            {post.likes} likes
          </button>
          <Badge>{CATEGORY_LABELS[post.category]}</Badge>
        </div>
      </Card>

      {/* Comments */}
      <Card>
        <CommentSection comments={post.comments} />
      </Card>
    </div>
  );
}

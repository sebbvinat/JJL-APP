'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Heart, Plus } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import PostForm from '@/components/community/PostForm';

const INITIAL_POSTS = [
  {
    id: '1',
    author: 'Carlos M.',
    belt: 'blue',
    title: 'Tip para mejorar la guardia cerrada',
    content: 'Descubri que mantener los codos pegados y controlar la postura con los pies en la cadera hace una gran diferencia. Tambien ayuda mucho trabajar el angulo del cuerpo para crear oportunidades de sweep. Alguien mas tiene tips para mejorar el control desde guardia cerrada?',
    likes: 12,
    comments: 5,
    time: 'Hace 2h',
    category: 'technique',
  },
  {
    id: '2',
    author: 'Maria L.',
    belt: 'purple',
    title: 'Primer torneo completado!',
    content: 'Despues de 3 meses de preparacion, finalmente compete en mi primer torneo. Gane 2 de 3 combates, uno por sumision (triangle!) y otro por puntos. El que perdi fue contra una chica con mucha mas experiencia pero aprendi mucho. Super agradecida con el programa!',
    likes: 24,
    comments: 8,
    time: 'Hace 5h',
    category: 'progress',
  },
  {
    id: '3',
    author: 'Juan P.',
    belt: 'white',
    title: 'Duda sobre pase de guardia',
    content: 'Tengo problemas para pasar la guardia abierta, especialmente cuando mi oponente tiene grips en mis mangas. Alguien tiene consejos para principiantes? Que pase recomiendan aprender primero?',
    likes: 6,
    comments: 12,
    time: 'Hace 1d',
    category: 'question',
  },
  {
    id: '4',
    author: 'Roberto S.',
    belt: 'brown',
    title: 'Analisis de mi lucha en el panamericano',
    content: 'Subi mi video del panamericano a la plataforma. Me gustaria que me den feedback sobre mi juego de guardia. Siento que me estan pasando mucho por el lado derecho. Alguna sugerencia?',
    likes: 18,
    comments: 15,
    time: 'Hace 2d',
    category: 'competition',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  question: 'Pregunta',
  technique: 'Tecnica',
  progress: 'Progreso',
  discussion: 'Discusion',
  competition: 'Competencia',
};

const CATEGORIES = ['all', 'question', 'technique', 'progress', 'discussion', 'competition'];
const CATEGORY_DISPLAY = ['Todos', 'Preguntas', 'Tecnicas', 'Progreso', 'Discusion', 'Competencia'];

export default function CommunityPage() {
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredPosts = activeCategory === 'all'
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  const handleNewPost = (data: { titulo: string; contenido: string; categoria: string }) => {
    setPosts([
      {
        id: `new-${Date.now()}`,
        author: 'Tu',
        belt: 'blue',
        title: data.titulo,
        content: data.contenido,
        likes: 0,
        comments: 0,
        time: 'Ahora',
        category: data.categoria,
      },
      ...posts,
    ]);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comunidad</h1>
          <p className="text-jjl-muted mt-1">Comparte y aprende con otros guerreros</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Post
        </Button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-jjl-red text-white'
                : 'bg-jjl-gray-light border border-jjl-border text-jjl-muted hover:text-white hover:border-jjl-red/40'
            }`}
          >
            {CATEGORY_DISPLAY[i]}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <Link key={post.id} href={`/community/${post.id}`}>
            <Card hover className="mb-4">
              <div className="flex gap-3">
                <Avatar name={post.author} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{post.author}</span>
                    <Badge belt={post.belt} />
                    <span className="text-xs text-jjl-muted">{post.time}</span>
                  </div>
                  <h3 className="font-bold mt-1.5">{post.title}</h3>
                  <p className="text-sm text-jjl-muted mt-1 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-jjl-muted text-sm">
                      <Heart className="h-4 w-4" />
                      {post.likes}
                    </span>
                    <span className="flex items-center gap-1.5 text-jjl-muted text-sm">
                      <MessageCircle className="h-4 w-4" />
                      {post.comments}
                    </span>
                    <Badge>{CATEGORY_LABELS[post.category] || post.category}</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {showForm && <PostForm onClose={() => setShowForm(false)} onSubmit={handleNewPost} />}
    </div>
  );
}

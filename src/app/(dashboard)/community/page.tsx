'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { MessageCircle, Heart, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PostForm from '@/components/community/PostForm';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Post {
  id: string;
  autor: string;
  avatar_url: string | null;
  cinturon: string;
  titulo: string;
  contenido: string;
  categoria: string;
  likes: number;
  comments: number;
  liked: boolean;
  isOwner: boolean;
  canDelete: boolean;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  question: 'Pregunta',
  technique: 'Tecnica',
  progress: 'Progreso',
  discussion: 'Discusion',
  competition: 'Competencia',
  offtopic: 'Off Topic',
};

const CATEGORIES = [
  'all',
  'question',
  'technique',
  'progress',
  'discussion',
  'competition',
  'offtopic',
];
const CATEGORY_DISPLAY = [
  'Todos',
  'Preguntas',
  'Tecnicas',
  'Progreso',
  'Discusion',
  'Competencia',
  'Off Topic',
];

export default function CommunityPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [likingId, setLikingId] = useState<string | null>(null);
  const toast = useToast();

  const postsKey = `/api/community/posts?category=${activeCategory}`;
  const { data, isLoading, mutate } = useSWR<{ posts: Post[] }>(postsKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
  const posts = data?.posts || [];

  async function handleNewPost(form: { titulo: string; contenido: string; categoria: string }) {
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        mutate();
        toast.success('Post publicado');
      } else {
        toast.error('No pudimos publicar el post');
      }
    } catch (err) {
      logger.error('community.createPost.failed', { err });
      toast.error('Error de conexion');
    }
  }

  async function handleLike(postId: string) {
    if (!data) return;
    setLikingId(postId);
    const prev = data.posts;
    mutate(
      {
        posts: prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
            : p
        ),
      },
      { revalidate: false }
    );
    try {
      await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
    } catch (err) {
      logger.error('community.like.failed', { err, postId });
      mutate({ posts: prev }, { revalidate: false });
    }
    setLikingId(null);
  }

  function timeAgo(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
            Equipo
          </p>
          <h1 className="text-3xl font-black tracking-tight">Comunidad</h1>
          <p className="text-sm text-jjl-muted mt-1.5">
            Comparti, preguntá, celebrá. Cada post fortalece al equipo.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Nuevo Post
        </Button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`snap-start px-3.5 h-8 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all duration-150 border ${
              activeCategory === cat
                ? 'bg-jjl-red text-white border-jjl-red shadow-[0_6px_20px_-6px_rgba(220,38,38,0.5)]'
                : 'bg-white/[0.03] border-jjl-border text-jjl-muted hover:text-white hover:border-jjl-border-strong'
            }`}
          >
            {CATEGORY_DISPLAY[i]}
          </button>
        ))}
      </div>

      {/* Posts */}
      {isLoading && !data ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          tone="red"
          title="La comunidad te espera"
          description="Se el primero en compartir una tecnica, hacer una pregunta o celebrar tu progreso."
          action={{ label: 'Crear el primer post', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block animate-fade-in"
            >
              <Card hover>
                <div className="flex gap-3">
                  <Avatar src={post.avatar_url} name={post.autor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">{post.autor}</span>
                      <Badge belt={post.cinturon} />
                      <span className="text-xs text-jjl-muted/70">{timeAgo(post.createdAt)}</span>
                    </div>
                    <h3 className="font-bold mt-1.5 text-white text-[15px] leading-snug text-balance">
                      {post.titulo}
                    </h3>
                    <p className="text-[13px] text-jjl-muted mt-1 line-clamp-2 leading-relaxed">
                      {post.contenido}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLike(post.id);
                        }}
                        disabled={likingId === post.id}
                        className={`flex items-center gap-1.5 text-[13px] transition-colors ${
                          post.liked ? 'text-red-400' : 'text-jjl-muted hover:text-red-400'
                        }`}
                      >
                        <Heart className="h-4 w-4" fill={post.liked ? 'currentColor' : 'none'} />
                        {post.likes}
                      </button>
                      <span className="flex items-center gap-1.5 text-jjl-muted text-[13px]">
                        <MessageCircle className="h-4 w-4" />
                        {post.comments}
                      </span>
                      <span className="ml-auto inline-flex items-center h-6 px-2 rounded-md bg-white/[0.04] border border-jjl-border text-[10px] font-semibold uppercase tracking-wider text-jjl-muted">
                        {CATEGORY_LABELS[post.categoria] || post.categoria}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showForm && <PostForm onClose={() => setShowForm(false)} onSubmit={handleNewPost} />}
    </div>
  );
}

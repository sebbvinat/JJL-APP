'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageCircle, Heart, Plus, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import PostForm from '@/components/community/PostForm';

interface Post {
  id: string;
  autor: string;
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
};

const CATEGORIES = ['all', 'question', 'technique', 'progress', 'discussion', 'competition'];
const CATEGORY_DISPLAY = ['Todos', 'Preguntas', 'Tecnicas', 'Progreso', 'Discusion', 'Competencia'];

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [likingId, setLikingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [activeCategory]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts?category=${activeCategory}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {}
    setLoading(false);
  }

  async function handleNewPost(data: { titulo: string; contenido: string; categoria: string }) {
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        fetchPosts();
      }
    } catch {}
  }

  async function handleLike(postId: string) {
    setLikingId(postId);
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );

    try {
      await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
            : p
        )
      );
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
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-jjl-muted" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
            <p className="text-jjl-muted">No hay posts todavia. Se el primero!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id}>
              <Link href={`/community/${post.id}`}>
                <Card hover className="mb-0">
                  <div className="flex gap-3">
                    <Avatar name={post.autor} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{post.autor}</span>
                        <Badge belt={post.cinturon} />
                        <span className="text-xs text-jjl-muted">{timeAgo(post.createdAt)}</span>
                      </div>
                      <h3 className="font-bold mt-1.5">{post.titulo}</h3>
                      <p className="text-sm text-jjl-muted mt-1 line-clamp-2">{post.contenido}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleLike(post.id);
                          }}
                          disabled={likingId === post.id}
                          className={`flex items-center gap-1.5 text-sm transition-colors ${
                            post.liked ? 'text-red-400' : 'text-jjl-muted hover:text-red-400'
                          }`}
                        >
                          <Heart className="h-4 w-4" fill={post.liked ? 'currentColor' : 'none'} />
                          {post.likes}
                        </button>
                        <span className="flex items-center gap-1.5 text-jjl-muted text-sm">
                          <MessageCircle className="h-4 w-4" />
                          {post.comments}
                        </span>
                        <Badge>{CATEGORY_LABELS[post.categoria] || post.categoria}</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}

      {showForm && <PostForm onClose={() => setShowForm(false)} onSubmit={handleNewPost} />}
    </div>
  );
}

export type BeltLevel = 'white' | 'blue' | 'purple' | 'brown' | 'black';
export type UserRole = 'admin' | 'alumno';
export type PostCategory =
  | 'question'
  | 'technique'
  | 'progress'
  | 'discussion'
  | 'competition'
  | 'offtopic';
export type NotificationType = 'belt' | 'module' | 'streak' | 'achievement' | 'system';
export type FatigaLevel = 'verde' | 'amarillo' | 'rojo';
export type IntensidadLevel = 'baja' | 'media' | 'alta';

// ---- Row types (what you get from a SELECT) ----

export interface User {
  id: string;
  nombre: string;
  email: string | null;
  cinturon_actual: BeltLevel;
  puntos: number;
  rol: UserRole;
  avatar_url: string | null;
  planilla_id: string | null;
  created_at: string;
  updated_at: string;
  onboarding_step: number;
  onboarding_completed_at: string | null;
}

export interface Module {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  titulo: string;
  youtube_id: string;
  descripcion: string | null;
  orden: number;
  duracion: string | null;
  created_at: string;
}

export interface UserProgress {
  user_id: string;
  lesson_id: string;
  completado: boolean;
  completed_at: string | null;
}

export interface UserAccess {
  user_id: string;
  module_id: string;
  is_unlocked: boolean;
  unlocked_at: string | null;
}

export interface DailyTask {
  id: string;
  user_id: string;
  fecha: string;
  entreno_check: boolean;
  feedback_texto: string | null;
  fatiga: FatigaLevel | null;
  intensidad: IntensidadLevel | null;
  objetivo: string | null;
  objetivo_cumplido: boolean | null;
  regla: string | null;
  regla_cumplida: boolean | null;
  puntaje: number | null;
  observaciones: string | null;
  aprendizajes: string | null;
  notas: string | null;
  meta_entreno: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  titulo: string;
  contenido: string;
  categoria: PostCategory;
  likes_count: number;
  created_at: string;
  updated_at: string;
  // joined
  author?: User;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  contenido: string;
  likes_count: number;
  created_at: string;
  // joined
  author?: User;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
}

export interface VideoUpload {
  id: string;
  user_id: string;
  titulo: string;
  descripcion: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  tags: string[] | null;
  file_size: number | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

export interface CourseLessonJSON {
  id: string;
  tipo?: string;
  titulo?: string;
  youtube_id?: string;
  orden?: number;
}

export interface CourseData {
  user_id: string;
  module_id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string | null;
  lessons: CourseLessonJSON[];
  created_at: string;
  updated_at: string;
}

// ---- Database type for Supabase client ----

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Partial<User> & { id: string; nombre: string };
        Update: Partial<User>;
      };
      modules: {
        Row: Module;
        Insert: Omit<Module, 'id' | 'created_at'>;
        Update: Partial<Omit<Module, 'id'>>;
      };
      lessons: {
        Row: Lesson;
        Insert: Omit<Lesson, 'id' | 'created_at'>;
        Update: Partial<Omit<Lesson, 'id'>>;
      };
      user_progress: {
        Row: UserProgress;
        Insert: Omit<UserProgress, 'completed_at'>;
        Update: Partial<UserProgress>;
      };
      user_access: {
        Row: UserAccess;
        Insert: Omit<UserAccess, 'unlocked_at'>;
        Update: Partial<UserAccess>;
      };
      daily_tasks: {
        Row: DailyTask;
        Insert: Omit<DailyTask, 'id' | 'created_at'>;
        Update: Partial<Omit<DailyTask, 'id'>>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'likes_count' | 'author'>;
        Update: Partial<Omit<Post, 'id' | 'author'>>;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, 'id' | 'created_at' | 'likes_count' | 'author'>;
        Update: Partial<Omit<Comment, 'id' | 'author'>>;
      };
      likes: {
        Row: Like;
        Insert: Omit<Like, 'id' | 'created_at'>;
        Update: never;
      };
      video_uploads: {
        Row: VideoUpload;
        Insert: Omit<VideoUpload, 'id' | 'created_at'>;
        Update: Partial<Omit<VideoUpload, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'leido'> & { leido?: boolean };
        Update: Partial<Omit<Notification, 'id'>>;
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: Omit<PushSubscription, 'id' | 'created_at'>;
        Update: Partial<Omit<PushSubscription, 'id'>>;
      };
      course_data: {
        Row: CourseData;
        Insert: Omit<CourseData, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CourseData, 'user_id' | 'module_id'>>;
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}

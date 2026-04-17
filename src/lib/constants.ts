import {
  LayoutDashboard,
  BookOpen,
  Users,
  Upload,
  User,
  Shield,
  NotebookPen,
  CalendarCheck,
  CalendarDays,
  Library,
  Trophy,
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Diario', href: '/journal', icon: NotebookPen },
  { label: 'Eventos', href: '/events', icon: CalendarDays },
  { label: 'Semana', href: '/weekly', icon: CalendarCheck },
  { label: 'Competencias', href: '/competitions', icon: Trophy },
  { label: 'Biblioteca', href: '/library', icon: Library },
  { label: 'Modulos', href: '/modules', icon: BookOpen },
  { label: 'Comunidad', href: '/community', icon: Users },
  { label: 'Subir Video', href: '/upload', icon: Upload },
  { label: 'Perfil', href: '/profile', icon: User },
] as const;

export const ADMIN_NAV = [
  { label: 'Admin', href: '/admin', icon: Shield },
] as const;

export const BELT_COLORS: Record<string, string> = {
  white: '#FFFFFF',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  brown: '#92400E',
  black: '#111111',
};

export const BELT_LABELS: Record<string, string> = {
  white: 'Blanco',
  blue: 'Azul',
  purple: 'Purpura',
  brown: 'Marron',
  black: 'Negro',
};

export const BELT_PROGRESSION = [
  { key: 'white', week: 0 },
  { key: 'blue', week: 4 },
  { key: 'purple', week: 8 },
  { key: 'brown', week: 16 },
  { key: 'black', week: 24 },
] as const;

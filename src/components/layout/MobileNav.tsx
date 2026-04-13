'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LayoutDashboard, BookOpen, Users, NotebookPen, User } from 'lucide-react';

const MOBILE_ITEMS = [
  { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Diario', href: '/journal', icon: NotebookPen },
  { label: 'Modulos', href: '/modules', icon: BookOpen },
  { label: 'Social', href: '/community', icon: Users },
  { label: 'Perfil', href: '/profile', icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-jjl-gray border-t border-jjl-border z-40 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {MOBILE_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]',
                isActive ? 'text-jjl-red' : 'text-jjl-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

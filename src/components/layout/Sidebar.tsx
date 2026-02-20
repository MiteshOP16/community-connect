import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, PenSquare, MessageCircle, User, LogOut, Search, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/create', icon: PenSquare, label: 'Create' },
  { to: '/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/connect', icon: Users, label: 'Connect' },
  { to: '/search', icon: Search, label: 'Search' },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar hidden lg:flex flex-col"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary glow-primary">
          <span className="text-lg font-bold text-primary-foreground">C</span>
        </div>
        <span className="text-xl font-bold text-foreground">Community</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile */}
      {profile && (
        <div className="border-t border-sidebar-border p-4">
          <NavLink
            to={`/profile/${profile.username}`}
            className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:bg-sidebar-accent"
          >
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">
                @{profile.username}
              </p>
            </div>
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="mt-2 w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      )}
    </motion.aside>
  );
}

export function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border flex items-center justify-around h-16 px-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.icon className={cn('h-5 w-5', isActive && 'animate-scale-in text-primary')} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </NavLink>
        );
      })}
      {profile && (
        <NavLink
          to={`/profile/${profile.username}`}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
            location.pathname.startsWith(`/profile/${profile.username}`) ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Avatar className="h-5 w-5 border border-primary/20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>{profile.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
        </NavLink>
      )}
    </div>
  );
}

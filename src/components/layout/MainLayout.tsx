import { ReactNode } from 'react';
import { Sidebar, BottomNav } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Navigate } from 'react-router-dom';

export default function AuthPage() {
  const { profile, loading, signInWithGitHub } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profile) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary glow-primary">
            <span className="text-3xl font-bold text-primary-foreground">C</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Community</h1>
          <p className="mt-2 text-muted-foreground">
            Connect, share, and chat with your community
          </p>
          <Button
            onClick={signInWithGitHub}
            className="mt-8 w-full gap-3 bg-foreground text-background hover:bg-foreground/90"
            size="lg"
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            By signing in, you agree to our terms of service
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

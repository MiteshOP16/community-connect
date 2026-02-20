import { useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, Profile } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function getProfile(userId: string) {
            if (!mounted) return null;
            console.log('[Auth] Fetching profile...');
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('[Auth] Fetch error:', error);
                return null;
            }
            return data as Profile | null;
        }

        async function createProfile(u: User) {
            if (!mounted) return null;
            console.log('[Auth] Creating profile...');
            const meta = u.user_metadata;
            const username = meta?.user_name || meta?.preferred_username || u.email?.split('@')[0] || 'user';

            const { data, error } = await supabase
                .from('profiles')
                .insert({
                    user_id: u.id,
                    username: `${username}_${Date.now().toString(36).slice(-4)}`,
                    avatar_url: meta?.avatar_url || null,
                    github_id: meta?.provider_id || null,
                    bio: '',
                })
                .select()
                .single();

            if (error) {
                console.error('[Auth] Create error:', error);
                return null;
            }
            return data as Profile;
        }

        async function initialize(currentSession: Session | null) {
            if (!mounted) return;

            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (currentSession?.user) {
                let p = await getProfile(currentSession.user.id);
                if (!p && mounted) {
                    p = await createProfile(currentSession.user);
                }
                if (mounted) setProfile(p);
            } else {
                setProfile(null);
            }

            if (mounted) setLoading(false);
        }

        supabase.auth.getSession().then(({ data: { session: s } }) => {
            initialize(s);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            initialize(s);
        });

        const timeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('[Auth] Safety timeout triggered');
                setLoading(false);
            }
        }, 3000);

        return () => {
            mounted = false;
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const signInWithGitHub = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: { redirectTo: `${window.location.origin}/` },
        });
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
    };

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!profile) return;
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', profile.id)
            .select()
            .single();
        if (error) throw error;
        setProfile(data as Profile);
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signInWithGitHub, signOut, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

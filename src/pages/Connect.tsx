import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Profile, getRecommendedProfiles } from '@/lib/profiles';
import {
    getMutualFollowers,
    getFollowers,
    getFollowing,
    followUser,
    cancelFollowRequest,
    getFollowRequests,
    getSentRequests,
    handleFollowRequest,
    unfollowUser,
    type FollowRequest
} from '@/lib/follows';
import { getOrCreateConversation } from '@/lib/chat';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Bell, Check, X as CloseX, Users, Send, Loader2, Sparkles, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function ConnectPage() {
    const { profile: currentUser } = useAuth();
    const navigate = useNavigate();
    const [incomingRequests, setIncomingRequests] = useState<FollowRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<FollowRequest[]>([]);
    const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
    const [followingUsers, setFollowingUsers] = useState<any[]>([]);
    const [suggestedUsers, setSuggestedUsers] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [actionId, setActionId] = useState<string | null>(null);

    // Safety net for sent requests that might be slow to show up
    const optimisticSent = useRef<Set<string>>(new Set());

    const loadData = async (isBackground = false) => {
        if (!currentUser) return;
        if (!isBackground) setIsLoading(true);
        else setIsSyncing(true);

        console.log('[Connect] Loading data...');
        try {
            // Run core data fetches first
            const [incoming, sent, mutuals, followingList, followersList] = await Promise.all([
                getFollowRequests(currentUser.id).catch(e => { console.error('getFollowRequests error:', e); return []; }),
                getSentRequests(currentUser.id).catch(e => { console.error('getSentRequests error:', e); return []; }),
                getMutualFollowers(currentUser.id).catch(e => { console.error('getMutualFollowers error:', e); return []; }),
                getFollowing(currentUser.id).catch(e => { console.error('getFollowing error:', e); return []; }),
                getFollowers(currentUser.id).catch(e => { console.error('getFollowers error:', e); return []; }),
            ]);

            // Fetch recommendations separately to avoid blocking core UI
            let recs: Profile[] = [];
            try {
                recs = await getRecommendedProfiles(currentUser.id, 20);
            } catch (e) {
                console.error('[Connect] Recommendations error:', e);
            }

            setIncomingRequests(incoming);
            setSentRequests(sent);
            setConnectedUsers(mutuals);

            const mutualIds = new Set(mutuals.map(m => m.id));
            const followingIds = new Set(followingList.map(f => f?.id));
            const followerIds = new Set(followersList.map(f => f?.id));

            setFollowingUsers(followingList.filter(f => f && !mutualIds.has(f.id)));

            // Update optimistic list: remove items that are now confirmed in DB
            const dbSentIds = new Set(sent.map(s => s.receiver_id));
            Array.from(optimisticSent.current).forEach(id => {
                if (dbSentIds.has(id) || followingIds.has(id) || followerIds.has(id)) {
                    optimisticSent.current.delete(id);
                }
            });

            const sentRequestIds = new Set([...sent.map(s => s.receiver_id), ...Array.from(optimisticSent.current)]);
            const incomingIds = new Set(incoming.map(i => i.sender_id));

            console.log('[Connect] Debug Counts:', {
                recs: recs.length,
                following: followingIds.size,
                followers: followerIds.size,
                sent: sentRequestIds.size,
                incoming: incomingIds.size,
                mutuals: mutualIds.size
            });

            const filtered = recs.filter(r => {
                const isMe = r.id === currentUser.id;
                const isFollowing = followingIds.has(r.id);
                const isFollower = followerIds.has(r.id);
                const isSent = sentRequestIds.has(r.id);
                const isIncoming = incomingIds.has(r.id);

                return !isMe && !isFollowing && !isFollower && !isSent && !isIncoming;
            });

            console.log('[Connect] Final suggested count:', filtered.length);
            setSuggestedUsers(filtered);
        } catch (err) {
            console.error('[Connect] Critical sync error:', err);
            toast.error('Failed to sync connection data');
        } finally {
            setIsLoading(false);
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (!currentUser?.id) return;
        loadData();

        const channel = supabase.channel(`connect-realtime-${currentUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_requests' }, () => {
                loadData(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => loadData(true))
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id]);

    const runAction = async (id: string, actionName: string, action: () => Promise<void>) => {
        if (actionId) return;
        setActionId(id);

        try {
            await action();
            // Wait longer for RLS propagation
            await new Promise(r => setTimeout(r, 1500));
            await loadData(true);
        } catch (error: any) {
            console.error(`[Connect] ${actionName} error:`, error);
            // Rollback optimistic state if applicable
            if (actionName === 'Follow') {
                optimisticSent.current.delete(id);
                loadData(true);
            }
            const msg = error.message || 'Action failed';
            if (msg.includes('policy')) {
                toast.error('Permission denied. Please check your database settings.');
            } else {
                toast.error(msg);
            }
        } finally {
            setActionId(null);
        }
    };

    const handleFollow = (user: Profile) => {
        // Mark as optimistic immediately
        optimisticSent.current.add(user.id);

        runAction(user.id, 'Follow', async () => {
            await followUser(currentUser!.id, user.id);
            toast.success(`Request sent to @${user.username}`);
        });
    };

    const handleCancel = (receiverId: string) => {
        optimisticSent.current.delete(receiverId);
        runAction(receiverId, 'Cancel', async () => {
            await cancelFollowRequest(currentUser!.id, receiverId);
            toast.success('Request cancelled');
        });
    };

    // ... handleUnfollow and handleResponse remain same logic but using runAction

    const handleUnfollow = (targetId: string) => {
        runAction(targetId, 'Unfollow', async () => {
            await unfollowUser(currentUser!.id, targetId);
            toast.success('Unfollowed');
        });
    };

    const handleResponse = (requestId: string, status: 'accepted' | 'rejected') => {
        runAction(requestId, 'Response', async () => {
            await handleFollowRequest(requestId, status);
            toast.success(status === 'accepted' ? 'Accepted' : 'Declined');
        });
    };

    const handleMessage = async (user: any) => {
        if (!currentUser) return;
        try {
            const conversation = await getOrCreateConversation(currentUser.id, user.id);
            navigate('/messages', {
                state: {
                    conversationId: conversation.id,
                    otherUser: {
                        id: user.id,
                        username: user.username,
                        avatar_url: user.avatar_url
                    }
                },
                replace: true
            });
        } catch (error) {
            console.error('[Connect] Message error:', error);
            toast.error('Failed to start conversation');
        }
    };

    return (
        <MainLayout>
            <div className="mx-auto max-w-4xl space-y-8 pb-20 px-4">
                <header className="flex items-center justify-between border-b border-border/50 pb-6 mt-6">
                    <div>
                        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-foreground">
                            Connect <Sparkles className="h-5 w-5 text-primary" />
                        </h1>
                        <p className="mt-1 text-muted-foreground">Building your community network.</p>
                    </div>
                    {isSyncing && <div className="flex items-center gap-2 text-[10px] text-primary animate-pulse bg-primary/5 px-3 py-1 rounded-full border border-primary/20">
                        <RefreshCcw className="h-3 w-3 animate-spin" /> SYNCING STATUS
                    </div>}
                </header>

                {/* Incoming Requests */}
                {incomingRequests.length > 0 && (
                    <section className="space-y-4 rounded-3xl bg-primary/5 p-6 ring-1 ring-primary/20">
                        <div className="flex items-center gap-3 text-primary">
                            <Bell className="h-6 w-6" />
                            <h2 className="text-xl font-bold">Follow Requests</h2>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {incomingRequests.map((req) => (
                                <Card key={req.id} className="glass-card flex items-center justify-between p-4 border-primary/20">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                            <AvatarImage src={req.sender?.avatar_url || undefined} />
                                            <AvatarFallback>{req.sender?.username?.[0]?.toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <Link to={`/profile/${req.sender?.username}`} className="font-bold hover:underline block truncate">@{req.sender?.username}</Link>
                                            <p className="text-[10px] text-muted-foreground">sent you a request</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {actionId === req.id ? <Loader2 className="h-5 w-5 animate-spin text-primary m-2" /> : (
                                            <>
                                                <Button size="sm" className="h-8 w-8 p-0" onClick={() => handleResponse(req.id, 'accepted')}><Check className="h-4 w-4" /></Button>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleResponse(req.id, 'rejected')}><CloseX className="h-4 w-4" /></Button>
                                            </>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {/* Sent Requests - At the top for high visibility */}
                {sentRequests.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground ml-2">
                            <Send className="h-4 w-4" />
                            <h2 className="text-sm font-semibold uppercase">Pending Sent</h2>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {sentRequests.map((req) => (
                                <Card key={req.id} className="glass-card flex items-center justify-between p-3 border-dashed border-primary/30">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Avatar className="h-9 w-9 flex-shrink-0">
                                            <AvatarImage src={req.receiver?.avatar_url || undefined} />
                                            <AvatarFallback>{req.receiver?.username?.[0]?.toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <Link to={`/profile/${req.receiver?.username}`} className="font-bold text-sm block">@{req.receiver?.username}</Link>
                                            <p className="text-[10px] text-primary animate-pulse font-medium">Requested...</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => handleCancel(req.receiver_id)} disabled={actionId === req.receiver_id}>
                                        {actionId === req.receiver_id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {/* Connected Mutuals */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <UserCheck className="h-6 w-6" />
                        <h2 className="text-xl font-bold">Connected</h2>
                    </div>
                    {connectedUsers.length === 0 && !isLoading ? (
                        <Card className="rounded-3xl border-2 border-dashed border-border/50 p-12 text-center bg-transparent shadow-none">
                            <p className="text-muted-foreground">Your mutual friends will appear here.</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {connectedUsers.map((user) => (
                                <Card key={user.id} className="glass-card flex items-center justify-between p-4 border-primary/10">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Avatar className="h-12 w-12 border-2 border-primary/20"><AvatarImage src={user.avatar_url || undefined} /><AvatarFallback>{user.username?.[0]}</AvatarFallback></Avatar>
                                        <div className="min-w-0">
                                            <Link to={`/profile/${user.username}`} className="font-bold hover:underline block">@{user.username}</Link>
                                            <p className="text-xs text-muted-foreground truncate">{user.bio || 'Connected'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" className="h-8" onClick={() => handleMessage(user)}>Message</Button>
                                        <Button variant="ghost" size="sm" className="h-8" onClick={() => handleUnfollow(user.id)} disabled={actionId === user.id}>Disconnect</Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                {/* Following (One-way) */}
                {followingUsers.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground ml-2">
                            <UserCheck className="h-4 w-4" />
                            <h2 className="text-sm font-semibold uppercase">People You Follow</h2>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {followingUsers.map((user) => (
                                <Card key={user.id} className="glass-card flex items-center justify-between p-4 border-primary/10">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                            <AvatarImage src={user.avatar_url || undefined} />
                                            <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <Link to={`/profile/${user.username}`} className="font-bold text-sm block">@{user.username}</Link>
                                            <p className="text-[10px] text-muted-foreground truncate">Waiting for follow back</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8" onClick={() => handleUnfollow(user.id)} disabled={actionId === user.id}>
                                        {actionId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Unfollow'}
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {/* Discover suggestions */}
                <section className="space-y-6 pt-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Users className="h-6 w-6" />
                        <h2 className="text-xl font-bold">Discover</h2>
                    </div>
                    {isLoading && suggestedUsers.length === 0 ? <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary/40" /></div> : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {suggestedUsers.map((user) => (
                                <Card key={user.id} className="glass-card group flex flex-col items-center p-6 text-center hover:bg-primary/5 transition-all">
                                    <Avatar className="h-20 w-20 ring-4 ring-background transition-transform group-hover:scale-105 shadow-xl">
                                        <AvatarImage src={user.avatar_url || undefined} /><AvatarFallback>{user.username?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="mt-5 w-full">
                                        <Link to={`/profile/${user.username}`} className="font-bold text-lg hover:underline block truncate">@{user.username}</Link>
                                        <p className="mt-2 text-sm text-muted-foreground h-10 line-clamp-2">{user.bio || 'New member'}</p>
                                    </div>
                                    <Button onClick={() => handleFollow(user)} disabled={actionId === user.id} className="mt-6 w-full gap-2 shadow-lg shadow-primary/10">
                                        {actionId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Connect</>}
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </MainLayout>
    );
}

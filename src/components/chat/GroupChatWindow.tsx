import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Users, UserPlus, X, Info, Search, MoreVertical } from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { GroupMessage, getGroupMessages, sendGroupMessage, subscribeToGroupMessages, getGroupMembers, addGroupMember, GroupMember } from '@/lib/groups';
import { markAsRead } from '@/lib/chat';
import { searchProfiles, Profile } from '@/lib/profiles';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GroupChatWindowProps {
    groupId: string;
    groupName: string;
    groupAvatar: string | null;
}

export function GroupChatWindow({ groupId, groupName, groupAvatar }: GroupChatWindowProps) {
    const { profile } = useAuth();
    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isAdmin = members.some(m => m.profile_id === profile?.id && m.role === 'admin');

    const scrollToBottom = (smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const [msgData, memData] = await Promise.all([
                    getGroupMessages(groupId),
                    getGroupMembers(groupId)
                ]);
                setMessages(msgData);
                setMembers(memData);
                if (profile) markAsRead(profile.id, undefined, groupId);
            } catch (error) {
                console.error('Error loading group data:', error);
            } finally {
                setIsLoading(false);
                setTimeout(() => scrollToBottom(false), 100);
            }
        };

        loadData();

        const channel = subscribeToGroupMessages(groupId, (message) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
            if (profile && message.sender_id !== profile.id) {
                markAsRead(profile.id, undefined, groupId);
            }
        });

        return () => {
            channel.unsubscribe();
        };
    }, [groupId, profile]);

    useEffect(() => {
        const search = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }
            try {
                const results = await searchProfiles(searchQuery);
                const filtered = results.filter(p => !members.some(m => m.profile_id === p.id));
                setSearchResults(filtered);
            } catch (error) {
                console.error('Search error:', error);
            }
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, members]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!profile || !newMessage.trim() || isSending) return;

        const content = newMessage.trim();
        setNewMessage('');

        // Optimistic Update
        const tempId = crypto.randomUUID();
        const optimisticMsg: GroupMessage = {
            id: tempId,
            group_id: groupId,
            sender_id: profile.id,
            content,
            created_at: new Date().toISOString(),
            sender: {
                id: profile.id,
                username: profile.username || 'me',
                avatar_url: profile.avatar_url,
            }
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setIsSending(true);

        try {
            const savedMsg = await sendGroupMessage(groupId, profile.id, content);
            setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
        } catch (error) {
            console.error('Error sending group message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(content);
            toast.error('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    const handleAddMember = async (targetProfileId: string) => {
        try {
            await addGroupMember(groupId, targetProfileId);
            const updatedMembers = await getGroupMembers(groupId);
            setMembers(updatedMembers);
            setSearchQuery('');
            setSearchResults([]);
            setShowAddMember(false);
            toast.success('Member added successfully');
        } catch (error) {
            console.error('Error adding member:', error);
            toast.error('Failed to add member');
        }
    };

    const groupMessagesByDate = (msgs: GroupMessage[]) => {
        const groups: { [key: string]: GroupMessage[] } = {};
        msgs.forEach(m => {
            const date = format(new Date(m.created_at), 'yyyy-MM-dd');
            if (!groups[date]) groups[date] = [];
            groups[date].push(m);
        });
        return groups;
    };

    const formatHeaderDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'MMMM d, yyyy');
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-background/50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    const groupedMessages = groupMessagesByDate(messages);

    return (
        <div className="flex h-full relative overflow-hidden bg-background">
            <div className="flex flex-1 flex-col border-r border-border/50">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/50 p-4 bg-background/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
                            <AvatarImage src={groupAvatar || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                                <Users className="h-5 w-5" />
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-foreground truncate max-w-[150px] sm:max-w-[300px]">{groupName}</p>
                            <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">
                                {members.length} {members.length === 1 ? 'Member' : 'Members'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {isAdmin && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("rounded-full h-9 w-9", showAddMember && "bg-primary/10 text-primary")}
                                onClick={() => { setShowAddMember(!showAddMember); setShowInfo(false); }}
                            >
                                <UserPlus className="h-5 w-5" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("rounded-full h-9 w-9", showInfo && "bg-primary/10 text-primary")}
                            onClick={() => { setShowInfo(!showInfo); setShowAddMember(false); }}
                        >
                            <Info className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
                    {Object.entries(groupedMessages).map(([date, msgs]) => (
                        <div key={date} className="space-y-6">
                            <div className="flex justify-center">
                                <span className="px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-sm text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border/50 shadow-sm">
                                    {formatHeaderDate(date)}
                                </span>
                            </div>
                            {msgs.map((message) => {
                                const isOwn = message.sender_id === profile?.id;
                                return (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn('flex gap-2.5 px-1 group', isOwn && 'flex-row-reverse')}
                                    >
                                        <Avatar className="h-8 w-8 mt-1 flex-shrink-0 border border-border/50 shadow-sm transition-transform hover:scale-110">
                                            <AvatarImage src={message.sender?.avatar_url || undefined} />
                                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                                {message.sender?.username?.[0]?.toUpperCase() || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
                                            <div
                                                className={cn(
                                                    'max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 transition-all duration-200',
                                                    isOwn
                                                        ? 'chat-bubble-own text-primary-foreground rounded-tr-none'
                                                        : 'chat-bubble-other text-card-foreground rounded-tl-none'
                                                )}
                                            >
                                                {!isOwn && (
                                                    <p className="mb-1 text-[10px] font-bold text-primary/70 uppercase tracking-wider">
                                                        {message.sender?.username}
                                                    </p>
                                                )}
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap selection:bg-white/20">
                                                    {message.content}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 px-1">
                                                <span className="message-timestamp group-hover:opacity-60">
                                                    {format(new Date(message.created_at), 'p')}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-background/50 border-t border-border/50 backdrop-blur-md">
                    <form onSubmit={handleSend} className="relative flex items-end gap-2 max-w-4xl mx-auto">
                        <Input
                            placeholder="Message group..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="flex-1 bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-primary min-h-[44px] max-h-32 text-sm rounded-xl py-3 shadow-inner"
                        />
                        <Button
                            type="submit"
                            disabled={!newMessage.trim() || isSending}
                            size="icon"
                            className={cn(
                                "h-11 w-11 rounded-xl shadow-lg transition-all active:scale-95",
                                newMessage.trim()
                                    ? "bg-primary hover:bg-primary/90 shadow-primary/20 scale-100"
                                    : "bg-muted text-muted-foreground shadow-none scale-90"
                            )}
                        >
                            {isSending ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Side Panels */}
            <AnimatePresence>
                {(showInfo || showAddMember) && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: 320 }}
                        exit={{ opacity: 0, x: 20, width: 0 }}
                        className="hidden lg:flex flex-col bg-card border-l border-border/50 h-full overflow-hidden"
                    >
                        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/30">
                            <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                                {showAddMember ? <UserPlus className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                {showAddMember ? 'Add Member' : 'Members'}
                            </h3>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setShowAddMember(false); setShowInfo(false); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                            {showAddMember ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search users..."
                                            className="pl-9 bg-secondary/50 border-none h-10 text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        {searchResults.map(p => (
                                            <div key={p.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-border/50">
                                                        <AvatarImage src={p.avatar_url || undefined} />
                                                        <AvatarFallback>{p.username?.[0]?.toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-bold">@{p.username}</span>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => handleAddMember(p.id)}>
                                                    <UserPlus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {searchQuery.length >= 2 && searchResults.length === 0 && (
                                            <div className="text-center py-8">
                                                <p className="text-sm text-muted-foreground">No users found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {members.map(m => (
                                        <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/30 transition-colors">
                                            <Avatar className="h-11 w-11 border border-border/50">
                                                <AvatarImage src={m.profile?.avatar_url || undefined} />
                                                <AvatarFallback className="font-bold">{m.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">@{m.profile?.username}</p>
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md",
                                                    m.role === 'admin' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {m.role}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MoreVertical, ShieldAlert } from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { Message, getMessages, sendMessage, subscribeToMessages, markAsRead } from '@/lib/chat';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  conversationId: string;
  otherUser: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export function ChatWindow({ conversationId, otherUser }: ChatWindowProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await getMessages(conversationId);
        setMessages(data);
        if (profile) markAsRead(profile.id, conversationId);
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoading(false);
        setTimeout(() => scrollToBottom(false), 100);
      }
    };

    loadMessages();

    const channel = subscribeToMessages(conversationId, (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (profile && message.sender_id !== profile.id) {
        markAsRead(profile.id, conversationId);
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, profile]);

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
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: conversationId,
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
      const savedMsg = await sendMessage(conversationId, profile.id, content);
      // Replace optimistic message with saved one
      setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
      markAsRead(profile.id, conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content); // Restore message
    } finally {
      setIsSending(false);
    }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
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
    <div className="flex h-full flex-col bg-background selection:bg-primary/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 p-4 bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm transition-transform hover:scale-105">
            <AvatarImage src={otherUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {otherUser.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-foreground">@{otherUser.username}</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Direct Message</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date} className="space-y-4">
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
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[50%] text-center text-muted-foreground space-y-4">
            <div className="p-4 rounded-full bg-primary/5">
              <Send className="h-8 w-8 opacity-20" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No messages yet</p>
              <p className="text-sm">Start the conversation with @{otherUser.username}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-background/50 border-t border-border/50 backdrop-blur-md">
        <form
          onSubmit={handleSend}
          className="relative flex items-end gap-2 max-w-4xl mx-auto"
        >
          <Input
            placeholder="Write something lovely..."
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
        <p className="text-[10px] text-center text-muted-foreground mt-2 font-medium opacity-50">
          Press Enter to send
        </p>
      </div>
    </div>
  );
}

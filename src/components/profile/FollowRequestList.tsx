import { useState, useEffect } from 'react';
import { Check, X, User } from 'lucide-react';
import { getFollowRequests, handleFollowRequest, FollowRequest } from '@/lib/follows';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FollowRequestListProps {
    profileId: string;
    onUpdate?: () => void;
}

export function FollowRequestList({ profileId, onUpdate }: FollowRequestListProps) {
    const [requests, setRequests] = useState<FollowRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadRequests = async () => {
            try {
                const data = await getFollowRequests(profileId);
                setRequests(data);
            } catch (error) {
                console.error('Error loading follow requests:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadRequests();
    }, [profileId]);

    const handleAction = async (requestId: string, status: 'accepted' | 'rejected') => {
        try {
            await handleFollowRequest(requestId, status);
            setRequests((prev) => prev.filter((r) => r.id !== requestId));
            toast.success(`Request ${status}`);
            onUpdate?.();
        } catch (error) {
            console.error('Error handling follow request:', error);
            toast.error('Failed to process request');
        }
    };

    if (isLoading) return <div className="p-4 text-center">Loading...</div>;
    if (requests.length === 0) return <div className="p-4 text-center text-muted-foreground">No pending requests</div>;

    return (
        <div className="space-y-4">
            {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 p-2">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={request.sender?.avatar_url || undefined} />
                            <AvatarFallback>
                                <User className="h-5 w-5" />
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium text-sm">@{request.sender?.username}</p>
                            <p className="text-xs text-muted-foreground">wants to follow you</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handleAction(request.id, 'accepted')}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handleAction(request.id, 'rejected')}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}

import { useState } from 'react';
import { Users, Plus, Loader2 } from 'lucide-react';
import { createGroup } from '@/lib/groups';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CreateGroupFormProps {
    onGroupCreated: () => void;
    onCancel: () => void;
}

export function CreateGroupForm({ onGroupCreated, onCancel }: CreateGroupFormProps) {
    const { profile } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !name.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await createGroup(name.trim(), profile.id, description.trim());
            toast.success('Group created!');
            onGroupCreated();
        } catch (error) {
            console.error('Error creating group:', error);
            toast.error('Failed to create group');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4 p-2">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg">Create New Group</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground ml-1">Group Name</label>
                    <Input
                        placeholder="e.g. Project Collaborators"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-input border-border"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground ml-1">Description (Optional)</label>
                    <Textarea
                        placeholder="What's this group about?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-input border-border resize-none"
                        rows={3}
                    />
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        className="flex-1"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1 gap-2"
                        disabled={!name.trim() || isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create
                    </Button>
                </div>
            </form>
        </div>
    );
}

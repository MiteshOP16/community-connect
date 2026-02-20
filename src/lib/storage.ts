import { supabase } from '@/integrations/supabase/client';

export async function uploadImage(file: File, bucket: string = 'posts'): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const filePath = `${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

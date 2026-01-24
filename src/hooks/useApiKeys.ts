import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ApiKeys {
    geminiApiKey: string | null;
}

export function useApiKeys() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKeys>({ geminiApiKey: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchApiKeys();
        } else {
            setApiKeys({ geminiApiKey: null });
            setLoading(false);
        }
    }, [user]);

    const fetchApiKeys = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_api_keys')
                .select('gemini_api_key')
                .eq('user_id', user?.id)
                .maybeSingle();

            if (error) throw error;

            setApiKeys({
                geminiApiKey: data?.gemini_api_key || null,
            });
            setError(null);
        } catch (err: any) {
            console.error('Error fetching API keys:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveGeminiApiKey = async (apiKey: string) => {
        if (!user) {
            throw new Error('User not authenticated');
        }

        try {
            const { error } = await supabase
                .from('user_api_keys')
                .upsert({
                    user_id: user.id,
                    gemini_api_key: apiKey,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            setApiKeys(prev => ({ ...prev, geminiApiKey: apiKey }));
            setError(null);
        } catch (err: any) {
            console.error('Error saving API key:', err);
            setError(err.message);
            throw err;
        }
    };

    const deleteGeminiApiKey = async () => {
        if (!user) {
            throw new Error('User not authenticated');
        }

        try {
            const { error } = await supabase
                .from('user_api_keys')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;

            setApiKeys({ geminiApiKey: null });
            setError(null);
        } catch (err: any) {
            console.error('Error deleting API key:', err);
            setError(err.message);
            throw err;
        }
    };

    return {
        apiKeys,
        loading,
        error,
        saveGeminiApiKey,
        deleteGeminiApiKey,
        refetch: fetchApiKeys,
    };
}

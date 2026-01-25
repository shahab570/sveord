import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { setActiveConfig } from '@/services/geminiApi';

export interface ApiKeys {
    geminiApiKey: string | null;
    geminiModel: string | null;
    geminiApiVersion: string | null;
}

export function useApiKeys() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKeys>({
        geminiApiKey: null,
        geminiModel: null,
        geminiApiVersion: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchApiKeys();
        } else {
            setApiKeys({
                geminiApiKey: null,
                geminiModel: null,
                geminiApiVersion: null
            });
            setLoading(false);
        }
    }, [user]);

    const fetchApiKeys = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_api_keys')
                .select('gemini_api_key, gemini_model, gemini_api_version')
                .eq('user_id', user?.id)
                .maybeSingle();

            if (error) throw error;

            if (data?.gemini_api_key && data?.gemini_model && data?.gemini_api_version) {
                setActiveConfig(data.gemini_model, data.gemini_api_version);
            }

            setApiKeys({
                geminiApiKey: data?.gemini_api_key || null,
                geminiModel: data?.gemini_model || null,
                geminiApiVersion: data?.gemini_api_version || null,
            });
            setError(null);
        } catch (err: any) {
            console.error('Error fetching API keys:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveGeminiApiKey = async (apiKey: string, model?: string, version?: string) => {
        if (!user) {
            throw new Error('User not authenticated');
        }

        try {
            const { error } = await supabase
                .from('user_api_keys')
                .upsert({
                    user_id: user.id,
                    gemini_api_key: apiKey,
                    gemini_model: model || null,
                    gemini_api_version: version || null,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            if (model && version) {
                setActiveConfig(model, version);
            }

            setApiKeys({
                geminiApiKey: apiKey,
                geminiModel: model || null,
                geminiApiVersion: version || null
            });
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

            setApiKeys({
                geminiApiKey: null,
                geminiModel: null,
                geminiApiVersion: null
            });
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

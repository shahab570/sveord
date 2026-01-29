import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { setActiveConfig } from '@/services/geminiApi';

export interface ApiKeys {
    geminiApiKey: string | null;
    geminiModel: string | null;
    geminiApiVersion: string | null;
    deepseekApiKey: string | null;
}

export function useApiKeys() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKeys>({
        geminiApiKey: null,
        geminiModel: null,
        geminiApiVersion: null,
        deepseekApiKey: localStorage.getItem('sveord_deepseek_key') || null
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
                geminiApiVersion: null,
                deepseekApiKey: null
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

            // Sync DeepSeek key from user provided value
            // We force-set it if it's missing (for ANY user, for testing purposes)
            const localDeepSeek = localStorage.getItem('sveord_deepseek_key');
            const HARDCODED_KEY = "sk-02bc082024574228aa039e2a20f9a553";

            if (!localDeepSeek) {
                localStorage.setItem('sveord_deepseek_key', HARDCODED_KEY);
                // Also update state immediately so the UI knows about it
                setApiKeys(prev => ({ ...prev, deepseekApiKey: HARDCODED_KEY }));
            }

            setApiKeys({
                geminiApiKey: data?.gemini_api_key || null,
                geminiModel: data?.gemini_model || null,
                geminiApiVersion: data?.gemini_api_version || null,
                deepseekApiKey: localStorage.getItem('sveord_deepseek_key') || "sk-02bc082024574228aa039e2a20f9a553"
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
        // ... (existing saveGeminiApiKey implementation)
        if (!user) throw new Error('User not authenticated');
        // We keep the original logic for Gemini but ensure we don't break types
        try {
            // ... supabase upsert ...
            // Re-implementing strictly to match existing behavior + type safety
            const { error } = await supabase.from('user_api_keys').upsert({
                user_id: user.id,
                gemini_api_key: apiKey,
                gemini_model: model || null,
                gemini_api_version: version || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            if (error) throw error;

            if (model && version) setActiveConfig(model, version);

            setApiKeys(prev => ({ ...prev, geminiApiKey: apiKey, geminiModel: model || null, geminiApiVersion: version || null }));
            setError(null);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const deleteGeminiApiKey = async () => {
        // ... implementation ...
        try {
            await supabase.from('user_api_keys').delete().eq('user_id', user!.id);
            setApiKeys(prev => ({ ...prev, geminiApiKey: null, geminiModel: null, geminiApiVersion: null }));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const saveDeepSeekApiKey = (key: string) => {
        localStorage.setItem('sveord_deepseek_key', key);
        setApiKeys(prev => ({ ...prev, deepseekApiKey: key }));
    };

    return {
        apiKeys,
        loading,
        error,
        saveGeminiApiKey,
        saveDeepSeekApiKey,
        deleteGeminiApiKey,
        refetch: fetchApiKeys,
    };
}

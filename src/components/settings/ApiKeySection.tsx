import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Eye, EyeOff, ExternalLink, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useApiKeys } from '@/hooks/useApiKeys';
import { validateGeminiApiKey } from '@/services/geminiApi';

export function ApiKeySection() {
    const { apiKeys, saveGeminiApiKey, deleteGeminiApiKey } = useApiKeys();
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [debugVersion] = useState('v5');

    const hasExistingKey = !!apiKeys.geminiApiKey;

    const handleSave = async () => {
        if (!apiKey.trim()) {
            toast.error('Please enter an API key');
            return;
        }

        setIsSaving(true);
        setIsValidating(true);

        try {
            toast.info('Validating API key... This may take a few seconds.');
            console.log('Validating API key...');

            const result = await validateGeminiApiKey(apiKey.trim());
            console.log('Validation result:', result);

            if (!result.success) {
                console.error('API key validation failed');
                toast.error(`Validation failed: ${result.error || 'Invalid API key or Gemini API not enabled.'}`);
                setIsValidating(false);
                setIsSaving(false);
                return;
            }

            // Save the validated key
            await saveGeminiApiKey(apiKey.trim());
            toast.success('API key saved successfully!');
            setApiKey('');
            setShowKey(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save API key');
        } finally {
            setIsSaving(false);
            setIsValidating(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete your API key? This will stop word meaning generation.')) {
            return;
        }

        try {
            await deleteGeminiApiKey();
            toast.success('API key deleted successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete API key');
        }
    };

    return (
        <section className="word-card space-y-4 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-foreground">
                    Google Gemini API Key <span className="text-[10px] opacity-30 font-mono">{debugVersion}</span>
                </h2>
            </div>

            <p className="text-sm text-muted-foreground">
                Add your Google Gemini API key to automatically generate detailed Swedish word meanings with definitions, examples, and synonyms.
                Your API key is stored securely and only you can access it.
            </p>

            {/* Current status */}
            {hasExistingKey && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800 font-medium">
                        API key configured ✓
                    </span>
                </div>
            )}

            {/* API Key Input */}
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label htmlFor="gemini-api-key">
                        {hasExistingKey ? 'Update API Key' : 'Enter API Key'}
                    </Label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                id="gemini-api-key"
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="AIzaSy..."
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !apiKey.trim()}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {isValidating ? 'Validating...' : isSaving ? 'Saving...' : hasExistingKey ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </div>

                {hasExistingKey && (
                    <Button
                        onClick={handleDelete}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete API Key
                    </Button>
                )}
            </div>

            {/* Instructions */}
            <div className="space-y-3 p-4 rounded-lg bg-purple-50 border border-purple-200">
                <h3 className="text-sm font-semibold text-foreground">How to get your API key:</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                        Go to{' '}
                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:underline inline-flex items-center gap-1"
                        >
                            Google AI Studio
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </li>
                    <li>Click "Create API Key" (or use an existing project)</li>
                    <li>Select "Create API key in new project" or choose an existing project</li>
                    <li>Copy the API key and paste it above</li>
                </ol>

                <div className="pt-2 border-t border-purple-300">
                    <p className="text-xs text-muted-foreground">
                        💡 <strong>Free tier:</strong> Gemini provides 15 requests/minute and 1,500 requests/day for FREE!
                        Perfect for generating meanings for all 13,220 words.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        ⚡ <strong>What you get:</strong> Detailed definitions, usage examples, synonyms, antonyms - not just simple translations!
                    </p>
                </div>
            </div>
        </section>
    );
}

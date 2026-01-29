import { useState, useRef, useCallback } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress, useUploadHistory, useAddWord } from "@/hooks/useWords";
import { useSync } from "@/contexts/SyncContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings as SettingsIcon,
  Trash2,
  AlertTriangle,
  Plus,
  User,
  Cloud,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { PopulateMeaningsSection } from "@/components/settings/PopulateMeaningsSection";

const BATCH_SIZE = 100; // Process in batches for performance


export default function Settings() {
  const { user } = useAuth();
  const { resetProgress } = useUserProgress();
  const { history } = useUploadHistory();
  const { isSyncing, lastSyncTime, syncAll, forceRefresh } = useSync();
  const addWord = useAddWord();

  const [importProgress, setImportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Add word form state
  const [addWordOpen, setAddWordOpen] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [removingList, setRemovingList] = useState(false);

  // Profile Settings State
  const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || "");
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);


  // User's display name from Google
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";

  // Process data in batches for performance
  type WordUpsertRow = {
    swedish_word: string;
    kelly_level?: string | null;
    kelly_source_id?: number | null;
    frequency_rank?: number | null;
    sidor_source_id?: number | null;
    sidor_rank?: number | null;
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdatingProfile(true);
    try {
      // 1. Update Supabase Auth Metadata (for session consistency)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim()
        }
      });

      if (authError) throw authError;

      // 2. Update Profiles Table (for relational data)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 3. Force reload to update context
      window.location.reload();
      // Note: Ideal way is to expose a refresh function in context, but reload is safest for now to ensure all components re-render with new data.

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error(`Failed to update profile: ${error.message}`);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const processBatch = useCallback(async (batch: WordUpsertRow[]): Promise<number> => {
    const { error, count } = await supabase
      .from("words")
      .upsert(batch, { onConflict: "swedish_word", count: "exact" });

    if (error) {
      // Throw so imports fail loudly (otherwise ordering can't be fixed because kelly_source_id never gets stored).
      throw error;
    }

    return count || batch.length;
  }, []);



  const handleAddWord = async () => {
    if (!newWord.trim()) {
      toast.error("Please enter a word");
      return;
    }

    try {
      await addWord.mutateAsync({
        swedish_word: newWord,
      });

      if (newMeaning.trim() && user) {
        const { data: insertedWord } = await supabase
          .from("words")
          .select("id")
          .eq("swedish_word", newWord.toLowerCase().trim())
          .single();

        if (insertedWord) {
          await supabase.from("user_progress").insert({
            user_id: user.id,
            word_id: insertedWord.id,
            user_meaning: newMeaning,
          });
        }
      }

      toast.success(`Word "${newWord}" added!`);
      setNewWord("");
      setNewMeaning("");
      setAddWordOpen(false);
    } catch (error: any) {
      toast.error(`Failed to add word: ${error.message}`);
    }
  };

  const isImporting = false;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        {/* Header with user info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Import, export, and manage your data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{userName}</span>
          </div>
        </div>

        {/* Add Word Section */}
        <section className="word-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Add New Word
              </h2>
            </div>
            <Dialog open={addWordOpen} onOpenChange={setAddWordOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Word
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Word</DialogTitle>
                  <DialogDescription>
                    Add a new Swedish word to your vocabulary lists.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="word">Swedish Word *</Label>
                    <Input
                      id="word"
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      placeholder="Enter Swedish word"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meaning">Meaning (Optional)</Label>
                    <Input
                      id="meaning"
                      value={newMeaning}
                      onChange={(e) => setNewMeaning(e.target.value)}
                      placeholder="Enter meaning or notes"
                    />
                  </div>

                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddWordOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddWord} disabled={addWord.isPending}>
                    {addWord.isPending ? "Adding..." : "Add Word"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-muted-foreground">
            Manually add new words to Kelly List, Frequency List, or both.
          </p>
        </section>

        {/* Data Synchronization */}
        <section className="word-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Cloud className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Data Synchronization
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sync your progress with Supabase
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAll()}
                disabled={isSyncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Now
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sync Status</span>
                {isSyncing && <span className="text-xs font-bold text-blue-500 animate-pulse">Syncing...</span>}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Last Synced
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastSyncTime ? lastSyncTime.toLocaleString() : "Never"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900">Missing progress?</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  If your dashboard shows 0 words but you had progress on another device, click "Sync Now".
                  If that fails, use "Force Refresh" to re-download everything.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-amber-700 h-auto p-0 font-bold hover:text-amber-800 underline"
                  onClick={forceRefresh}
                  disabled={isSyncing}
                >
                  Force Refresh
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Settings Section */}
        <div className="animate-fade-in">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Profile Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Shahab"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. 570"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-secondary/30 flex justify-end">
              <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
                {updatingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </div>

        {/* API Word Generation */}
        <PopulateMeaningsSection />

        {/* API Key Management */}
        <ApiKeySection />



      </div>
    </AppLayout>
  );
}

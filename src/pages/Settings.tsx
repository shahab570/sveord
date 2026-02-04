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
import { db } from "@/services/db";
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
  const { isSyncing, lastSyncTime, syncAll, syncMissingStories, forceRefresh, pushLocalToCloud } = useSync();
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
    word_data?: any;
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
            Add new words to the dictionary.
          </p>
        </section>

        <section className="word-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <RefreshCw className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Data Recovery</h2>
              <p className="text-sm text-muted-foreground">Restore missing list data from the cloud</p>
            </div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-4">
            <div>
              <p className="text-sm text-amber-700 mb-3">
                If your word counts seem low, use this button to redownload your full data from Supabase.
              </p>
              <Button
                variant="outline"
                onClick={forceRefresh}
                disabled={isSyncing}
                className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-100 w-full md:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                Force Refresh (Download All)
              </Button>
            </div>

            <div className="border-t border-amber-200 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-800">New: Cloud Repair</span>
              </div>
              <p className="text-xs text-blue-700 mb-3">
                Use this if your "Study Later" list is missing on other devices or if you just migrated your database. This will safely push your local progress to the cloud.
              </p>
              <Button
                variant="outline"
                onClick={pushLocalToCloud}
                disabled={isSyncing}
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 w-full md:w-auto"
              >
                <Cloud className="h-4 w-4" />
                Push Local Backup to Cloud
              </Button>
            </div>
          </div>
        </section>

        <section className="word-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Database Integrity</h2>
              <p className="text-sm text-muted-foreground">Fix inconsistent data states (e.g., words marked as both learned and reserved).</p>
            </div>
          </div>
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-800 mb-4">
              If you suspect your data is out of sync or notice conflicts, run this tool. It will check for words that are in invalid states and let you resolve them.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={async () => {
                  const conflicts = await db.progress.filter(p => !!p.is_learned && !!p.is_reserve).toArray();
                  if (conflicts.length === 0) {
                    toast.success("No conflicts found! Your database is healthy.");
                    return;
                  }
                  // Re-use logic or navigate to dashboard? 
                  // Better to handle it right here to be "immediate".
                  const result = window.confirm(
                    `Found ${conflicts.length} words marked as both 'Learned' and 'Study Later'.\n\nClick OK to mark them all as LEARNED (remove from Queue).\nClick Cancel to move them all to QUEUE (unlearn).`
                  );

                  const isLearnedVal = result ? 1 : 0;
                  const isReserveVal = result ? 0 : 1;
                  const actionText = result ? "marked as Learned" : "moved to Queue";

                  // Fix Local
                  const updates = conflicts.map(p => ({ ...p, is_learned: isLearnedVal, is_reserve: isReserveVal }));
                  await db.progress.bulkPut(updates);

                  // Fix Remote
                  for (const p of conflicts) {
                    await supabase.from("user_progress").update({
                      is_learned: !!isLearnedVal,
                      is_reserve: !!isReserveVal
                    }).eq("user_id", user?.id).eq("word_id", p.word_id);
                  }

                  toast.success(`Fixed ${conflicts.length} conflicts! They are now ${actionText}.`);
                  // Invalidate to refresh Dashboard if needed
                  // queryClient via hook if available, or just reload to be safe and lazy
                  setTimeout(() => window.location.reload(), 1000);
                }}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Scan & Fix Conflicts
              </Button>
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

import { useState, useRef, useCallback } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress, useUploadHistory, useAddWord, FREQUENCY_LEVELS, SIDOR_LEVELS, CEFR_LEVELS } from "@/hooks/useWords";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Settings as SettingsIcon,
  Upload,
  Download,
  Trash2,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Plus,
  GraduationCap,
  Hash,
  X,
  User,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { PopulateMeaningsSection } from "@/components/settings/PopulateMeaningsSection";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { useSync } from "@/contexts/SyncContext";
import { RefreshCw, Clock } from "lucide-react";

// File upload constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RECORD_COUNT = 50000;
const BATCH_SIZE = 100; // Process in batches for performance

// ID-based CEFR level assignment for Kelly list
// Based on the JSON file's id field, assign CEFR levels
const KELLY_ID_TO_CEFR = [
  { min: 1, max: 1404, level: "A1" },
  { min: 1405, max: 2808, level: "A2" },
  { min: 2809, max: 4212, level: "B1" },
  { min: 4213, max: 5615, level: "B2" },
  { min: 5616, max: 7020, level: "C1" },
  { min: 7021, max: 8425, level: "C2" },
] as const;

function getKellyLevelFromId(id: number): string {
  for (const range of KELLY_ID_TO_CEFR) {
    if (id >= range.min && id <= range.max) {
      return range.level;
    }
  }
  return "C2"; // Default for any ID beyond defined ranges
}

// Validation schemas for import data
const KellyWordSchema = z.object({
  id: z.union([
    z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
    z.number()
  ]).refine(n => n > 0 && Number.isInteger(n), "ID must be a positive integer"),
  word: z.string().min(1, "Word cannot be empty").max(100, "Word too long").transform(s => s.trim()),
  cefrlevel: z.string().optional() // No longer used for assignment, kept for backwards compatibility
});

const FrequencyWordSchema = z.object({
  word: z.string().min(1, "Word cannot be empty").max(100, "Word too long").transform(s => s.trim()),
  id: z.union([
    z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
    z.number()
  ]).refine(n => n > 0 && Number.isInteger(n), "ID must be a positive integer")
});

// Sidor uses same format as Frequency: {id, word}
const SidorWordSchema = z.object({
  word: z.string().min(1, "Word cannot be empty").max(100, "Word too long").transform(s => s.trim()),
  id: z.union([
    z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
    z.number()
  ]).refine(n => n > 0 && Number.isInteger(n), "ID must be a positive integer")
});

export default function Settings() {
  const { user } = useAuth();
  const { resetProgress } = useUserProgress();
  const { history, addUpload, deleteUpload } = useUploadHistory();
  const addWord = useAddWord();
  const { syncAll, isSyncing, lastSyncTime, forceRefresh } = useSync();

  const kellyFileInputRef = useRef<HTMLInputElement>(null);
  const frequencyFileInputRef = useRef<HTMLInputElement>(null);
  const sidorFileInputRef = useRef<HTMLInputElement>(null);
  const [importingKelly, setImportingKelly] = useState(false);
  const [importingFrequency, setImportingFrequency] = useState(false);
  const [importingSidor, setImportingSidor] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Add word form state
  const [addWordOpen, setAddWordOpen] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [addToKelly, setAddToKelly] = useState(false);
  const [kellyLevel, setKellyLevel] = useState<string>("");
  const [addToFrequency, setAddToFrequency] = useState(false);
  const [frequencyLevel, setFrequencyLevel] = useState<string>("");
  const [addToSidor, setAddToSidor] = useState(false);
  const [sidorLevel, setSidorLevel] = useState<string>("");
  const [removingList, setRemovingList] = useState(false);

  // Get the most recent upload for each list type
  const kellyUpload = history.data?.find((u) => u.list_type === "kelly");
  const frequencyUpload = history.data?.find((u) => u.list_type === "frequency");
  const sidorUpload = history.data?.find((u) => u.list_type === "sidor");

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

  const handleKellyFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    setImportingKelly(true);
    setImportProgress(0);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let data: any[];

      if (extension === "json") {
        const text = await file.text();
        data = JSON.parse(text);
      } else if (extension === "csv") {
        data = await new Promise<any[]>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(new Error(error.message)),
          });
        });
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet);
      } else {
        throw new Error("Unsupported file format. Use JSON, CSV, or Excel.");
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No data found in file");
      }

      if (data.length > MAX_RECORD_COUNT) {
        throw new Error(`Too many records. Maximum ${MAX_RECORD_COUNT.toLocaleString()} per import.`);
      }

      // Validate and transform Kelly data - use ID for CEFR assignment and ordering
      const wordMap = new Map<string, { swedish_word: string; kelly_level: string; kelly_source_id: number }>();
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const result = KellyWordSchema.safeParse(item);

        if (result.success) {
          const jsonId = result.data.id;
          const wordKey = result.data.word.toLowerCase();
          // Keep only the first occurrence (lowest JSON id) to avoid duplicates
          if (!wordMap.has(wordKey)) {
            wordMap.set(wordKey, {
              swedish_word: wordKey,
              kelly_level: getKellyLevelFromId(jsonId), // Assign CEFR based on JSON id field
              kelly_source_id: jsonId, // Use JSON id to preserve original order
            });
          }
        } else {
          if (errors.length < 5) {
            errors.push(`Row ${i + 1}: ${result.error.errors[0]?.message || "Invalid data"}`);
          }
        }
      }

      const validWords = Array.from(wordMap.values());

      if (validWords.length === 0) {
        throw new Error(`No valid records found.\n${errors.join("\n")}`);
      }

      // Process in batches
      let processed = 0;
      for (let i = 0; i < validWords.length; i += BATCH_SIZE) {
        const batch = validWords.slice(i, i + BATCH_SIZE);
        await processBatch(batch);
        processed += batch.length;
        setImportProgress(Math.round((processed / validWords.length) * 100));
      }

      // Sanity check: if we couldn't store kelly_source_id, we can't sort by your JSON IDs.
      const { count: kellyIdsStored, error: verifyError } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .not("kelly_level", "is", null)
        .not("kelly_source_id", "is", null);
      if (verifyError) throw verifyError;
      if (!kellyIdsStored || kellyIdsStored === 0) {
        throw new Error(
          "Kelly import did not store the JSON IDs (kelly_source_id). Make sure you are logged in as an admin, then re-import the Kelly JSON file."
        );
      }

      await addUpload.mutateAsync({
        file_name: file.name,
        file_type: extension || "unknown",
        records_processed: validWords.length,
        list_type: "kelly",
      });

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <div>
            <p className="font-medium">Kelly List import successful!</p>
            <p className="text-sm text-muted-foreground">
              {validWords.length} words processed
              {errors.length > 0 && `, ${errors.length} skipped`}
            </p>
          </div>
        </div>,
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error("Kelly import error:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImportingKelly(false);
      setImportProgress(0);
      if (kellyFileInputRef.current) {
        kellyFileInputRef.current.value = "";
      }
    }
  };

  const handleFrequencyFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    setImportingFrequency(true);
    setImportProgress(0);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let data: any[];

      if (extension === "json") {
        const text = await file.text();
        data = JSON.parse(text);
      } else if (extension === "csv") {
        data = await new Promise<any[]>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(new Error(error.message)),
          });
        });
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet);
      } else {
        throw new Error("Unsupported file format. Use JSON, CSV, or Excel.");
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No data found in file");
      }

      if (data.length > MAX_RECORD_COUNT) {
        throw new Error(`Too many records. Maximum ${MAX_RECORD_COUNT.toLocaleString()} per import.`);
      }

      // Validate and transform Frequency data
      const validWords: Array<{ swedish_word: string; frequency_rank: number }> = [];
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const result = FrequencyWordSchema.safeParse(item);

        if (result.success) {
          validWords.push({
            swedish_word: result.data.word.toLowerCase(),
            frequency_rank: result.data.id,
          });
        } else {
          if (errors.length < 5) {
            errors.push(`Row ${i + 1}: ${result.error.errors[0]?.message || "Invalid data"}`);
          }
        }
      }

      if (validWords.length === 0) {
        throw new Error(`No valid records found.\n${errors.join("\n")}`);
      }

      // Process in batches
      let processed = 0;
      for (let i = 0; i < validWords.length; i += BATCH_SIZE) {
        const batch = validWords.slice(i, i + BATCH_SIZE);
        await processBatch(batch);
        processed += batch.length;
        setImportProgress(Math.round((processed / validWords.length) * 100));
      }

      await addUpload.mutateAsync({
        file_name: file.name,
        file_type: extension || "unknown",
        records_processed: validWords.length,
        list_type: "frequency",
      });

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <div>
            <p className="font-medium">Frequency List import successful!</p>
            <p className="text-sm text-muted-foreground">
              {validWords.length} words processed
              {errors.length > 0 && `, ${errors.length} skipped`}
            </p>
          </div>
        </div>,
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error("Frequency import error:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImportingFrequency(false);
      setImportProgress(0);
      if (frequencyFileInputRef.current) {
        frequencyFileInputRef.current.value = "";
      }
    }
  };

  const handleSidorFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    setImportingSidor(true);
    setImportProgress(0);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let data: any[];

      if (extension === "json") {
        const text = await file.text();
        data = JSON.parse(text);
      } else if (extension === "csv") {
        data = await new Promise<any[]>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(new Error(error.message)),
          });
        });
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet);
      } else {
        throw new Error("Unsupported file format. Use JSON, CSV, or Excel.");
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No data found in file");
      }

      if (data.length > MAX_RECORD_COUNT) {
        throw new Error(`Too many records. Maximum ${MAX_RECORD_COUNT.toLocaleString()} per import.`);
      }

      // Validate and transform Sidor data (same format as Frequency: {id, word})
      // Use Map to deduplicate by word string - keeps first occurrence (lowest id)
      const wordMap = new Map<string, { swedish_word: string; sidor_source_id: number; sidor_rank: number }>();
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const result = SidorWordSchema.safeParse(item);

        if (result.success) {
          const wordKey = result.data.word.toLowerCase();
          // Keep only the first occurrence (lowest JSON id) to avoid duplicates
          if (!wordMap.has(wordKey)) {
            wordMap.set(wordKey, {
              swedish_word: wordKey,
              sidor_source_id: result.data.id,
              sidor_rank: result.data.id,
            });
          }
        } else {
          if (errors.length < 5) {
            errors.push(`Row ${i + 1}: ${result.error.errors[0]?.message || "Invalid data"}`);
          }
        }
      }

      const validWords = Array.from(wordMap.values());

      if (validWords.length === 0) {
        throw new Error(`No valid records found.\n${errors.join("\n")}`);
      }

      // Process in batches
      let processed = 0;
      for (let i = 0; i < validWords.length; i += BATCH_SIZE) {
        const batch = validWords.slice(i, i + BATCH_SIZE);
        await processBatch(batch);
        processed += batch.length;
        setImportProgress(Math.round((processed / validWords.length) * 100));
      }

      await addUpload.mutateAsync({
        file_name: file.name,
        file_type: extension || "unknown",
        records_processed: validWords.length,
        list_type: "sidor",
      });

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <div>
            <p className="font-medium">Sidor List import successful!</p>
            <p className="text-sm text-muted-foreground">
              {validWords.length} words processed
              {errors.length > 0 && `, ${errors.length} skipped`}
            </p>
          </div>
        </div>,
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error("Sidor import error:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImportingSidor(false);
      setImportProgress(0);
      if (sidorFileInputRef.current) {
        sidorFileInputRef.current.value = "";
      }
    }
  };

  const handleExport = async (exportFormat: "json" | "csv" | "xlsx", listType: "kelly" | "frequency" | "sidor") => {
    setExporting(true);
    try {
      let query = supabase.from("words").select("*");

      // Filter by list type
      if (listType === "kelly") {
        query = query.not("kelly_level", "is", null).order("kelly_source_id", { ascending: true });
      } else if (listType === "frequency") {
        query = query.not("frequency_rank", "is", null).order("frequency_rank", { ascending: true });
      } else {
        query = query.not("sidor_rank", "is", null).order("sidor_rank", { ascending: true });
      }

      const { data: words } = await query;
      const { data: progress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user!.id);

      const progressMap = new Map(progress?.map((p) => [p.word_id, p]) || []);

      const exportData = words?.map((word) => {
        const userProgress = progressMap.get(word.id);

        if (listType === "kelly") {
          return {
            id: word.kelly_source_id,
            word: word.swedish_word,
            kelly_level: word.kelly_level || "",
            meaning: userProgress?.user_meaning || "",
            custom_spelling: userProgress?.custom_spelling || "",
          };
        } else if (listType === "frequency") {
          return {
            rank: word.frequency_rank,
            word: word.swedish_word,
            meaning: userProgress?.user_meaning || "",
            custom_spelling: userProgress?.custom_spelling || "",
          };
        } else {
          return {
            id: word.sidor_source_id,
            rank: word.sidor_rank,
            word: word.swedish_word,
            meaning: userProgress?.user_meaning || "",
            custom_spelling: userProgress?.custom_spelling || "",
          };
        }
      });

      let blob: Blob;
      let filename: string;

      if (exportFormat === "json") {
        blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        filename = `sveord-${listType}-export.json`;
      } else if (exportFormat === "csv") {
        const csv = Papa.unparse(exportData || []);
        blob = new Blob([csv], { type: "text/csv" });
        filename = `sveord-${listType}-export.csv`;
      } else {
        const ws = XLSX.utils.json_to_sheet(exportData || []);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${listType.charAt(0).toUpperCase() + listType.slice(1)} List`);
        const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        filename = `sveord-${listType}-export.xlsx`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const listName = `${listType.charAt(0).toUpperCase() + listType.slice(1)} List`;
      toast.success(`${listName} exported! Your meanings and custom spellings are included.`);
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async (filter: {
    kellyLevel?: string;
    frequencyRange?: [number, number];
    sidorRange?: [number, number];
    all?: boolean;
    listType?: "kelly" | "frequency" | "sidor";
  }) => {
    try {
      await resetProgress.mutateAsync(filter);
      toast.success("Progress reset successfully");
    } catch (error: any) {
      toast.error(`Reset failed: ${error.message}`);
    }
  };

  // Handle removing Kelly list (deletes words + history + progress)
  const handleRemoveKellyList = async () => {
    if (!user) return;
    setRemovingList(true);
    try {
      // First get all Kelly word IDs
      const { data: kellyWords } = await supabase
        .from("words")
        .select("id")
        .not("kelly_level", "is", null);

      if (kellyWords && kellyWords.length > 0) {
        const wordIds = kellyWords.map((w) => w.id);

        // Delete user progress for these words
        await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id)
          .in("word_id", wordIds);

        // Delete the words (admin only)
        await supabase
          .from("words")
          .delete()
          .not("kelly_level", "is", null);
      }

      // Delete the upload history entry
      if (kellyUpload) {
        await deleteUpload.mutateAsync(kellyUpload.id);
      }

      toast.success("Kelly List removed - all words and progress deleted");
    } catch (error: any) {
      toast.error(`Failed to remove Kelly List: ${error.message}`);
    } finally {
      setRemovingList(false);
    }
  };

  // Handle removing Frequency list (deletes words + history + progress)
  const handleRemoveFrequencyList = async () => {
    if (!user) return;
    setRemovingList(true);
    try {
      // First get all Frequency word IDs
      const { data: frequencyWords } = await supabase
        .from("words")
        .select("id")
        .not("frequency_rank", "is", null);

      if (frequencyWords && frequencyWords.length > 0) {
        const wordIds = frequencyWords.map((w) => w.id);

        // Delete user progress for these words
        await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id)
          .in("word_id", wordIds);

        // Delete the words (admin only)
        await supabase
          .from("words")
          .delete()
          .not("frequency_rank", "is", null);
      }

      // Delete the upload history entry
      if (frequencyUpload) {
        await deleteUpload.mutateAsync(frequencyUpload.id);
      }

      toast.success("Frequency List removed - all words and progress deleted");
    } catch (error: any) {
      toast.error(`Failed to remove Frequency List: ${error.message}`);
    } finally {
      setRemovingList(false);
    }
  };

  // Handle removing Sidor list (deletes words + history + progress)
  const handleRemoveSidorList = async () => {
    if (!user) return;
    setRemovingList(true);
    try {
      // First get all Sidor word IDs
      const { data: sidorWords } = await supabase
        .from("words")
        .select("id")
        .not("sidor_rank", "is", null);

      if (sidorWords && sidorWords.length > 0) {
        const wordIds = sidorWords.map((w) => w.id);

        // Delete user progress for these words
        await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id)
          .in("word_id", wordIds);

        // Delete the words (admin only)
        await supabase
          .from("words")
          .delete()
          .not("sidor_rank", "is", null);
      }

      // Delete the upload history entry
      if (sidorUpload) {
        await deleteUpload.mutateAsync(sidorUpload.id);
      }

      toast.success("Sidor List removed - all words and progress deleted");
    } catch (error: any) {
      toast.error(`Failed to remove Sidor List: ${error.message}`);
    } finally {
      setRemovingList(false);
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      toast.error("Please enter a word");
      return;
    }

    if (addToKelly && !kellyLevel) {
      toast.error("Please select a CEFR level for Kelly list");
      return;
    }

    if (addToFrequency && !frequencyLevel) {
      toast.error("Please select a CEFR level for Frequency list");
      return;
    }

    // Calculate frequency_rank based on the selected level
    let frequencyRank: number | undefined;
    if (addToFrequency && frequencyLevel) {
      const levelInfo = FREQUENCY_LEVELS.find((l) => l.value === frequencyLevel);
      if (levelInfo) {
        // Get the next available rank within this level's range
        const { data: existingInRange } = await supabase
          .from("words")
          .select("frequency_rank")
          .gte("frequency_rank", levelInfo.range[0])
          .lte("frequency_rank", levelInfo.range[1])
          .order("frequency_rank", { ascending: false })
          .limit(1);

        const maxInRange = existingInRange?.[0]?.frequency_rank || (levelInfo.range[0] - 1);
        frequencyRank = maxInRange + 1;

        // Check if we're exceeding the range
        if (frequencyRank > levelInfo.range[1]) {
          toast.error(`Level ${frequencyLevel} range is full (${levelInfo.range[0]}-${levelInfo.range[1]})`);
          return;
        }
      }
    }

    try {
      await addWord.mutateAsync({
        swedish_word: newWord,
        kelly_level: addToKelly ? kellyLevel : undefined,
        frequency_rank: frequencyRank,
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

      const addedTo: string[] = [];
      if (addToKelly) addedTo.push(`Kelly (${kellyLevel})`);
      if (addToFrequency && frequencyRank) addedTo.push(`Frequency (${frequencyLevel} #${frequencyRank})`);

      toast.success(`Word "${newWord}" added${addedTo.length > 0 ? ` to ${addedTo.join(' and ')}` : ''}!`);
      setNewWord("");
      setNewMeaning("");
      setKellyLevel("");
      setFrequencyLevel("");
      setAddToKelly(false);
      setAddToFrequency(false);
      setAddWordOpen(false);
    } catch (error: any) {
      toast.error(`Failed to add word: ${error.message}`);
    }
  };

  const isImporting = importingKelly || importingFrequency || importingSidor;

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

                  {/* List selection */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-base">Add to Lists</Label>

                    {/* Kelly List option */}
                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        id="addToKelly"
                        checked={addToKelly}
                        onCheckedChange={(checked) => {
                          setAddToKelly(!!checked);
                          if (!checked) setKellyLevel("");
                        }}
                      />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="addToKelly" className="flex items-center gap-2 cursor-pointer">
                          <GraduationCap className="h-4 w-4 text-emerald-600" />
                          Kelly List
                        </Label>
                        {addToKelly && (
                          <Select value={kellyLevel} onValueChange={setKellyLevel}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select CEFR level" />
                            </SelectTrigger>
                            <SelectContent>
                              {CEFR_LEVELS.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Frequency List option */}
                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        id="addToFrequency"
                        checked={addToFrequency}
                        onCheckedChange={(checked) => {
                          setAddToFrequency(!!checked);
                          if (!checked) setFrequencyLevel("");
                        }}
                      />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="addToFrequency" className="flex items-center gap-2 cursor-pointer">
                          <Hash className="h-4 w-4 text-blue-600" />
                          Frequency List
                        </Label>
                        {addToFrequency && (
                          <Select value={frequencyLevel} onValueChange={setFrequencyLevel}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select CEFR level" />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCY_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label} - {level.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
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

        {/* API Key Management */}
        <ApiKeySection />

        {/* Google Translate Word Meanings Section */}
        <PopulateMeaningsSection />

        {/* Kelly List Import Section */}
        <section className="word-card space-y-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Kelly List
            </h2>
          </div>

          {/* Show current Kelly file or upload option */}
          {kellyUpload ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-3">
                <FileJson className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-foreground">{kellyUpload.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kellyUpload.records_processed?.toLocaleString()} words • Imported {format(new Date(kellyUpload.uploaded_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={removingList}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Remove Kelly List?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL Kelly List words and reset all your learning progress for this list. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemoveKellyList}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove Kelly List
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No Kelly List uploaded. Import words with CEFR levels (A1-C2).
              </p>
              <input
                type="file"
                ref={kellyFileInputRef}
                onChange={handleKellyFileUpload}
                accept=".json,.csv,.xlsx,.xls"
                className="hidden"
              />
              <Button
                onClick={() => kellyFileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Upload className="h-4 w-4" />
                {importingKelly ? "Importing..." : "Import Kelly List"}
              </Button>
              {importingKelly && (
                <div className="space-y-1">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{importProgress}% complete</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Frequency List Import Section */}
        <section className="word-card space-y-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <Hash className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Frequency List
            </h2>
          </div>

          {/* Show current Frequency file or upload option */}
          {frequencyUpload ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-3">
                <FileJson className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-foreground">{frequencyUpload.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {frequencyUpload.records_processed?.toLocaleString()} words • Imported {format(new Date(frequencyUpload.uploaded_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={removingList}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Remove Frequency List?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL Frequency List words and reset all your learning progress for this list. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemoveFrequencyList}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove Frequency List
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No Frequency List uploaded. Import words with frequency rankings.
              </p>
              <input
                type="file"
                ref={frequencyFileInputRef}
                onChange={handleFrequencyFileUpload}
                accept=".json,.csv,.xlsx,.xls"
                className="hidden"
              />
              <Button
                onClick={() => frequencyFileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                {importingFrequency ? "Importing..." : "Import Frequency List"}
              </Button>
              {importingFrequency && (
                <div className="space-y-1">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{importProgress}% complete</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sidor List Import Section */}
        <section className="word-card space-y-4 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Sidor List
            </h2>
          </div>

          {/* Show current Sidor file or upload option */}
          {sidorUpload ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-3">
                <FileJson className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-foreground">{sidorUpload.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sidorUpload.records_processed?.toLocaleString()} words • Imported {format(new Date(sidorUpload.uploaded_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={removingList}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Remove Sidor List?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL Sidor List words and reset all your learning progress for this list. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemoveSidorList}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove Sidor List
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No Sidor List uploaded. Import words with rankings (600 words per CEFR level).
              </p>
              <input
                type="file"
                ref={sidorFileInputRef}
                onChange={handleSidorFileUpload}
                accept=".json,.csv,.xlsx,.xls"
                className="hidden"
              />
              <Button
                onClick={() => sidorFileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Upload className="h-4 w-4" />
                {importingSidor ? "Importing..." : "Import Sidor List"}
              </Button>
              {importingSidor && (
                <div className="space-y-1">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{importProgress}% complete</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sync Section */}
        <section className="word-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <RefreshCw className={`h-5 w-5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Data Synchronization
                </h2>
                <p className="text-sm text-muted-foreground">
                  Synchronize your local database with Supabase cloud.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => syncAll()}
                disabled={isSyncing}
                className="gap-2 rounded-xl"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button
                variant="outline"
                onClick={() => forceRefresh()}
                disabled={isSyncing}
                className="gap-2 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Force Refresh
              </Button>
            </div>
          </div>

          {lastSyncTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg w-fit">
              <Clock className="h-3 w-3" />
              Last synced: {format(lastSyncTime, "MMM d, HH:mm:ss")}
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold">Troubleshooting</p>
              <p>Use <strong>Sync Now</strong> to pull updates. Use <strong>Force Refresh</strong> if you see errors or if data seems missing/incorrect. Note: Force Refresh will clear local cache and re-download all 13,000+ words.</p>
            </div>
          </div>
        </section>

        {/* Export Section */}
        <section className="word-card space-y-4">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Export Data
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Download your vocabulary with meanings and custom spellings.
          </p>

          {/* Export Kelly List */}
          <div className="space-y-2 p-4 border border-border rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <GraduationCap className="h-4 w-4 text-primary" />
              Export Kelly List
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json", "kelly")}
                disabled={exporting}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv", "kelly")}
                disabled={exporting}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx", "kelly")}
                disabled={exporting}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>

          {/* Export Frequency List */}
          <div className="space-y-2 p-4 border border-border rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Hash className="h-4 w-4 text-primary" />
              Export Frequency List
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json", "frequency")}
                disabled={exporting}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv", "frequency")}
                disabled={exporting}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx", "frequency")}
                disabled={exporting}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>

          {/* Export Sidor List */}
          <div className="space-y-2 p-4 border border-border rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Export Sidor List
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json", "sidor")}
                disabled={exporting}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv", "sidor")}
                disabled={exporting}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx", "sidor")}
                disabled={exporting}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        </section>

        {/* Reset Section */}
        <section className="word-card space-y-4 border-destructive/20">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">
              Reset Progress
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Reset your learning progress. This cannot be undone.
          </p>

          {/* Kelly List Reset */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <GraduationCap className="h-4 w-4" />
              Reset Kelly List Progress
            </div>
            <div className="flex flex-wrap gap-2">
              {CEFR_LEVELS.map((level) => (
                <AlertDialog key={`kelly-${level}`}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-emerald-200 hover:bg-emerald-50">
                      Kelly {level}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Kelly List {level}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark all Kelly List {level} words as unlearned. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleReset({ kellyLevel: level, listType: "kelly" })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
            </div>
          </div>

          {/* Frequency List Reset */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Hash className="h-4 w-4" />
              Reset Frequency List Progress
            </div>
            <div className="flex flex-wrap gap-2">
              {FREQUENCY_LEVELS.map((freqLevel) => (
                <AlertDialog key={`freq-${freqLevel.value}`}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-blue-200 hover:bg-blue-50">
                      Freq {freqLevel.label}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Frequency List {freqLevel.label}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark all Frequency List {freqLevel.label} words ({freqLevel.description}) as unlearned. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleReset({ frequencyRange: freqLevel.range, listType: "frequency" })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
            </div>
          </div>

          {/* Sidor List Reset */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
              <BookOpen className="h-4 w-4" />
              Reset Sidor List Progress
            </div>
            <div className="flex flex-wrap gap-2">
              {SIDOR_LEVELS.map((sidorLevel) => (
                <AlertDialog key={`sidor-${sidorLevel.value}`}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-purple-200 hover:bg-purple-50">
                      Sidor {sidorLevel.label}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Sidor List {sidorLevel.label}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark all Sidor List {sidorLevel.label} words ({sidorLevel.description}) as unlearned. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleReset({ sidorRange: sidorLevel.range, listType: "sidor" })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
            </div>
          </div>

          {/* Reset All */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2 mt-4">
                <AlertTriangle className="h-4 w-4" />
                Reset All Progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset All Progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset ALL your learning progress for Kelly List, Frequency List, and Sidor List. All words will be marked as unlearned. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleReset({ all: true })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </AppLayout>
  );
}

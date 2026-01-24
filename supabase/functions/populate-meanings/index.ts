import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WordData {
  word_type: string;
  meanings: { english: string; context?: string }[];
  examples: { swedish: string; english: string }[];
  synonyms: string[];
  antonyms: string[];
  populated_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, batchSize = 30 } = await req.json();

    if (action === "status") {
      // Return current population status
      const { count: completed } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .not("word_data", "is", null);

      const { count: total } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true });

      return new Response(
        JSON.stringify({
          completed: completed || 0,
          total: total || 0,
          remaining: (total || 0) - (completed || 0),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "populate") {
      // Fetch a batch of words without word_data
      const { data: words, error: fetchError } = await supabase
        .from("words")
        .select("id, swedish_word")
        .is("word_data", null)
        .order("id", { ascending: true })
        .limit(batchSize);

      if (fetchError) {
        throw fetchError;
      }

      if (!words || words.length === 0) {
        return new Response(
          JSON.stringify({ message: "All words already populated", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const wordList = words.map((w) => w.swedish_word).join(", ");

      const systemPrompt = `You are a Swedish-English linguistic expert. For each Swedish word provided, analyze it thoroughly and return comprehensive linguistic data.

For each word, provide:
1. word_type: The grammatical category (noun, verb, adjective, adverb, preposition, conjunction, pronoun, interjection, article, numeral, particle)
2. meanings: An array of ALL possible English translations with context/usage notes. Be thorough - include all common meanings.
3. examples: At least one example sentence in Swedish with its English translation
4. synonyms: Swedish synonyms (empty array if none exist)
5. antonyms: Swedish antonyms (empty array if none exist)

CRITICAL: Return ONLY a valid JSON array with objects for each word. No markdown, no explanation text.

Example response format:
[
  {
    "word": "hus",
    "word_type": "noun",
    "meanings": [
      {"english": "house", "context": "a building for living"},
      {"english": "home", "context": "place of residence"},
      {"english": "household", "context": "family unit"}
    ],
    "examples": [
      {"swedish": "Jag bor i ett stort hus.", "english": "I live in a big house."}
    ],
    "synonyms": ["bostad", "hem", "byggnad"],
    "antonyms": []
  }
]`;

      const userPrompt = `Analyze these Swedish words and provide comprehensive linguistic data for each: ${wordList}`;

      console.log(`Processing batch of ${words.length} words...`);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No content in AI response");
      }

      // Parse the JSON response - handle potential markdown wrapping
      let parsedWords: any[];
      try {
        // Remove markdown code blocks if present
        let cleanContent = content.trim();
        if (cleanContent.startsWith("```json")) {
          cleanContent = cleanContent.slice(7);
        } else if (cleanContent.startsWith("```")) {
          cleanContent = cleanContent.slice(3);
        }
        if (cleanContent.endsWith("```")) {
          cleanContent = cleanContent.slice(0, -3);
        }
        parsedWords = JSON.parse(cleanContent.trim());
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Invalid JSON response from AI");
      }

      // Update each word in the database
      let successCount = 0;
      const errors: string[] = [];

      for (const word of words) {
        const wordData = parsedWords.find(
          (pw: any) => pw.word?.toLowerCase() === word.swedish_word.toLowerCase()
        );

        if (wordData) {
          const wordDataToStore: WordData = {
            word_type: wordData.word_type || "unknown",
            meanings: wordData.meanings || [],
            examples: wordData.examples || [],
            synonyms: wordData.synonyms || [],
            antonyms: wordData.antonyms || [],
            populated_at: new Date().toISOString(),
          };

          const { error: updateError } = await supabase
            .from("words")
            .update({ word_data: wordDataToStore })
            .eq("id", word.id);

          if (updateError) {
            errors.push(`Failed to update ${word.swedish_word}: ${updateError.message}`);
          } else {
            successCount++;
          }
        } else {
          // Word not found in AI response - create minimal data
          const fallbackData: WordData = {
            word_type: "unknown",
            meanings: [],
            examples: [],
            synonyms: [],
            antonyms: [],
            populated_at: new Date().toISOString(),
          };

          const { error: updateError } = await supabase
            .from("words")
            .update({ word_data: fallbackData })
            .eq("id", word.id);

          if (updateError) {
            errors.push(`Failed to update ${word.swedish_word}: ${updateError.message}`);
          } else {
            successCount++;
          }
        }
      }

      // Get updated status
      const { count: completed } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .not("word_data", "is", null);

      const { count: total } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true });

      return new Response(
        JSON.stringify({
          processed: successCount,
          errors: errors.length > 0 ? errors : undefined,
          status: {
            completed: completed || 0,
            total: total || 0,
            remaining: (total || 0) - (completed || 0),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'status' or 'populate'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Populate meanings error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

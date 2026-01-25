import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WordData {
  word_type: string;
  gender: string;
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
    // Default batchSize reduced to 5 to avoid timeouts
    const { action, batchSize = 5, apiKey, startId = 1, rangeEnd = 15000, recursionDepth = 0 } = await req.json();

    if (!apiKey) {
      throw new Error("Gemini API Key is required");
    }

    if (recursionDepth > 1000) {
      console.log("Max recursion depth reached. Stopping.");
      return new Response(JSON.stringify({ complete: false, reason: "Max depth" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "populate_background") {
      console.log(`Starting batch: ID ${startId} to ${rangeEnd} (Depth: ${recursionDepth})`);

      const { data: words, error: fetchError } = await supabase
        .from("words")
        .select("id, swedish_word")
        .gte("id", startId)
        .lte("id", rangeEnd)
        .is("word_data", null)
        .order("id", { ascending: true })
        .limit(batchSize);

      if (fetchError) throw fetchError;

      if (!words || words.length === 0) {
        console.log("No more words to populate in this range.");
        return new Response(JSON.stringify({ complete: true, message: "Done" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`Processing ${words.length} words...`);

      let processedCount = 0;
      let errorCount = 0;

      for (const word of words) {
        const prompt = `You are a Swedish-English language expert. Provide a detailed explanation of the Swedish word "${word.swedish_word}" in English.
Format your response as JSON with this exact structure:
{
  "partOfSpeech": "noun/verb/etc",
  "gender": "en/ett/null",
  "meanings": [{"english": "meaning 1", "context": ""}, {"english": "meaning 2", "context": ""}, {"english": "meaning 3", "context": ""}],
  "examples": [{"swedish": "sentence 1", "english": "translation 1"}, {"swedish": "sentence 2", "english": "translation 2"}],
  "synonyms": ["synonym"],
  "antonyms": ["antonym"]
}
Only return the JSON.`;

        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3 }
            }),
          });

          if (!response.ok) {
            console.error(`Gemini API error for ${word.swedish_word}: ${response.status} - ${response.statusText}`);
            errorCount++;
            continue;
          }

          const data = await response.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!responseText) {
            errorCount++;
            continue;
          };

          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            errorCount++;
            continue;
          };

          const result = JSON.parse(jsonMatch[0]);
          const wordData: WordData = {
            word_type: result.partOfSpeech || '',
            gender: result.gender || '',
            meanings: result.meanings || [],
            examples: result.examples || [],
            synonyms: result.synonyms || [],
            antonyms: result.antonyms || [],
            populated_at: new Date().toISOString(),
          };

          await supabase.from("words").update({ word_data: wordData }).eq("id", word.id);
          processedCount++;

          // SAFETY DELAY FOR FREE TIER (15 Requests/Min = 1 req / 4 sec)
          await new Promise(r => setTimeout(r, 4000));

        } catch (err) {
          console.error(`Error processing word ${word.swedish_word}:`, err);
          errorCount++;
        }
      }

      // Recursive Trigger
      const lastProcessedId = words[words.length - 1].id;

      if (lastProcessedId < rangeEnd) {
        const nextStartId = lastProcessedId + 1;
        console.log(`Triggering next batch starting at ${nextStartId}...`);

        const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/populate-meanings`;

        fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'populate_background',
            batchSize,
            apiKey,
            startId: nextStartId,
            rangeEnd,
            recursionDepth: recursionDepth + 1
          })
        }).catch(e => console.error("Failed to trigger next batch:", e));
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${processedCount} words (${errorCount} failed). Background job continuing.`,
        details: { processed: processedCount, errors: errorCount }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});


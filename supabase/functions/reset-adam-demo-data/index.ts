// ==============================================================================
// 2Block Ai — Supabase Edge Function: reset-adam-demo-data
// Target Runtime: Deno / Supabase Edge Functions
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADAM_BASELINE_SUBJECTS = [
  { id: "mathematics", name: "Mathematics", score: 70, mastery: 70, learning_minutes: 412, status: "Active focus", strength: "Addition" },
  { id: "bahasa-melayu", name: "Bahasa Melayu", score: 67, mastery: 67, learning_minutes: 215, status: "On track", strength: "Kata Nama" },
  { id: "english", name: "English", score: 67, mastery: 67, learning_minutes: 195, status: "On track", strength: "Vocabulary" },
  { id: "science", name: "Science", score: 90, mastery: 90, learning_minutes: 165, status: "Strong", strength: "Living Things" }
];

const ADAM_BASELINE_TOPICS = [
  // Mathematics
  { topic_id: "addition", score: 78, status: "Mastered" },
  { topic_id: "subtraction", score: 54, status: "Beginning" },
  { topic_id: "multiplication", score: 72, status: "Developing" },
  { topic_id: "division", score: 68, status: "Developing" },
  { topic_id: "fractions", score: 62, status: "Developing" },
  // Bahasa Melayu
  { topic_id: "kata-nama", score: 80, status: "Mastered" },
  { topic_id: "kata-kerja", score: 65, status: "Developing" },
  { topic_id: "ayat-majmuk", score: 60, status: "Developing" },
  { topic_id: "penanda-wacana", score: 64, status: "Developing" },
  // English
  { topic_id: "reading-comprehension", score: 65, status: "Developing" },
  { topic_id: "vocabulary", score: 75, status: "Mastered" },
  { topic_id: "sentence-structure", score: 64, status: "Developing" },
  { topic_id: "grammar", score: 64, status: "Developing" },
  // Science
  { topic_id: "living-things", score: 92, status: "Mastered" },
  { topic_id: "matter", score: 88, status: "Mastered" },
  { topic_id: "energy-transfer", score: 90, status: "Mastered" }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey;

    const authHeader = req.headers.get("Authorization");
    let callerUser: any = null;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      callerUser = data?.user;
    }

    // Connect via service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Identify Adam Haziq's user ID
    let adamUserId = callerUser?.id;
    if (!adamUserId || callerUser?.email !== "adam.haziq@twoblock.ai") {
      const { data: users } = await adminClient.auth.admin.listUsers();
      const adam = users?.users?.find(u => u.email === "adam.haziq@twoblock.ai");
      if (adam) {
        adamUserId = adam.id;
      }
    }

    if (!adamUserId) {
      return new Response(JSON.stringify({ error: "Adam Haziq demo account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Delete extra practice attempts beyond baseline
    await adminClient
      .from("practice_attempts")
      .delete()
      .eq("student_id", adamUserId);

    // 2. Restore subject progress
    for (const sub of ADAM_BASELINE_SUBJECTS) {
      await adminClient.from("student_subject_progress").upsert({
        student_id: adamUserId,
        subject_id: sub.id,
        score: sub.score,
        mastery: sub.mastery,
        learning_minutes: sub.learning_minutes,
        status: sub.status,
        strength: sub.strength
      });
    }

    // 3. Restore topic progress
    for (const top of ADAM_BASELINE_TOPICS) {
      await adminClient.from("student_topic_progress").upsert({
        student_id: adamUserId,
        topic_id: top.topic_id,
        score: top.score,
        status: top.status
      });
    }

    // 4. Restore priority recommendation
    await adminClient.from("ai_recommendations").delete().eq("student_id", adamUserId);
    await adminClient.from("ai_recommendations").insert({
      student_id: adamUserId,
      subject: "Mathematics",
      topic: "Subtraction",
      title: "Build confidence in subtraction",
      reason: "Subtraction is the lowest Mathematics topic and supports future division learning.",
      current_score: 54,
      recommended_minutes: 15,
      status: "active"
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Adam Haziq demo data reset to baseline successfully.",
        userId: adamUserId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to reset demo data" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

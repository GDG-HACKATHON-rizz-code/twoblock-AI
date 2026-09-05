// ==============================================================================
// 2Block Ai — Supabase Edge Function: process-practice-result
// Target Runtime: Deno / Supabase Edge Functions
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCORING_WEIGHTS = {
  PREVIOUS: 0.7,
  LATEST: 0.3,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client with user auth context
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for privileged atomic calculations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      topic = "subtraction",
      subject = "Mathematics",
      question = "",
      submittedAnswer = "",
      correctAnswer = "",
      isCorrect = false,
      timeSpentSeconds = 5,
      level = 1,
    } = body;

    const studentId = user.id;
    const topicKey = String(topic).toLowerCase().trim();
    const topicTitle = topic.charAt(0).toUpperCase() + topic.slice(1);
    const subjectId = String(subject).toLowerCase().replace(/\s+/g, "-");
    const nowIso = new Date().toISOString();

    // 1. Save question attempt to practice_attempts
    const { data: attempt, error: attemptErr } = await adminClient
      .from("practice_attempts")
      .insert({
        student_id: studentId,
        topic_id: topicKey,
        subject_id: subjectId,
        level,
        question,
        submitted_answer: String(submittedAnswer),
        correct_answer: String(correctAnswer),
        is_correct: isCorrect,
        time_spent_seconds: timeSpentSeconds,
        attempted_at: nowIso,
      })
      .select()
      .single();

    // 2. Fetch current topic progress
    const { data: existingTopic } = await adminClient
      .from("student_topic_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("topic_id", topicKey)
      .maybeSingle();

    const previousTopicScore = existingTopic?.score ?? 50;
    const previousCorrect = existingTopic?.correct_answers ?? 0;
    const previousTotal = existingTopic?.total_answers ?? 0;

    const newCorrect = previousCorrect + (isCorrect ? 1 : 0);
    const newTotal = previousTotal + 1;
    const accuracyPercent = Math.round((newCorrect / newTotal) * 100);

    // Weighted recalculation: (previous * 0.7) + (latest * 0.3)
    const attemptScore = isCorrect ? 100 : 0;
    const newTopicScore = previousTopicScore <= 0
      ? attemptScore
      : Math.round((previousTopicScore * SCORING_WEIGHTS.PREVIOUS) + (attemptScore * SCORING_WEIGHTS.LATEST));

    const topicMastery = newTopicScore >= 75 ? "Mastered" : newTopicScore >= 55 ? "Developing" : "Beginning";

    // Upsert student_topic_progress
    const { data: updatedTopic } = await adminClient
      .from("student_topic_progress")
      .upsert({
        student_id: studentId,
        topic_id: topicKey,
        score: newTopicScore,
        correct_answers: newCorrect,
        total_answers: newTotal,
        accuracy_percent: accuracyPercent,
        status: topicMastery,
        time_spent_seconds: timeSpentSeconds,
        latest_activity_date: nowIso,
      })
      .select()
      .single();

    // 3. Recalculate subject progress
    const { data: allTopics } = await adminClient
      .from("student_topic_progress")
      .select("*")
      .eq("student_id", studentId);

    const relatedTopics = (allTopics || []).filter((t: any) =>
      ["addition", "subtraction", "multiplication", "division"].includes(t.topic_id)
    );
    const avgScore = relatedTopics.length
      ? Math.round(relatedTopics.reduce((sum: number, t: any) => sum + (t.score || 0), 0) / relatedTopics.length)
      : newTopicScore;

    const { data: existingSubject } = await adminClient
      .from("student_subject_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    const prevSubjectScore = existingSubject?.score ?? avgScore;
    const trend = avgScore > prevSubjectScore ? "up" : avgScore < prevSubjectScore ? "down" : "steady";
    const learningMinutes = (existingSubject?.learning_minutes ?? 0) + Math.max(1, Math.round(timeSpentSeconds / 60));

    await adminClient.from("student_subject_progress").upsert({
      student_id: studentId,
      subject_id: subjectId,
      score: avgScore,
      mastery: avgScore >= 80 ? 90 : avgScore >= 65 ? 75 : 55,
      learning_minutes: learningMinutes,
      trend,
      status: avgScore >= 80 ? "Mastered" : avgScore >= 65 ? "On track" : "Building skills",
      strength: topicTitle,
      latest_activity_date: nowIso,
    });

    // 4. Update recommendations if score is weak or mastered
    if (newTopicScore >= 75) {
      // Mark recommendation completed/inactive
      await adminClient
        .from("recommendations")
        .update({ status: "completed" })
        .eq("student_id", studentId)
        .eq("topic_id", topicKey);
    } else if (newTopicScore < 60) {
      await adminClient.from("recommendations").upsert({
        id: `rec-${topicKey}-${studentId.substring(0, 8)}`,
        student_id: studentId,
        subject_id: subjectId,
        topic_id: topicKey,
        title: `Build confidence in ${topicTitle}`,
        reason: `Your score in ${topicTitle} is ${newTopicScore}%. Practice will help close this gap.`,
        current_score: newTopicScore,
        time_spent_minutes: Math.max(5, Math.round(timeSpentSeconds / 60)),
        recommended_duration_minutes: 15,
        status: "active",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          isCorrect,
          correctAnswer,
          topicProgress: {
            id: topicKey,
            name: topicTitle,
            previousScore: previousTopicScore,
            score: newTopicScore,
            correctAnswers: newCorrect,
            totalAnswers: newTotal,
            accuracyPercent,
            status: topicMastery,
            latestActivityDate: nowIso,
          },
          subjectProgress: {
            id: subjectId,
            name: subject,
            score: avgScore,
            trend,
            learningMinutes,
          },
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

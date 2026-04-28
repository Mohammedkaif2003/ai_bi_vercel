import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { analyze } from "@/lib/api";
import type { ChatMessage, AnalysisResult, ChatSession, User } from "@/lib/types";

interface UseChatProps {
  user: User | null;
  datasetKey?: string;
  datasetName?: string;
  onSessionCreated?: (session: ChatSession) => void;
  initialSessionId?: string | null;
}

export function useChat({ 
  user, 
  datasetKey, 
  datasetName, 
  onSessionCreated, 
  initialSessionId 
}: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  
  const historyRef = useRef<ChatMessage[]>([]);
  const lastLoadedSessionId = useRef<string | null>(initialSessionId || null);

  // Sync session ID if prop changes
  useEffect(() => {
    if (initialSessionId !== undefined) {
      setSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  // Load messages for a session
  const loadSession = useCallback(async (sid: string) => {
    if (!sid) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sid)
        .order("created_at", { ascending: true });

      if (err) throw err;

      const msgs: ChatMessage[] = (data || []).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        result: m.result_data,
        chart: m.chart_spec,
        query_type: m.query_type,
        timestamp: new Date(m.created_at).getTime()
      }));

      setMessages(msgs);
      historyRef.current = msgs;
    } catch (err: any) {
      setError(err.message || "Failed to load chat history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effect to load session data when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== lastLoadedSessionId.current) {
      loadSession(sessionId);
      lastLoadedSessionId.current = sessionId;
    } else if (!sessionId) {
      setMessages([]);
      historyRef.current = [];
      lastLoadedSessionId.current = null;
    }
  }, [sessionId, loadSession]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user || !datasetKey || isLoading) return;

    setIsLoading(true);
    setError(null);

    const userTimestamp = Date.now();
    const userMsg: ChatMessage = { 
      role: "user", 
      content: content.trim(), 
      timestamp: userTimestamp 
    };

    // Optimistic update
    setMessages(prev => [...prev, userMsg]);

    try {
      let activeSessionId = sessionId;

      // 1. Create session if it doesn't exist
      if (!activeSessionId) {
        const { data: newSession, error: sessionErr } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            dataset_name: datasetName || "Unknown Dataset",
            dataset_key: datasetKey,
            title: content.length > 35 ? content.substring(0, 35) + "..." : content
          })
          .select()
          .single();

        if (sessionErr) throw sessionErr;
        activeSessionId = newSession.id;
        lastLoadedSessionId.current = activeSessionId; // Mark as loaded so useEffect skips it
        setSessionId(activeSessionId);
        if (onSessionCreated) onSessionCreated(newSession);
      }

      // 2. Persist User Message
      await supabase.from("chat_messages").insert({
        session_id: activeSessionId,
        role: "user",
        content: content.trim(),
        created_at: new Date(userTimestamp).toISOString()
      });

      // 3. Call Analysis API
      const result = await analyze(content, datasetKey, datasetName);

      const assistantTimestamp = Date.now();
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: result.narration || result.summary || "Analysis complete.",
        result: result.result,
        chart: result.chart,
        query_type: result.query_type,
        timestamp: assistantTimestamp
      };

      // 4. Update UI
      setMessages(prev => [...prev, aiMsg]);

      // 5. Persist Assistant Message
      await supabase.from("chat_messages").insert({
        session_id: activeSessionId,
        role: "assistant",
        content: aiMsg.content,
        chart_spec: aiMsg.chart,
        result_data: aiMsg.result,
        query_type: aiMsg.query_type,
        created_at: new Date(assistantTimestamp).toISOString()
      });

    } catch (err: any) {
      console.error("Chat Error:", err);
      const errorMessage = err.message || "Something went wrong during analysis.";
      setError(errorMessage);
      
      // Remove the optimistic user message if the first message failed and session wasn't created
      // or just show the error clearly.
      setMessages(prev => {
        const next = [...prev];
        next.push({
          role: "assistant",
          content: `❌ Error: ${errorMessage}`,
          timestamp: Date.now()
        });
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, datasetKey, datasetName, sessionId, isLoading, onSessionCreated]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    historyRef.current = [];
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearChat,
    loadSession,
    setSessionId
  };
}

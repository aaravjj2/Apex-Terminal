/**
 * Nova Service — Apex Terminal
 * Client-side API wrapper for all Amazon Nova endpoints.
 * Routes /api/v1/nova/* through the FastAPI backend (Bedrock in prod, demo otherwise).
 */

const BASE = "/api/v1/nova";

// ── Shared helpers ──────────────────────────────────────────────────────────
async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error((err as { detail: string }).detail || resp.statusText);
  }
  return resp.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) throw new Error(resp.statusText);
  return resp.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface NovaStatus {
  enabled: boolean;
  sonic_enabled: boolean;
  act_enabled: boolean;
  connected: boolean;
  model_id: string;
  region: string;
  demo_mode: boolean;
}

export interface NovaModel {
  id: string;
  name: string;
  use_case: string;
}

export interface GenerateResponse {
  text: string;
  model: string;
  tokens_used: number;
  latency_ms: number;
  request_hash: string;
  demo_mode: boolean;
  session_id: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  tokens_used: number;
  latency_ms: number;
  demo_mode: boolean;
}

export interface ChartAnalysisResponse {
  analysis: string;
  patterns_detected: string[];
  signals: Array<Record<string, unknown>>;
  confidence: number;
  model: string;
  demo_mode: boolean;
  latency_ms: number;
}

export interface VoiceResponse {
  transcript: string;
  response_text: string;
  response_audio_b64: string | null;
  model: string;
  demo_mode: boolean;
  latency_ms: number;
}

export interface AgentStep {
  step: number;
  tool: string;
  description: string;
  result: string;
  latency_ms: number;
}

export interface AgentResearchResponse {
  ticker: string;
  thesis: string;
  recommendation: "BUY" | "SELL" | "HOLD" | "WATCH";
  conviction: number;
  steps: AgentStep[];
  risk_factors: string[];
  catalysts: string[];
  model: string;
  demo_mode: boolean;
  total_latency_ms: number;
}

export interface PatternMatch {
  pattern_name: string;
  similarity: number;
  historical_outcome: string;
  avg_return_30d: number;
  occurrences: number;
}

export interface PatternSearchResponse {
  matches: PatternMatch[];
  model: string;
  demo_mode: boolean;
  latency_ms: number;
}

export interface ActAutomateResponse {
  task: string;
  status: string;
  result_summary: string;
  steps: Array<{ step: number; action: string; target: string; result: string }>;
  data_extracted: Record<string, unknown>;
  model: string;
  demo_mode: boolean;
}

export interface ValidateResponse {
  approved: boolean;
  confidence: number;
  reasoning: string;
  risk_flags: string[];
  suggestion: string;
  request_hash: string;
  demo_mode: boolean;
}

// ── API methods ─────────────────────────────────────────────────────────────

/** Get Nova / Bedrock connectivity status. */
export async function getNovaStatus(): Promise<NovaStatus> {
  return get<NovaStatus>("/status");
}

/** List all available Nova models in this integration. */
export async function getNovaModels(): Promise<{ models: NovaModel[]; nova_enabled: boolean }> {
  return get<{ models: NovaModel[]; nova_enabled: boolean }>("/models");
}

/** Single-turn text generation (Nova 2 Lite). */
export async function generateText(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number; systemPrompt?: string; sessionId?: string }
): Promise<GenerateResponse> {
  return post<GenerateResponse>("/generate", {
    prompt,
    max_tokens:    opts?.maxTokens    ?? 512,
    temperature:   opts?.temperature  ?? 0.3,
    system_prompt: opts?.systemPrompt ?? "You are an expert trading and financial analysis assistant.",
    session_id:    opts?.sessionId,
  });
}

/** Multi-turn chat (Nova 2 Lite, conversation context preserved by caller). */
export async function chat(
  messages: ChatMessage[],
  opts?: { systemPrompt?: string; maxTokens?: number; temperature?: number }
): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", {
    messages,
    system_prompt: opts?.systemPrompt,
    max_tokens:    opts?.maxTokens   ?? 1024,
    temperature:   opts?.temperature ?? 0.3,
  });
}

/** Send a chart screenshot to Nova Pro for multimodal vision analysis. */
export async function analyzeChart(
  imageFile: File,
  opts?: { timeframe?: string; symbol?: string; extraContext?: string }
): Promise<ChartAnalysisResponse> {
  const form = new FormData();
  form.append("image", imageFile);
  form.append("timeframe",     opts?.timeframe    ?? "1D");
  form.append("symbol",        opts?.symbol       ?? "UNKNOWN");
  form.append("extra_context", opts?.extraContext ?? "");

  const resp = await fetch(`${BASE}/analyze-chart`, { method: "POST", body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error((err as { detail: string }).detail || resp.statusText);
  }
  return resp.json() as Promise<ChartAnalysisResponse>;
}

/**
 * Send base64-encoded audio to Nova Sonic for speech-to-speech.
 * In demo mode the backend simulates a transcript + response.
 */
export async function voiceTranscribe(
  audioB64: string,
  opts?: { sampleRate?: number; language?: string }
): Promise<VoiceResponse> {
  return post<VoiceResponse>("/voice/transcribe", {
    audio_b64:   audioB64,
    sample_rate: opts?.sampleRate ?? 16000,
    language:    opts?.language   ?? "en-US",
  });
}

/** Multi-step agentic research on a ticker (Nova 2 Lite chain of tools). */
export async function agentResearch(
  ticker: string,
  opts?: { depth?: "quick" | "standard" | "deep"; includeOptions?: boolean; includeMacro?: boolean }
): Promise<AgentResearchResponse> {
  return post<AgentResearchResponse>("/agent/research", {
    ticker,
    research_depth:  opts?.depth          ?? "standard",
    include_options: opts?.includeOptions ?? false,
    include_macro:   opts?.includeMacro   ?? false,
  });
}

/**
 * Nova Act: browser automation agent to extract financial data.
 * NOVA_ACT_ENABLED=1 on server activates real Nova Act SDK.
 */
export async function actAutomate(
  task: string,
  opts?: { targetUrl?: string; maxSteps?: number }
): Promise<ActAutomateResponse> {
  return post<ActAutomateResponse>("/act/automate", {
    task,
    target_url: opts?.targetUrl,
    max_steps:  opts?.maxSteps ?? 5,
  });
}

/** Find similar historical chart patterns via Nova Multimodal Embeddings. */
export async function patternSearch(
  imageB64: string,
  topK = 3
): Promise<PatternSearchResponse> {
  return post<PatternSearchResponse>("/multimodal/pattern-search", {
    image_b64: imageB64,
    top_k:     topK,
  });
}

/** Validate a trade candidate through Nova compliance gate. */
export async function validateTrade(
  candidate: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ValidateResponse> {
  return post<ValidateResponse>("/validate", { candidate, context: context ?? {} });
}

/** Check a financial claim for hallucination markers. */
export async function hallucinationCheck(
  claim: string,
  context?: string
): Promise<{ is_hallucination: boolean; confidence: number; reasoning: string }> {
  return post("/hallucination-check", { claim, context: context ?? "" });
}

/**
 * Convert a File or canvas blob to base64 string.
 * Useful for chart screenshot → analyzeChart or patternSearch.
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix for the API (expects raw base64)
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

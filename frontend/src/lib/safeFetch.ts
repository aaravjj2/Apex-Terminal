/**
 * Phase C — Safe JSON Fetch Wrapper
 * Prevents "Unexpected end of JSON input" by checking status, content-type,
 * and body before parsing. Produces structured frontend errors.
 */

export interface ApiFetchError {
  ok: false;
  code: string;
  message: string;
  url: string;
  status: number;
  correlation_id: string | null;
  raw_snippet: string | null;
}

export interface ApiFetchOk<T> {
  ok: true;
  data: T;
  correlation_id: string | null;
}

export type ApiFetchResult<T> = ApiFetchOk<T> | ApiFetchError;

/**
 * Safe fetch wrapper that ALWAYS returns valid structured data.
 * Never throws — returns ApiFetchError on failure.
 */
export async function safeFetch<T = any>(
  url: string,
  init?: RequestInit,
): Promise<ApiFetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err: any) {
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: err?.message || 'Network request failed',
      url,
      status: 0,
      correlation_id: null,
      raw_snippet: null,
    };
  }

  const correlationId = response.headers.get('x-correlation-id');

  if (!response.ok) {
    // Try to parse JSON error body
    let body: any = null;
    try {
      const text = await response.text();
      if (text.length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      // Not JSON — use raw
    }

    return {
      ok: false,
      code: body?.code || `HTTP_${response.status}`,
      message: body?.message || `HTTP ${response.status}: ${response.statusText}`,
      url,
      status: response.status,
      correlation_id: body?.correlation_id || correlationId,
      raw_snippet: typeof body === 'string' ? body.slice(0, 200) : null,
    };
  }

  // Check Content-Type
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    // Non-JSON success — try to read as text
    try {
      const text = await response.text();
      if (text.length === 0) {
        return {
          ok: false,
          code: 'EMPTY_RESPONSE',
          message: 'Server returned empty response',
          url,
          status: response.status,
          correlation_id: correlationId,
          raw_snippet: null,
        };
      }
      // Attempt JSON parse anyway (some servers don't set content-type)
      try {
        const data = JSON.parse(text);
        return { ok: true, data, correlation_id: correlationId };
      } catch {
        return {
          ok: false,
          code: 'NOT_JSON',
          message: `Expected JSON, got ${ct || 'unknown content-type'}`,
          url,
          status: response.status,
          correlation_id: correlationId,
          raw_snippet: text.slice(0, 200),
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        code: 'READ_ERROR',
        message: err?.message || 'Failed to read response',
        url,
        status: response.status,
        correlation_id: correlationId,
        raw_snippet: null,
      };
    }
  }

  // JSON content-type — parse safely
  try {
    const text = await response.text();
    if (text.length === 0) {
      return {
        ok: false,
        code: 'EMPTY_JSON',
        message: 'Server returned empty JSON body',
        url,
        status: response.status,
        correlation_id: correlationId,
        raw_snippet: null,
      };
    }
    const data = JSON.parse(text);
    return { ok: true, data, correlation_id: correlationId };
  } catch (err: any) {
    return {
      ok: false,
      code: 'JSON_PARSE_ERROR',
      message: err?.message || 'Failed to parse JSON',
      url,
      status: response.status,
      correlation_id: correlationId,
      raw_snippet: null,
    };
  }
}

/**
 * Convenience: fetch JSON data or return null on error (logs to console).
 */
export async function fetchJsonOrNull<T = any>(url: string, init?: RequestInit): Promise<T | null> {
  const result = await safeFetch<T>(url, init);
  if (!result.ok) {
    console.error(`[safeFetch] ${result.code}: ${result.message}`, { url, status: result.status, correlation_id: result.correlation_id });
    return null;
  }
  return result.data;
}

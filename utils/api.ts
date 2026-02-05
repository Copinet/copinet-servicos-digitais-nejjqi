import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BEARER_TOKEN_KEY } from "@/lib/auth";

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || "";

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Get bearer token from platform-specific storage
 * Web: localStorage
 * Native: SecureStore
 *
 * @returns Bearer token or null if not found
 */
export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error("[API] Error retrieving bearer token:", error);
    return null;
  }
};

/**
 * Generic API call helper with error handling
 *
 * @param endpoint - API endpoint path (e.g., '/users', '/auth/login')
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if backend is not configured or request fails
 */
export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log("[API] Calling:", url, options?.method || "GET");

  try {
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    };

    console.log("[API] Fetch options:", fetchOptions);

    // Always send the token if we have it (needed for cross-domain/iframe support)
    const token = await getBearerToken();
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      console.error("[API] Error response:", response.status, text);
      throw new Error(`API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log("[API] Success:", data);
    return data;
  } catch (error) {
    console.error("[API] Request failed:", error);
    throw error;
  }
};

/**
 * GET request helper
 */
export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, { method: "GET" });
};

/**
 * POST request helper
 */
export const apiPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * PUT request helper
 */
export const apiPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * PATCH request helper
 */
export const apiPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request helper
 * Always sends a body to avoid FST_ERR_CTP_EMPTY_JSON_BODY errors
 */
export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated API call helper
 * Automatically retrieves bearer token from storage and adds to Authorization header
 *
 * @param endpoint - API endpoint path
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if token not found or request fails
 */
export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = await getBearerToken();

  if (!token) {
    throw new Error("Authentication token not found. Please sign in.");
  }

  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};

/**
 * Authenticated GET request
 */
export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, { method: "GET" });
};

/**
 * Authenticated POST request
 */
export const authenticatedPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PUT request
 */
export const authenticatedPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PATCH request
 */
export const authenticatedPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated DELETE request
 * Always sends a body to avoid FST_ERR_CTP_EMPTY_JSON_BODY errors
 */
export const authenticatedDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};

/**
 * Upload a single file with progress tracking
 * 
 * @param file - File object with uri, name, and type
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload response with url, filename, size, mimeType, pageCount
 */
export const uploadFile = async (
  file: { uri: string; name: string; type: string },
  onProgress?: (progress: number) => void
): Promise<{
  success: boolean;
  url?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  pageCount?: number;
  error?: string;
  code?: string;
}> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  const formData = new FormData();
  formData.append('file', file as any);

  const token = await getBearerToken();
  const url = `${BACKEND_URL}/api/upload/document`;

  console.log('[API] Uploading file:', file.name);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API] Upload failed:', response.status, data);
      return {
        success: false,
        error: data.error || `Upload failed: ${response.status}`,
        code: data.code || 'UPLOAD_FAILED',
      };
    }

    console.log('[API] Upload successful:', data);
    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error('[API] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      code: 'NETWORK_ERROR',
    };
  }
};

/**
 * Upload multiple files in parallel with batch processing
 * 
 * @param files - Array of file objects with uri, name, and type
 * @param onProgress - Optional callback for overall progress (0-100)
 * @returns Upload results with successful uploads and failed uploads
 */
export const uploadMultipleFiles = async (
  files: Array<{ uri: string; name: string; type: string }>,
  onProgress?: (progress: number) => void
): Promise<{
  uploads: Array<{
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    pageCount: number;
  }>;
  failed: Array<{
    filename: string;
    error: string;
  }>;
}> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  console.log('[API] Uploading multiple files:', files.length);

  const uploads: any[] = [];
  const failed: any[] = [];
  let completed = 0;

  // Upload files in parallel (max 3 at a time to avoid overwhelming the server)
  const batchSize = 3;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(file => uploadFile(file))
    );

    results.forEach((result, index) => {
      const file = batch[index];
      if (result.success && result.url) {
        uploads.push({
          url: result.url,
          filename: result.filename || file.name,
          size: result.size || 0,
          mimeType: result.mimeType || file.type,
          pageCount: result.pageCount || 1,
        });
      } else {
        failed.push({
          filename: file.name,
          error: result.error || 'Upload failed',
        });
      }
      completed++;
      if (onProgress) {
        onProgress(Math.round((completed / files.length) * 100));
      }
    });
  }

  console.log('[API] Batch upload complete:', { uploads: uploads.length, failed: failed.length });
  return { uploads, failed };
};

/**
 * Get user-friendly error message in Portuguese
 */
export const getErrorMessage = (code?: string, defaultMessage?: string): string => {
  const errorMessages: Record<string, string> = {
    'FILE_TOO_LARGE': 'Arquivo muito grande. O tamanho máximo é 100MB.',
    'INVALID_FORMAT': 'Formato de arquivo inválido. Use PDF, Word, ou imagens (JPG, PNG).',
    'PROCESSING_FAILED': 'Não foi possível processar o arquivo. Tente novamente.',
    'TIMEOUT': 'O processamento demorou muito. Tente com um arquivo menor.',
    'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'UPLOAD_FAILED': 'Falha no upload. Tente novamente.',
    'UNAUTHORIZED': 'Você precisa fazer login para continuar.',
  };

  return errorMessages[code || ''] || defaultMessage || 'Ocorreu um erro. Tente novamente.';
};


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

    // Try to parse as JSON first
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // If not JSON, get text and try to parse it
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        // If parsing fails, return error with the text
        console.error("[API] Non-JSON response:", text);
        throw new Error(`Erro no servidor: ${response.status}`);
      }
    }

    if (!response.ok) {
      console.error("[API] Error response:", response.status, data);
      throw new Error(data.error || `API error: ${response.status}`);
    }

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
 * Sanitize filename for upload
 * Removes special characters and normalizes the name
 */
const sanitizeFilename = (filename: string): string => {
  // Remove path separators
  let sanitized = filename.replace(/[/\\]/g, '_');
  
  // Keep only alphanumeric, dots, dashes, underscores, and spaces
  sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_ ]/g, '');
  
  // Limit length to 200 characters
  if (sanitized.length > 200) {
    const ext = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = nameWithoutExt.substring(0, 190) + '.' + ext;
  }
  
  return sanitized || 'file';
};

/**
 * Upload a single file with progress tracking and retry logic
 * Server-side page counting - no local processing to avoid freezing
 * 
 * @param file - File object with uri, name, and type
 * @param onProgress - Optional callback for upload progress (0-100)
 * @param retries - Number of retry attempts (default: 3)
 * @returns Upload response with url, filename, size, mimeType, pageCount (from server)
 */
export const uploadFile = async (
  file: { uri: string; name: string; type: string },
  onProgress?: (progress: number) => void,
  retries: number = 3
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

  const token = await getBearerToken();
  
  if (!token) {
    console.error('[API] No authentication token found');
    return {
      success: false,
      error: 'Você precisa fazer login para fazer upload de arquivos',
      code: 'UNAUTHORIZED',
    };
  }

  const url = `${BACKEND_URL}/api/upload/document`;

  console.log('[API] Uploading file:', file.name, 'Token present:', !!token);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData();
      
      // Sanitize filename
      const sanitizedName = sanitizeFilename(file.name);
      
      // Create file object for FormData
      const fileObj: any = {
        uri: file.uri,
        name: sanitizedName,
        type: file.type || 'application/octet-stream',
      };
      
      formData.append('file', fileObj);

      console.log(`[API] Upload attempt ${attempt}/${retries} for:`, sanitizedName);
      console.log('[API] Auth token (first 20 chars):', token.substring(0, 20) + '...');

      // Report initial progress
      if (onProgress) {
        onProgress(10);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let the browser/RN set it with boundary for multipart/form-data
        },
        body: formData,
      });

      // Report upload complete, waiting for processing
      if (onProgress) {
        onProgress(60);
      }

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('[API] Non-JSON response:', text.substring(0, 200));
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        console.error('[API] Upload failed:', response.status, data);
        
        // Special handling for auth errors
        if (response.status === 401) {
          return {
            success: false,
            error: 'Sessão expirada. Por favor, faça login novamente.',
            code: 'UNAUTHORIZED',
          };
        }
        
        // If it's a client error (4xx), don't retry
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            error: data.error || `Upload falhou: ${response.status}`,
            code: data.code || 'UPLOAD_FAILED',
          };
        }
        
        // For server errors (5xx), retry
        throw new Error(data.error || `Erro do servidor: ${response.status}`);
      }

      console.log('[API] Upload successful. Server processed pages:', data.pageCount);
      if (onProgress) {
        onProgress(100);
      }
      
      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error(`[API] Upload error (attempt ${attempt}/${retries}):`, error);
      
      // If this was the last attempt, return error
      if (attempt === retries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload falhou',
          code: 'NETWORK_ERROR',
        };
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[API] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but just in case
  return {
    success: false,
    error: 'Upload falhou após múltiplas tentativas',
    code: 'MAX_RETRIES_EXCEEDED',
  };
};

/**
 * Upload multiple files in parallel with batch processing
 * Server handles page counting - keeps loading state active until all files are processed
 * 
 * @param files - Array of file objects with uri, name, and type
 * @param onProgress - Optional callback for overall progress (0-100)
 * @param onFileProgress - Optional callback for individual file progress
 * @returns Upload results with successful uploads and failed uploads
 */
export const uploadMultipleFiles = async (
  files: Array<{ uri: string; name: string; type: string }>,
  onProgress?: (progress: number) => void,
  onFileProgress?: (fileIndex: number, fileName: string, status: 'uploading' | 'processing' | 'complete' | 'failed') => void
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
    code?: string;
  }>;
}> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  console.log('[API] Uploading multiple files:', files.length);

  const uploads: any[] = [];
  const failed: any[] = [];
  let completed = 0;

  // Upload files in parallel (max 2 at a time for large files to avoid timeouts)
  const batchSize = 2;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map((file, batchIndex) => {
        const fileIndex = i + batchIndex;
        
        // Notify that file upload is starting
        if (onFileProgress) {
          onFileProgress(fileIndex, file.name, 'uploading');
        }
        
        return uploadFile(file, (fileProgress) => {
          // Individual file progress
          if (fileProgress >= 60 && onFileProgress) {
            onFileProgress(fileIndex, file.name, 'processing');
          }
        });
      })
    );

    results.forEach((result, index) => {
      const file = batch[index];
      const fileIndex = i + index;
      
      if (result.success && result.url) {
        uploads.push({
          url: result.url,
          filename: result.filename || file.name,
          size: result.size || 0,
          mimeType: result.mimeType || file.type,
          pageCount: result.pageCount || 1,
        });
        
        if (onFileProgress) {
          onFileProgress(fileIndex, file.name, 'complete');
        }
        
        console.log(`[API] File ${fileIndex + 1}/${files.length} uploaded successfully:`, file.name, 'Pages:', result.pageCount);
      } else {
        failed.push({
          filename: file.name,
          error: result.error || 'Upload falhou',
          code: result.code,
        });
        
        if (onFileProgress) {
          onFileProgress(fileIndex, file.name, 'failed');
        }
        
        console.error(`[API] File ${fileIndex + 1}/${files.length} failed:`, file.name, result.error);
      }
      
      completed++;
      if (onProgress) {
        const overallProgress = Math.round((completed / files.length) * 100);
        onProgress(overallProgress);
        console.log(`[API] Overall progress: ${overallProgress}% (${completed}/${files.length})`);
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
    'FILE_TOO_LARGE': 'Arquivo muito grande. O tamanho máximo é 150MB.',
    'TOO_MANY_PAGES': 'PDF com muitas páginas. O máximo é 1500 páginas.',
    'INVALID_FORMAT': 'Formato de arquivo inválido. Use PDF, Word, ou imagens (JPG, PNG).',
    'PROCESSING_FAILED': 'Não foi possível processar o arquivo. Tente novamente.',
    'TIMEOUT': 'O processamento demorou muito (máx. 5 minutos). Tente com um arquivo menor.',
    'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'UPLOAD_FAILED': 'Falha no upload. Tente novamente.',
    'UNAUTHORIZED': 'Você precisa fazer login para continuar.',
    'STORAGE_PERMISSION_DENIED': 'Erro de permissão no armazenamento. Entre em contato com o suporte.',
    'NO_FILE': 'Nenhum arquivo foi selecionado.',
    'MAX_RETRIES_EXCEEDED': 'Upload falhou após múltiplas tentativas. Verifique sua conexão.',
  };

  return errorMessages[code || ''] || defaultMessage || 'Ocorreu um erro. Tente novamente.';
};

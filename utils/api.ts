
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
      
      // Special handling for specific error codes
      if (response.status === 413) {
        throw new Error('Arquivo muito grande. O servidor aceita no máximo 100MB por arquivo.');
      }
      
      if (response.status === 404) {
        if (data.code === 'PARTNER_NOT_FOUND') {
          throw new Error('Erro ao conectar com a loja. Parceiro não encontrado.');
        }
        throw new Error(data.error || 'Erro ao conectar com a loja.');
      }
      
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
 * Upload a single file via backend API
 * Optionally accepts localPageCount to override backend counting
 */
export const uploadFile = async (
  file: { uri: string; name: string; type: string; localPageCount?: number },
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

  console.log('[API] Uploading file via backend:', file.name, 'Token present:', !!token);

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
      
      // If localPageCount is provided, send it to backend (backend will use it instead of recounting)
      if (file.localPageCount !== undefined && file.localPageCount > 0) {
        formData.append('localPageCount', String(file.localPageCount));
        console.log(`[API] Sending LOCAL page count to backend: ${file.localPageCount} for ${sanitizedName}`);
      }

      console.log(`[API] Upload attempt ${attempt}/${retries} for:`, sanitizedName);

      // Report initial progress
      if (onProgress) {
        onProgress(10);
      }

      // Create AbortController for timeout (120 seconds for large files up to 100MB)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
        
        if (response.status === 413 || text.toLowerCase().includes('payload') || text.toLowerCase().includes('too large')) {
          return {
            success: false,
            error: 'Arquivo muito grande. O servidor aceita no máximo 100MB por arquivo.',
            code: 'PAYLOAD_TOO_LARGE',
          };
        }
        
        return {
          success: false,
          error: 'Resposta inválida do servidor.',
          code: 'INVALID_RESPONSE',
        };
      }

      if (!response.ok) {
        console.error('[API] Upload failed:', response.status, data);
        
        if (response.status === 413) {
          return {
            success: false,
            error: 'Arquivo muito grande. O servidor aceita no máximo 100MB por arquivo.',
            code: 'PAYLOAD_TOO_LARGE',
          };
        }
        
        if (response.status === 401) {
          return {
            success: false,
            error: 'Sessão expirada. Por favor, faça login novamente.',
            code: 'UNAUTHORIZED',
          };
        }
        
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            error: data.error || getErrorMessage(data.code) || `Upload falhou: ${response.status}`,
            code: data.code || 'UPLOAD_FAILED',
          };
        }
        
        throw new Error(data.error || `Erro do servidor: ${response.status}`);
      }

      console.log('[API] Upload successful via backend:', data);
      if (onProgress) {
        onProgress(100);
      }
      
      return {
        success: true,
        ...data,
      };
    } catch (error: any) {
      console.error(`[API] Upload error (attempt ${attempt}/${retries}):`, error);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Upload excedeu o tempo limite (120s). Tente com um arquivo menor.',
          code: 'UPLOAD_TIMEOUT',
        };
      }
      
      if (attempt === retries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload falhou',
          code: 'NETWORK_ERROR',
        };
      }
      
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[API] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: 'Upload falhou após múltiplas tentativas',
    code: 'MAX_RETRIES_EXCEEDED',
  };
};

/**
 * Upload multiple files with LOCAL page count (ONE BY ONE)
 * The frontend provides the page count, backend just stores the file
 */
export const uploadMultipleFilesWithPageCount = async (
  files: { uri: string; name: string; type: string; localPageCount: number }[],
  onProgress?: (progress: number) => void,
  onFileProgress?: (fileIndex: number, fileName: string, status: 'uploading' | 'complete' | 'failed') => void
): Promise<{
  uploads: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    pageCount: number;
  }[];
  failed: {
    filename: string;
    error: string;
    code?: string;
  }[];
}> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  console.log('[API] Uploading multiple files with LOCAL page counts (ONE BY ONE):', files.length);

  const uploads: any[] = [];
  const failed: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    console.log(`[API] Uploading file ${i + 1}/${files.length}:`, file.name, `(Local count: ${file.localPageCount} páginas)`);
    
    if (onFileProgress) {
      onFileProgress(i, file.name, 'uploading');
    }
    
    const result = await uploadFile(file);
    
    if (result.success && result.url) {
      // Use LOCAL page count, ignore backend count
      uploads.push({
        url: result.url,
        filename: result.filename || file.name,
        size: result.size || 0,
        mimeType: result.mimeType || file.type,
        pageCount: file.localPageCount, // PRIORIDADE: Contagem local do frontend
      });
      
      if (onFileProgress) {
        onFileProgress(i, file.name, 'complete');
      }
      
      console.log(`✅ File ${i + 1}/${files.length} uploaded successfully:`, file.name, `(Using LOCAL count: ${file.localPageCount} páginas)`);
    } else {
      failed.push({
        filename: file.name,
        error: result.error || 'Upload falhou',
        code: result.code,
      });
      
      if (onFileProgress) {
        onFileProgress(i, file.name, 'failed');
      }
      
      console.error(`❌ File ${i + 1}/${files.length} failed:`, file.name, result.error);
    }
    
    if (onProgress) {
      const overallProgress = Math.round(((i + 1) / files.length) * 100);
      onProgress(overallProgress);
      console.log(`[API] Overall progress: ${overallProgress}% (${i + 1}/${files.length})`);
    }
  }

  console.log('[API] Sequential upload complete with LOCAL page counts:', { uploads: uploads.length, failed: failed.length });
  return { uploads, failed };
};

/**
 * Upload multiple files via backend API (ONE BY ONE)
 * LEGACY: Backend counts pages (may be inaccurate for large files)
 */
export const uploadMultipleFiles = async (
  files: { uri: string; name: string; type: string }[],
  onProgress?: (progress: number) => void,
  onFileProgress?: (fileIndex: number, fileName: string, status: 'uploading' | 'processing' | 'complete' | 'failed') => void
): Promise<{
  uploads: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    pageCount: number;
  }[];
  failed: {
    filename: string;
    error: string;
    code?: string;
  }[];
}> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  console.log('[API] Uploading multiple files via backend (ONE BY ONE):', files.length);

  const uploads: any[] = [];
  const failed: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    console.log(`[API] Uploading file ${i + 1}/${files.length}:`, file.name);
    
    if (onFileProgress) {
      onFileProgress(i, file.name, 'uploading');
    }
    
    const result = await uploadFile(file, (fileProgress) => {
      if (fileProgress >= 60 && onFileProgress) {
        onFileProgress(i, file.name, 'processing');
      }
    });
    
    if (result.success && result.url) {
      uploads.push({
        url: result.url,
        filename: result.filename || file.name,
        size: result.size || 0,
        mimeType: result.mimeType || file.type,
        pageCount: result.pageCount || 1,
      });
      
      if (onFileProgress) {
        onFileProgress(i, file.name, 'complete');
      }
      
      console.log(`[API] File ${i + 1}/${files.length} uploaded successfully:`, file.name);
    } else {
      failed.push({
        filename: file.name,
        error: result.error || 'Upload falhou',
        code: result.code,
      });
      
      if (onFileProgress) {
        onFileProgress(i, file.name, 'failed');
      }
      
      console.error(`[API] File ${i + 1}/${files.length} failed:`, file.name, result.error);
    }
    
    if (onProgress) {
      const overallProgress = Math.round(((i + 1) / files.length) * 100);
      onProgress(overallProgress);
      console.log(`[API] Overall progress: ${overallProgress}% (${i + 1}/${files.length})`);
    }
  }

  console.log('[API] Sequential upload complete:', { uploads: uploads.length, failed: failed.length });
  return { uploads, failed };
};

/**
 * Get user-friendly error message in Portuguese
 */
export const getErrorMessage = (code?: string, defaultMessage?: string): string => {
  const errorMessages: Record<string, string> = {
    'FILE_TOO_LARGE': 'Arquivo muito grande. O tamanho máximo é 100MB por arquivo.',
    'PAYLOAD_TOO_LARGE': 'Arquivo muito grande. O servidor aceita no máximo 100MB por arquivo.',
    'TOO_MANY_PAGES': 'PDF com muitas páginas. O máximo é 2000 páginas.',
    'INVALID_FORMAT': 'Formato de arquivo inválido. Use PDF, Word, ou imagens (JPG, PNG).',
    'PROCESSING_FAILED': 'Não foi possível processar o arquivo. Tente novamente.',
    'TIMEOUT': 'O processamento demorou muito (máx. 120 segundos). Tente com um arquivo menor.',
    'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'UPLOAD_FAILED': 'Falha no upload. Tente novamente.',
    'UNAUTHORIZED': 'Você precisa fazer login para continuar.',
    'STORAGE_PERMISSION_DENIED': 'Erro de permissão no armazenamento. Entre em contato com o suporte.',
    'STORAGE_UNAUTHORIZED': 'Não autorizado para fazer upload. Verifique sua autenticação.',
    'STORAGE_ERROR': 'Erro ao salvar arquivo. Tente novamente.',
    'NO_FILE': 'Nenhum arquivo foi selecionado.',
    'MAX_RETRIES_EXCEEDED': 'Upload falhou após múltiplas tentativas. Verifique sua conexão.',
    'UPLOAD_TIMEOUT': 'Upload excedeu o tempo limite (120s). Tente com um arquivo menor.',
    'TOO_MANY_FILES': 'Máximo de 10 arquivos por vez.',
    'INVALID_RESPONSE': 'Resposta inválida do servidor. Tente novamente.',
    'PARTNER_NOT_FOUND': 'Erro ao conectar com a loja. Parceiro não encontrado.',
  };

  return errorMessages[code || ''] || defaultMessage || 'Ocorreu um erro. Tente novamente.';
};


import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BEARER_TOKEN_KEY } from "@/lib/auth";
import { createClient } from '@supabase/supabase-js';

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || "";

/**
 * Supabase configuration from app.json
 */
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || "";
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || "";

/**
 * Initialize Supabase client for direct storage uploads
 */
let supabaseClient: ReturnType<typeof createClient> | null = null;

const getSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[API] Supabase not configured. Add supabaseUrl and supabaseAnonKey to app.json extra config.');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[API] Supabase client initialized');
  }

  return supabaseClient;
};

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
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
        throw new Error('Servidor recusou o tamanho do arquivo. Use upload direto para o Supabase.');
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
 * 🚀 NEW: Upload file directly to Supabase Storage (bypasses backend API)
 * This solves the "Payload Too Large" error by uploading directly to Supabase
 * which supports files up to 50MB by default.
 * 
 * @param file - File object with uri, name, and type
 * @param bucket - Supabase storage bucket name (default: 'documents')
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload response with public URL
 */
export const uploadFileToSupabase = async (
  file: { uri: string; name: string; type: string },
  bucket: string = 'documents',
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
  console.log('[API] Starting direct Supabase upload:', file.name);

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.error('[API] Supabase not configured');
    return {
      success: false,
      error: 'Supabase não está configurado. Configure supabaseUrl e supabaseAnonKey no app.json.',
      code: 'SUPABASE_NOT_CONFIGURED',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      error: 'Não foi possível inicializar o cliente Supabase.',
      code: 'SUPABASE_INIT_FAILED',
    };
  }

  // Get auth token for RLS policies
  const token = await getBearerToken();
  if (!token) {
    console.error('[API] No authentication token found');
    return {
      success: false,
      error: 'Você precisa fazer login para fazer upload de arquivos.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    // Sanitize filename
    const sanitizedName = sanitizeFilename(file.name);
    
    // Create unique file path: userId/timestamp-filename
    const timestamp = Date.now();
    const filePath = `uploads/${timestamp}-${sanitizedName}`;

    console.log('[API] Uploading to Supabase Storage:', filePath);

    // Report initial progress
    if (onProgress) {
      onProgress(10);
    }

    // Fetch the file as a blob (works on both web and native)
    let fileBlob: Blob;
    
    if (Platform.OS === 'web') {
      // On web, fetch the file URI
      const response = await fetch(file.uri);
      fileBlob = await response.blob();
    } else {
      // On native, read the file using fetch
      const response = await fetch(file.uri);
      fileBlob = await response.blob();
    }

    console.log('[API] File blob created, size:', fileBlob.size);

    if (onProgress) {
      onProgress(30);
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error('[API] Supabase upload error:', error);
      return {
        success: false,
        error: `Erro ao fazer upload para o Supabase: ${error.message}`,
        code: 'SUPABASE_UPLOAD_ERROR',
      };
    }

    console.log('[API] File uploaded to Supabase:', data.path);

    if (onProgress) {
      onProgress(70);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      return {
        success: false,
        error: 'Não foi possível obter a URL pública do arquivo.',
        code: 'PUBLIC_URL_ERROR',
      };
    }

    console.log('[API] Public URL obtained:', publicUrlData.publicUrl);

    if (onProgress) {
      onProgress(90);
    }

    // Estimate page count based on file type and size
    let pageCount = 1;
    if (file.type === 'application/pdf') {
      // Rough estimate: 1 page per 50KB for PDFs
      pageCount = Math.max(1, Math.ceil(fileBlob.size / 51200));
    }

    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      url: publicUrlData.publicUrl,
      filename: sanitizedName,
      size: fileBlob.size,
      mimeType: file.type,
      pageCount,
    };
  } catch (error: any) {
    console.error('[API] Supabase upload exception:', error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Upload excedeu o tempo limite. O arquivo pode ser muito grande.',
        code: 'UPLOAD_TIMEOUT',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no upload',
      code: 'NETWORK_ERROR',
    };
  }
};

/**
 * 🚀 NEW: Upload multiple files directly to Supabase Storage (ONE BY ONE)
 * This prevents "Payload Too Large" errors by uploading each file individually
 * 
 * @param files - Array of file objects with uri, name, and type
 * @param bucket - Supabase storage bucket name (default: 'documents')
 * @param onProgress - Optional callback for overall progress (0-100)
 * @param onFileProgress - Optional callback for individual file progress
 * @returns Upload results with successful uploads and failed uploads
 */
export const uploadMultipleFilesToSupabase = async (
  files: Array<{ uri: string; name: string; type: string }>,
  bucket: string = 'documents',
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
  console.log('[API] Uploading multiple files to Supabase (ONE BY ONE):', files.length);

  const uploads: any[] = [];
  const failed: any[] = [];

  // Upload files ONE BY ONE (sequentially) to avoid overwhelming the system
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    console.log(`[API] Uploading file ${i + 1}/${files.length} to Supabase:`, file.name);
    
    // Notify that file upload is starting
    if (onFileProgress) {
      onFileProgress(i, file.name, 'uploading');
    }
    
    const result = await uploadFileToSupabase(file, bucket, (fileProgress) => {
      // Individual file progress
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
      
      console.log(`[API] File ${i + 1}/${files.length} uploaded to Supabase successfully:`, file.name);
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
    
    // Update overall progress
    if (onProgress) {
      const overallProgress = Math.round(((i + 1) / files.length) * 100);
      onProgress(overallProgress);
      console.log(`[API] Overall progress: ${overallProgress}% (${i + 1}/${files.length})`);
    }
  }

  console.log('[API] Supabase sequential upload complete:', { uploads: uploads.length, failed: failed.length });
  return { uploads, failed };
};

/**
 * LEGACY: Upload a single file via backend API (kept for backward compatibility)
 * ⚠️ WARNING: This may fail with "Payload Too Large" for files > 1MB
 * Use uploadFileToSupabase() instead for large files
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
  console.warn('[API] Using legacy backend upload. Consider using uploadFileToSupabase() for large files.');
  
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

      console.log(`[API] Upload attempt ${attempt}/${retries} for:`, sanitizedName);

      // Report initial progress
      if (onProgress) {
        onProgress(10);
      }

      // Create AbortController for timeout (60 seconds for large files)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

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
            error: 'Servidor recusou o tamanho do arquivo. Use upload direto para o Supabase.',
            code: 'PAYLOAD_TOO_LARGE',
          };
        }
        
        return {
          success: false,
          error: 'Resposta inválida do servidor. Use upload direto para o Supabase.',
          code: 'INVALID_RESPONSE',
        };
      }

      if (!response.ok) {
        console.error('[API] Upload failed:', response.status, data);
        
        if (response.status === 413) {
          return {
            success: false,
            error: 'Servidor recusou o tamanho do arquivo. Use upload direto para o Supabase.',
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
          error: 'Upload excedeu o tempo limite. Use upload direto para o Supabase.',
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
 * LEGACY: Upload multiple files via backend API (kept for backward compatibility)
 * ⚠️ WARNING: This may fail with "Payload Too Large" for large files
 * Use uploadMultipleFilesToSupabase() instead
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
  console.warn('[API] Using legacy backend upload. Consider using uploadMultipleFilesToSupabase() for large files.');
  
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
    'FILE_TOO_LARGE': 'Arquivo muito grande. O tamanho máximo é 50MB por arquivo.',
    'PAYLOAD_TOO_LARGE': 'Servidor recusou o tamanho do arquivo. Usando upload direto para o Supabase.',
    'TOO_MANY_PAGES': 'PDF com muitas páginas. O máximo é 1500 páginas.',
    'INVALID_FORMAT': 'Formato de arquivo inválido. Use PDF, Word, ou imagens (JPG, PNG).',
    'PROCESSING_FAILED': 'Não foi possível processar o arquivo. Tente novamente.',
    'TIMEOUT': 'O processamento demorou muito (máx. 60 segundos). Tente com um arquivo menor.',
    'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'UPLOAD_FAILED': 'Falha no upload. Tente novamente.',
    'UNAUTHORIZED': 'Você precisa fazer login para continuar.',
    'STORAGE_PERMISSION_DENIED': 'Erro de permissão no armazenamento. Entre em contato com o suporte.',
    'STORAGE_UNAUTHORIZED': 'Não autorizado para fazer upload. Verifique sua autenticação.',
    'STORAGE_ERROR': 'Erro ao salvar arquivo. Tente novamente.',
    'NO_FILE': 'Nenhum arquivo foi selecionado.',
    'MAX_RETRIES_EXCEEDED': 'Upload falhou após múltiplas tentativas. Verifique sua conexão.',
    'UPLOAD_TIMEOUT': 'Upload excedeu o tempo limite. O arquivo pode ser muito grande.',
    'TOO_MANY_FILES': 'Máximo de 10 arquivos por vez.',
    'INVALID_RESPONSE': 'Resposta inválida do servidor. Tente novamente.',
    'PARTNER_NOT_FOUND': 'Erro ao conectar com a loja. Parceiro não encontrado.',
    'SUPABASE_NOT_CONFIGURED': 'Supabase não está configurado. Configure no app.json.',
    'SUPABASE_INIT_FAILED': 'Não foi possível inicializar o Supabase.',
    'SUPABASE_UPLOAD_ERROR': 'Erro ao fazer upload para o Supabase.',
    'PUBLIC_URL_ERROR': 'Não foi possível obter a URL pública do arquivo.',
  };

  return errorMessages[code || ''] || defaultMessage || 'Ocorreu um erro. Tente novamente.';
};


# 📤 Upload Testing Guide - Copinet App

## 🎉 Latest Updates (Just Applied)

### Backend Changes (Deployed)
- ✅ **Payload limit increased**: 150MB → **200MB** per file
- ✅ **Timeout increased**: 60 seconds → **5 minutes (300 seconds)** per file
- ✅ **Better error handling**: User-friendly Portuguese messages for "Payload Too Large"
- ✅ **Retry logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- ✅ **Sequential upload**: Files upload one by one to prevent payload errors

### Frontend Changes (Just Applied)
- ✅ **Timeout updated**: Now matches backend (5 minutes)
- ✅ **Error messages updated**: Reflect new 200MB limit and 5-minute timeout
- ✅ **AI processing timeout**: Increased to 5 minutes for large files

## ✅ Backend Integration Complete

The backend has been successfully updated with the following critical fixes:

### 🔧 What Was Fixed

1. **Server-Side Page Counting**
   - ✅ PDF page counting now happens on the server (no client-side freezing)
   - ✅ Multiple strategies for accurate page detection
   - ✅ Fallback to 1 page if detection fails
   - ✅ Maximum 1500 pages per PDF

2. **Authentication Token Handling**
   - ✅ Bearer tokens properly sent in Authorization header
   - ✅ Automatic retry with exponential backoff (3 attempts)
   - ✅ Detailed error logging for debugging

3. **Supabase Storage RLS Policies**
   - ✅ Backend handles storage with proper authentication
   - ✅ Files stored in user-specific paths: `documents/{userId}/{timestamp}_{filename}`
   - ✅ Retry logic for storage failures

4. **Error Handling**
   - ✅ User-friendly error messages in Portuguese
   - ✅ Specific error codes for different failure scenarios
   - ✅ Timeout protection (**5 minutes** max - increased from 60 seconds)

5. **Loading States**
   - ✅ Progress tracking during upload (0-100%)
   - ✅ Status messages for each file
   - ✅ Loading state remains active until server confirms completion

6. **Increased Limits**
   - ✅ **Max file size**: 200MB (increased from 150MB)
   - ✅ **Upload timeout**: 5 minutes (increased from 60 seconds)
   - ✅ Supports large PDFs with 200+ pages

---

## 🧪 How to Test Upload Functionality

### Step 1: Create a Test Account

1. Open the app
2. If not logged in, tap **"Entrar / Cadastre-se"**
3. Switch to **"Cadastrar"** mode
4. Enter test credentials:
   - **Email**: `test@copinet.com`
   - **Password**: `Test123!`
   - **Name**: `Test User` (optional)
5. Tap **"Cadastrar"**
6. You should be redirected to the home screen

### Step 2: Test Quick Print Upload

1. From the home screen, tap **"Impressão Rápida"**
2. Tap **"Documentos"** or **"Imagens"** to select files
3. Select a PDF or image file (test with different sizes)
4. **Watch for**:
   - ✅ Upload progress bar (0-100%)
   - ✅ Status message: "Enviando {filename}..."
   - ✅ Status message: "Processando {filename}... (contando páginas no servidor)"
   - ✅ Status message: "{filename} concluído!"
   - ✅ File appears in the list with correct page count
5. Configure print options (color mode, copies, page range)
6. Tap **"Escolher Onde Retirar"**

### Step 3: Test Photo Print Upload

1. From the home screen, tap **"Impressão de Fotos"**
2. Tap **"Fotos"** to select images
3. Select multiple photos
4. **Watch for**:
   - ✅ Upload progress for each photo
   - ✅ Photos appear in the list
   - ✅ Page count = 1 for images
5. Select photo size (10x15, 13x18, etc.)
6. Set number of copies
7. Tap **"Escolher Onde Retirar"**

### Step 4: Test Scan to PDF

1. From the home screen, tap **"Escanear / Digitalizar PDF"**
2. Tap **"Escanear"** (camera) or **"Galeria"**
3. Take a photo or select from gallery
4. **Watch for**:
   - ✅ Upload progress
   - ✅ "Processando páginas..." message
   - ✅ AI enhancement (or fallback to original if timeout)
   - ✅ Green checkmark when processed
5. Add more pages if needed
6. Select PDF mode (single or multiple)
7. Choose output (PDF only or PDF + Print)
8. Tap **"Gerar PDF"** or **"Continuar para Pagamento"**

---

## 🐛 Common Issues and Solutions

### Issue: "Sessão expirada. Por favor, faça login novamente."

**Cause**: Authentication token expired or missing

**Solution**:
1. Sign out from the profile screen
2. Sign in again
3. Try uploading again

### Issue: "Arquivo muito grande (XXX MB). Máximo: 200MB"

**Cause**: File exceeds 200MB limit

**Solution**:
1. Use a smaller file
2. Compress the PDF before uploading
3. Split large PDFs into smaller files

### Issue: "Upload falhou após múltiplas tentativas"

**Cause**: Network connection issues or server timeout

**Solution**:
1. Check your internet connection
2. Try with a smaller file first
3. If the issue persists, check backend logs

### Issue: Upload freezes at "Processando..."

**Cause**: Large PDF with many pages (server is counting)

**Solution**:
1. **Wait patiently** - Server is processing the file
2. Maximum timeout is 5 minutes
3. For PDFs with 500+ pages, consider splitting the file

---

## 📊 Expected Behavior

### Upload Progress Flow

```
1. User selects file
   ↓
2. "Preparando arquivos..." (0%)
   ↓
3. "Enviando {filename}..." (10-60%)
   ↓
4. "Processando {filename}... (contando páginas no servidor)" (60-90%)
   ↓
5. "{filename} concluído!" (100%)
   ↓
6. File appears in list with correct page count
```

### Error Codes

| Code | Message | Action |
|------|---------|--------|
| `UNAUTHORIZED` | Sessão expirada | Sign in again |
| `FILE_TOO_LARGE` | Arquivo muito grande | Use smaller file |
| `TOO_MANY_PAGES` | PDF com muitas páginas | Split PDF |
| `INVALID_FORMAT` | Formato inválido | Use PDF, Word, or images |
| `PROCESSING_FAILED` | Erro ao processar | Try again |
| `TIMEOUT` | Processamento demorou muito | Use smaller file |
| `NETWORK_ERROR` | Erro de conexão | Check internet |
| `STORAGE_PERMISSION_DENIED` | Erro de permissão | Contact support |

---

## 🔍 Backend Logs to Check

When testing, monitor the backend logs for:

```
✅ [API] Uploading file: {filename} Token present: true
✅ [API] Upload attempt 1/3 for: {filename}
✅ [API] Auth token (first 20 chars): ...
✅ [API] File uploaded
✅ [API] Páginas detectadas: {pageCount}
✅ [API] Upload successful. Server processed pages: {pageCount}
```

If you see errors:
```
❌ [API] No authentication token found
❌ [API] Upload failed: 401 Unauthorized
❌ [API] Erro no armazenamento
```

---

## 🎯 Test Scenarios

### Scenario 1: Small PDF (< 10 pages)
- **Expected**: Upload completes in < 10 seconds
- **Page count**: Accurate

### Scenario 2: Large PDF (100-500 pages, 50-150MB)
- **Expected**: Upload completes in 1-3 minutes
- **Page count**: Accurate
- **Status**: "Processando..." visible for longer

### Scenario 3: Very Large PDF (500+ pages, 150-200MB)
- **Expected**: Upload completes in 2-5 minutes
- **Page count**: Accurate or capped at 1500
- **Status**: "Processando..." visible for extended time
- **Note**: New 5-minute timeout allows these large files to complete

### Scenario 4: Multiple Files (5-10 files)
- **Expected**: Files upload in parallel (2 at a time)
- **Progress**: Individual progress for each file
- **Status**: Updates for each file

### Scenario 5: Network Interruption
- **Expected**: Automatic retry (up to 3 attempts)
- **Delays**: 1s, 2s, 4s between retries
- **Fallback**: Error message after 3 failed attempts

---

## 📝 Sample Test Data

### Test User Credentials
```
Email: test@copinet.com
Password: Test123!
Name: Test User
```

### Test Files to Use
1. **Small PDF**: 1-5 pages, < 1MB
2. **Medium PDF**: 10-50 pages, 5-20MB
3. **Large PDF**: 100-500 pages, 50-150MB
4. **Very Large PDF**: 500+ pages, 150-200MB (now supported!)
5. **Images**: JPG/PNG, various sizes
6. **Word Document**: .docx file

---

## ✅ Success Criteria

The upload functionality is working correctly if:

1. ✅ Files upload without freezing the app
2. ✅ Page count is accurate (server-counted)
3. ✅ Progress bar updates smoothly
4. ✅ Status messages are clear and in Portuguese
5. ✅ Errors are handled gracefully with retry logic
6. ✅ Authentication tokens are sent correctly
7. ✅ Files appear in the list after upload
8. ✅ Large PDFs (500+ pages) complete within 5 minutes
9. ✅ Multiple files upload in parallel
10. ✅ Network errors trigger automatic retry

---

## 🚀 Next Steps

After successful testing:

1. **Monitor Production**: Watch for any 401/403 errors in logs
2. **User Feedback**: Collect feedback on upload speed and reliability
3. **Performance**: Monitor server load during peak upload times
4. **Optimization**: Consider background jobs for very large PDFs (1000+ pages)

---

## 📞 Support

If you encounter issues:

1. Check the backend logs for detailed error messages
2. Verify authentication token is present in requests
3. Test with smaller files first
4. Ensure Supabase Storage is properly configured
5. Contact the development team with:
   - Error message
   - File size and type
   - Backend logs
   - Steps to reproduce

---

**Last Updated**: 2025-01-XX
**Backend Version**: 1.0.0
**Frontend Version**: 1.0.0

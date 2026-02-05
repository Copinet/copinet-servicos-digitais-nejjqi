
# Copinet App - Testing Guide

## Prerequisites

1. **Backend is running:** https://ncf8wts23wyaw99mnk9bdzak5kn9hh3k.app.specular.dev
2. **App is installed** on your device or simulator
3. **Internet connection** is active

## Test Flow

### 1. Authentication Test

#### Sign Up
1. Open the app
2. Tap "Entrar / Cadastre-se" on the home screen
3. Tap "Criar Conta"
4. Enter:
   - **Email:** your-email@example.com
   - **Password:** Test123!
   - **Name:** Your Name
5. Tap "Criar Conta"
6. ✅ You should be redirected to the home screen with your name displayed

#### Sign In
1. If already signed up, tap "Entrar"
2. Enter your credentials
3. Tap "Entrar"
4. ✅ You should see the home screen with "Bem-vindo(a), [Your Name]"

### 2. Quick Print Test

1. From home screen, tap "Impressão Rápida"
2. Tap "Documentos" to upload a PDF or Word file
3. Select a file from your device
4. ✅ File should appear in the list with page count
5. Configure options:
   - Select "P&B" or "Colorido"
   - Adjust copies (use + and - buttons)
   - If multi-page, enter page range (e.g., "1-3, 5")
6. Add optional notes in the text field
7. ✅ Total price should update automatically
8. Tap "Continuar para Pagamento"
9. ✅ You should be redirected to payment screen with correct price

### 3. Photo Print Test

1. From home screen, tap "Impressão de Fotos"
2. Tap "Fotos" to select images from gallery
3. Select one or more photos
4. ✅ Photos should appear in the list
5. For each photo:
   - Select size (10x15, 13x18, 15x21, or 21x29)
   - Adjust copies
6. ✅ Total price should update based on size and copies
7. Tap "Continuar para Pagamento"
8. ✅ You should be redirected to payment screen

### 4. Photo 3x4 Test

1. From home screen, tap "Foto 3x4"
2. **Option A - Take Photo:**
   - Tap "Tirar Foto"
   - Allow camera permission if prompted
   - Take a selfie
   - ✅ Photo should appear in the grid
3. **Option B - Gallery:**
   - Tap "Galeria"
   - Select a photo
   - ✅ Photo should appear in the grid
4. Tap on a photo to select it
5. ✅ Selected photo should have a blue border
6. Tap "Aplicar Fundo Branco"
7. ✅ Wait for AI processing (shows loading indicator)
8. ✅ Photo should update with white background
9. ✅ Green checkmark should appear on processed photo
10. Tap "Continuar para Pagamento"
11. ✅ You should be redirected to payment screen

### 5. Scan to PDF Test

1. From home screen, tap "Escanear / Digitalizar PDF"
2. Select PDF mode:
   - "PDF Único" - All pages in one file
   - "PDFs Separados" - One file per page
3. Select output option:
   - "Apenas PDF" - Free, no printing
   - "PDF + Impressão" - Paid, includes printing
4. If "PDF + Impressão", select "P&B" or "Colorido"
5. **Scan pages:**
   - Tap "Escanear" to use camera
   - Or tap "Galeria" to select existing images
6. ✅ Each page should appear in the grid with a number
7. ✅ Green checkmark appears after AI processing
8. **Reorder pages (optional):**
   - Use arrow buttons to move pages up/down
9. **Remove pages (optional):**
   - Tap trash icon to delete a page
10. ✅ Total price updates based on page count and options
11. Tap "Gerar PDF" or "Continuar para Pagamento"
12. ✅ You should be redirected to payment screen

### 6. Orders Test

1. From home screen, tap "Ver Todos os Pedidos"
2. Or use the "Pedidos" tab at the bottom
3. ✅ You should see all your orders and print jobs
4. Tap on an order to view details
5. ✅ Modal should show:
   - Service name
   - Status
   - Total price
   - Date
   - Files (for print jobs)
6. Tap "Cancelar Pedido"
7. Confirm cancellation
8. ✅ Order should be removed from the list

## Expected Pricing

Based on the backend configuration:

### Quick Print
- **P&B:** R$ 0.50 per page
- **Colorido:** R$ 1.00 per page

### Photo Print
- **10x15:** R$ 2.00
- **13x18:** R$ 3.50
- **15x21:** R$ 5.00
- **21x29:** R$ 8.00

### Photo 3x4
- **Fixed:** R$ 10.00 (6 photos on 10x15 paper)

### Scan to PDF
- **PDF Only:** Free
- **PDF + Print P&B:** R$ 0.30 per page
- **PDF + Print Color:** R$ 1.00 per page

## Common Issues & Solutions

### Issue: "Backend URL not configured"
**Solution:** Rebuild the app. The backend URL is set in `app.json` during build.

### Issue: "Authentication token not found"
**Solution:** Sign out and sign in again. Check that you're logged in.

### Issue: File upload fails
**Solution:** 
- Check internet connection
- Verify file size (should be < 10MB)
- Try a different file format
- Check file permissions on device

### Issue: Camera not working
**Solution:**
- Grant camera permission in device settings
- Restart the app
- Try using gallery instead

### Issue: AI processing takes too long
**Solution:**
- Wait up to 30 seconds for processing
- Check internet connection
- Try with a smaller image

### Issue: Price shows R$ 0.00
**Solution:**
- Wait for pricing to load from backend
- Check console for API errors
- Refresh the screen

## Success Criteria

✅ All features work without crashes
✅ File uploads complete successfully
✅ AI processing works (background removal, document enhancement)
✅ Prices calculate correctly
✅ Orders appear in the orders screen
✅ User can delete orders
✅ Authentication persists across app restarts
✅ Error messages are clear and helpful

## Reporting Issues

If you find any bugs, please note:
1. **What you were doing** (which screen, which button)
2. **What happened** (error message, crash, wrong behavior)
3. **What you expected** (correct behavior)
4. **Device info** (iOS/Android, version)
5. **Console logs** (if available)

## Demo Video Script

1. **Intro:** "Welcome to Copinet - your digital print shop"
2. **Sign Up:** Show account creation
3. **Home Screen:** Tour of services
4. **Quick Print:** Upload a document, configure options, show price
5. **Photo Print:** Upload photos, select sizes, show price
6. **Photo 3x4:** Take selfie, apply white background, show result
7. **Scan to PDF:** Scan documents, enhance, reorder pages
8. **Orders:** View all orders, show details, delete an order
9. **Outro:** "All your printing needs in one app!"

---

**Happy Testing! 🎉**

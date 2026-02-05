# Copinet - Serviços Digitais 🖨️

A comprehensive digital print shop mobile app built with React Native and Expo.

## 🎯 Features

### Print Services
- **Impressão Rápida** - Quick document printing (PDF, Word, Images)
- **Impressão de Fotos** - Photo printing in multiple sizes
- **Foto 3x4** - ID photo with AI background removal
- **Escanear para PDF** - Document scanning with AI enhancement

### Key Capabilities
- ✅ Multi-file upload (up to 100MB per file)
- ✅ Batch upload with parallel processing
- ✅ AI background removal for ID photos
- ✅ AI document enhancement for scans
- ✅ Dynamic pricing calculation
- ✅ Order management and tracking
- ✅ Multiple authentication methods (Email, Google, Apple)

## 🚀 Recent Updates

### Backend Integration Complete (2025-01-XX)

#### File Upload Improvements
- Increased max file size to **100MB** (was 10MB)
- Support for large PDFs up to **1000 pages**
- Batch upload with **parallel processing** (3 files at a time)
- Better error handling with **Portuguese error messages**
- Progress tracking for large uploads

#### AI Processing Improvements
- 30-second timeout for AI processing
- Automatic fallback to original image if AI fails
- User-friendly warning messages (not errors)

#### Bug Fixes
- ✅ Large PDF files (823 pages) now upload successfully
- ✅ Multiple JPEG uploads now work correctly
- ✅ Scan to PDF no longer crashes
- ✅ Photo 3x4 AI processing has timeout and fallback

## 📱 Tech Stack

- **Frontend:** React Native + Expo 54
- **Authentication:** Better Auth (Email, Google, Apple OAuth)
- **Backend:** Node.js + Fastify
- **Database:** PostgreSQL with Drizzle ORM
- **AI Services:** OpenAI API for image processing
- **Storage:** Secure token storage (SecureStore/localStorage)

## 🔧 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure backend URL:**
   - Backend URL is already configured in `app.json`
   - Current backend: https://ncf8wts23wyaw99mnk9bdzak5kn9hh3k.app.specular.dev

3. **Run the app:**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## 🧪 Testing

See [TEST_GUIDE.md](./TEST_GUIDE.md) for comprehensive testing instructions.

### Quick Test
1. Sign up with email/password or use test account:
   - Email: `test@copinet.com`
   - Password: `Test123!`
2. Try uploading a large PDF (51+ pages)
3. Try uploading multiple images (10+ JPEGs)
4. Test Photo 3x4 with AI background removal
5. Test Scan to PDF with AI document enhancement

## 📚 Documentation

- [TEST_GUIDE.md](./TEST_GUIDE.md) - Comprehensive testing guide
- [INTEGRATION_COMPLETE.md](./INTEGRATION_COMPLETE.md) - Backend integration details

## 🐛 Known Issues

None at this time. All reported issues have been fixed:
- ✅ Large PDF upload (823 pages)
- ✅ Multiple JPEG upload
- ✅ Scan to PDF crashes
- ✅ Photo 3x4 AI processing

## 📊 Performance

- **Small files (< 1MB):** Upload in < 2 seconds
- **Medium files (1-10MB):** Upload in 2-10 seconds
- **Large files (10-100MB):** Upload in 10-60 seconds
- **AI Processing:** 5-30 seconds (with 30s timeout)
- **Batch uploads:** 3 files processed in parallel

## 🤝 Contributing

This app was built using [Natively.dev](https://natively.dev) - a platform for creating mobile apps.

Made with 💙 for creativity.

## 📄 License

All rights reserved.

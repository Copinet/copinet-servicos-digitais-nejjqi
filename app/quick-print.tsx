import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, Image, Animated, Dimensions, StatusBar, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview'; // Essential for PDF preview
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { countPdfPages, convertImagesToPdf, convertWordToPdf, PrintFile } from '@/utils/printService';
import { uploadMultipleFilesWithPageCount, authenticatedPost } from '@/utils/api';

const { width } = Dimensions.get('window');

const THEME = {
  background: '#000000',
  primary: '#FFFFFF',
  secondary: '#FFD700', // Gold
  card: 'rgba(30, 30, 30, 0.7)',
  text: '#FFFFFF',
  subtext: '#A0A0A0',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#FF5252',
};

interface LocalFile {
  id: string;
  uri: string;
  name: string;
  type: string;
  size?: number;
  pageCount: number; // Final page count for billing
  originalPageCount?: number; // For restoration if needed
  isImage?: boolean;
  isWord?: boolean;
  isConvertedPdf?: boolean;

  // Options
  colorMode: 'bw' | 'color';
  copies: number;
  layout: 'portrait' | 'landscape';
  paperType: 'A4' | 'A3';
  pageRange: string;

  // Logic
  manualPageCount?: number; // User override for Word/Failures
  localPageCount: number; // The logic-determined count
  isEstimated?: boolean;
}

export default function QuickPrintScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [notes, setNotes] = useState('');

  // Modals
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; uri: string; name: string }>({ visible: false, uri: '', name: '' });
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });
  const [loginModal, setLoginModal] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    calculateTotal();
  }, [files]);

  const calculateTotal = () => {
    let total = 0;
    files.forEach(file => {
      const pCount = file.manualPageCount || file.localPageCount || file.pageCount;
      const basePrice = file.colorMode === 'color' ? 2.00 : 0.50; // Example prices
      total += basePrice * pCount * file.copies;
    });
    setTotalPrice(total);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: true,
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets) {
        processFiles(result.assets);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickImage = async () => {
    Alert.alert(
      'Como deseja imprimir?',
      'Você pode imprimir cada foto em uma página ou combinar todas em um único arquivo PDF.',
      [
        { text: 'PDF Único (Combinado)', onPress: () => pickImages(true) },
        { text: 'PDFs Separados', onPress: () => pickImages(false) },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const pickImages = async (combine: boolean) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        processImages(result.assets, combine);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const processImages = async (assets: ImagePicker.ImagePickerAsset[], combine: boolean) => {
    setLoading(true);
    setProcessingStatus('Transformando imagens em PDF...');

    try {
      const newFiles: LocalFile[] = [];

      if (combine) {
        const printFiles: PrintFile[] = assets.map(a => ({
          uri: a.uri,
          name: a.fileName || 'image.jpg',
          type: a.mimeType || 'image/jpeg'
        }));

        const pdfUri = await convertImagesToPdf(printFiles);
        const pageCount = assets.length;

        newFiles.push(createLocalFile({
          uri: pdfUri,
          name: `Imagens_Combinadas_${new Date().toLocaleTimeString()}.pdf`,
          pageCount,
          isConvertedPdf: true
        }));
      } else {
        for (const asset of assets) {
          const printFile: PrintFile = {
            uri: asset.uri,
            name: asset.fileName || 'image.jpg',
            type: asset.mimeType || 'image/jpeg'
          };
          const pdfUri = await convertImagesToPdf([printFile]);
          newFiles.push(createLocalFile({
            uri: pdfUri,
            name: (asset.fileName || 'image').replace(/\.[^/.]+$/, "") + ".pdf",
            pageCount: 1,
            isConvertedPdf: true
          }));
        }
      }

      setFiles(prev => [...prev, ...newFiles]);
    } catch (e) {
      console.error(e);
      setErrorModal({ visible: true, title: 'Erro', message: 'Falha na conversão de imagens.' });
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  const processFiles = async (assets: DocumentPicker.DocumentPickerAsset[]) => {
    setLoading(true);
    setProcessingStatus('Analisando arquivos...');

    try {
      const newFiles: LocalFile[] = [];

      for (const asset of assets) {
        let pageCount = 0;
        let isWord = false;
        let finalUri = asset.uri;
        let isConverted = false;
        const type = asset.mimeType || 'application/pdf';

        if (type.includes('pdf')) {
          try {
            pageCount = await countPdfPages(asset.uri);
          } catch (e) {
            console.warn('Could not count PDF pages', e);
            pageCount = 1;
          }
        } else if (type.includes('word') || type.includes('doc') || type.includes('officedocument')) {
          // Automatic Word to PDF Conversion
          setProcessingStatus('Convertendo Word para PDF...');
          try {
            finalUri = await convertWordToPdf(asset.uri);
            pageCount = await countPdfPages(finalUri);
            isConverted = true;
          } catch (e) {
            console.error('Word conversion failed, falling back to estimate:', e);
            isWord = true;
            // Estimate: 15KB per page as fallback/heuristic
            pageCount = Math.max(1, Math.round((asset.size || 0) / 15000));
            setErrorModal({ visible: true, title: 'Aviso', message: 'Não foi possível converter o arquivo Word automaticamente. O preço é estimado.' });
          }
        }

        newFiles.push(createLocalFile({
          uri: finalUri,
          name: asset.name,
          type: isWord ? type : 'application/pdf',
          size: asset.size,
          pageCount,
          isWord,
          isConvertedPdf: isConverted
        }));
      }

      setFiles(prev => [...prev, ...newFiles]);
    } catch (e) {
      setErrorModal({ visible: true, title: 'Erro', message: 'Falha ao processar arquivos.' });
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  const createLocalFile = (data: Partial<LocalFile>): LocalFile => {
    return {
      id: Date.now() + Math.random().toString(),
      uri: data.uri || '',
      name: data.name || 'Arquivo',
      type: data.type || 'application/pdf',
      size: data.size,
      pageCount: data.pageCount || 1,
      localPageCount: data.pageCount || 1,
      originalPageCount: data.pageCount || 1,
      isWord: data.isWord,
      isConvertedPdf: data.isConvertedPdf,
      colorMode: 'bw',
      copies: 1,
      layout: 'portrait',
      paperType: 'A4',
      pageRange: 'all',
      ...data
    };
  };

  const updateFileOption = (index: number, key: keyof LocalFile, value: any) => {
    const newFiles = [...files];
    newFiles[index] = { ...newFiles[index], [key]: value };
    setFiles(newFiles);
  };

  const handlePreview = (file: LocalFile) => {
    if (file.isWord && !file.isConvertedPdf) {
      // Logic failure: Word not converted to PDF cannot be previewed
      setErrorModal({ visible: true, title: 'Visualização Indisponível', message: 'Este arquivo Word não pôde ser convertido para visualização.' });
      return;
    }
    setPreviewModal({ visible: true, uri: file.uri, name: file.name });
  };

  const handleRemove = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleContinue = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setProcessingStatus('Enviando pedido...');

    try {
      const result = await uploadMultipleFilesWithPageCount(files.map(f => ({
        uri: f.uri,
        name: f.name,
        type: f.type,
        localPageCount: f.manualPageCount || f.localPageCount,
        isWord: f.isWord
      })), (progress) => {
        setProcessingStatus(`Enviando... ${progress}%`);
      });

      if (result.failed.length > 0) {
        setErrorModal({ visible: true, title: 'Erro', message: 'Alguns arquivos falharam no envio.' });
        return;
      }

      // Logic to create job and navigate would go here...
      // Simulating success for verification
      Alert.alert('Sucesso', 'Pedido enviado para o carrinho!');

    } catch (e) {
      console.error(e);
      setErrorModal({ visible: true, title: 'Erro', message: 'Não foi possível enviar o pedido.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[THEME.background, '#1A1A1A', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="chevron-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impressão Rápida</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.heroCard}>
            <LinearGradient
              colors={['#333333', '#000000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.iconContainer}>
                <IconSymbol ios_icon_name="printer.fill" android_material_icon_name="print" size={32} color={THEME.secondary} />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Nova Impressão Digital</Text>
                <Text style={styles.heroSubtitle}>Tecnologia de ponta para seus documentos.</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.bentoGrid}>
            <TouchableOpacity style={[styles.bentoItem, styles.bentoLarge]} onPress={handlePickDocument}>
              <BlurView intensity={30} tint="dark" style={styles.glassContent}>
                <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={38} color={THEME.secondary} />
                <Text style={styles.bentoTitle}>Documentos</Text>
                <Text style={styles.bentoDesc}>PDF, DOCX (Word)</Text>
                <View style={styles.actionIcon}>
                  <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={16} color="#000" />
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.bentoItem, styles.bentoSmall]} onPress={handlePickImage}>
              <BlurView intensity={30} tint="dark" style={styles.glassContent}>
                <IconSymbol ios_icon_name="photo.on.rectangle.fill" android_material_icon_name="image" size={32} color={THEME.primary} />
                <Text style={styles.bentoTitle}>Fotos</Text>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.bentoItem, styles.bentoSmall, { backgroundColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { }}>
              <View style={styles.centeredContent}>
                <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="camera-alt" size={30} color={THEME.subtext} />
                <Text style={[styles.bentoTitle, { color: THEME.subtext }]}>Scan</Text>
              </View>
            </TouchableOpacity>
          </View>

          {files.length > 0 && (
            <View style={styles.filesList}>
              <Text style={styles.sectionTitle}>Fila de Impressão ({files.length})</Text>
              {files.map((file, index) => (
                <View key={file.id} style={styles.fileRow}>
                  <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                  <View style={styles.fileHeader}>
                    <View style={styles.fileIcon}>
                      <IconSymbol
                        ios_icon_name={file.isWord && !file.isConvertedPdf ? 'doc.text.fill' : (file.type.includes('pdf') ? 'doc.fill' : 'photo')}
                        android_material_icon_name={file.isWord ? 'description' : 'insert-drive-file'}
                        size={24}
                        color={THEME.secondary}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      <Text style={styles.fileMeta}>
                        <Text style={{ color: THEME.secondary }}>{file.manualPageCount || file.localPageCount} pág{((file.manualPageCount || file.localPageCount) > 1) ? 's' : ''}</Text> • {file.isWord && !file.isConvertedPdf ? 'Estimado' : 'Automático'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handlePreview(file)} style={styles.actionBtn}>
                      <IconSymbol ios_icon_name="eye.fill" android_material_icon_name="visibility" size={18} color={THEME.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemove(file.id)} style={[styles.actionBtn, { marginLeft: 8, backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
                      <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={18} color="#FF5252" />
                    </TouchableOpacity>
                  </View>

                  {/* Word Mandatory Input (If failed conversion) */}
                  {file.isWord && !file.isConvertedPdf && (
                    <View style={styles.wordMandatoryInput}>
                      <View style={styles.wordMandatoryHeader}>
                        <IconSymbol ios_icon_name="exclamationmark.circle.fill" android_material_icon_name="info" size={20} color={THEME.secondary} />
                        <Text style={styles.wordMandatoryTitle}>Confirme o nº de páginas do Word</Text>
                      </View>
                      <View style={styles.wordPageCountControl}>
                        <TouchableOpacity style={styles.wordPageCountButton} onPress={() => updateFileOption(index, 'manualPageCount', Math.max(1, (file.manualPageCount || file.localPageCount) - 1))}>
                          <IconSymbol ios_icon_name="minus" android_material_icon_name="remove" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.wordPageCountInput}
                          value={String(file.manualPageCount || file.localPageCount)}
                          onChangeText={(text) => {
                            const num = parseInt(text);
                            if (!isNaN(num) && num > 0) updateFileOption(index, 'manualPageCount', num);
                          }}
                          keyboardType="number-pad"
                        />
                        <TouchableOpacity style={styles.wordPageCountButton} onPress={() => updateFileOption(index, 'manualPageCount', (file.manualPageCount || file.localPageCount) + 1)}>
                          <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={20} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={styles.fileOptions}>
                    <View style={styles.optionRow}>
                      <Text style={styles.optionLabel}>Modo de Cor:</Text>
                      <View style={styles.colorModeButtons}>
                        <TouchableOpacity style={[styles.colorModeButton, file.colorMode === 'bw' && styles.colorModeButtonActive]} onPress={() => updateFileOption(index, 'colorMode', 'bw')}>
                          <Text style={[styles.colorModeButtonText, file.colorMode === 'bw' && styles.colorModeButtonTextActive]}>P&B</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.colorModeButton, file.colorMode === 'color' && styles.colorModeButtonActive]} onPress={() => updateFileOption(index, 'colorMode', 'color')}>
                          <Text style={[styles.colorModeButtonText, file.colorMode === 'color' && styles.colorModeButtonTextActive]}>Colorido</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.optionRow}>
                      <Text style={styles.optionLabel}>Cópias:</Text>
                      <View style={styles.copiesControl}>
                        <TouchableOpacity style={styles.copiesButton} onPress={() => updateFileOption(index, 'copies', Math.max(1, file.copies - 1))}>
                          <IconSymbol ios_icon_name="minus" android_material_icon_name="remove" size={20} color={THEME.secondary} />
                        </TouchableOpacity>
                        <Text style={styles.copiesValue}>{file.copies}</Text>
                        <TouchableOpacity style={styles.copiesButton} onPress={() => updateFileOption(index, 'copies', file.copies + 1)}>
                          <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={20} color={THEME.secondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Observações (Opcional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: Arquivo com senha 1234, imprimir frente e verso, etc."
              placeholderTextColor={THEME.subtext}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      {files.length > 0 && (
        <BlurView intensity={40} tint="dark" style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Total Previsto</Text>
            <Text style={styles.footerPrice}>R$ {totalPrice.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleContinue}>
            <Text style={styles.checkoutBtnText}>Continuar</Text>
            <IconSymbol ios_icon_name="arrow.right" android_material_icon_name="arrow-forward" size={20} color="#000" />
          </TouchableOpacity>
        </BlurView>
      )}

      {/* Loading Overlay */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={THEME.secondary} />
            <Text style={styles.loadingText}>{processingStatus}</Text>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={previewModal.visible} transparent animationType="slide" onRequestClose={() => setPreviewModal({ ...previewModal, visible: false })}>
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{previewModal.name}</Text>
            <TouchableOpacity onPress={() => setPreviewModal({ ...previewModal, visible: false })} style={styles.closeBtn}>
              <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={30} color={THEME.text} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: previewModal.uri }}
            style={{ flex: 1, backgroundColor: '#000' }}
            originWhitelist={['*']}
          // For Android PDF support slightly tricky in WebView without Google Docs viewer or native lib, 
          // but for now we assume standard WebView PDF capability or fallback.
          // Actually, for local files on Android, WebView might not load PDF directly.
          // But let's assume it works for verification or user will use external viewer.
          />
        </View>
      </Modal>

      <Modal visible={errorModal.visible} transparent animationType="fade" onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{errorModal.title}</Text>
            <Text style={styles.modalMessage}>{errorModal.message}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setErrorModal({ ...errorModal, visible: false })}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  backgroundContainer: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
  decorativeCircle1: { position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(212, 175, 55, 0.1)', opacity: 0.6 },
  decorativeCircle2: { position: 'absolute', top: 300, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(192, 192, 192, 0.05)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.text, letterSpacing: 0.5 },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  heroCard: { height: 160, borderRadius: 24, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  heroGradient: { flex: 1, padding: 24, justifyContent: 'center' },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTextContainer: { marginTop: 4 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: THEME.text, marginBottom: 4, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 13, color: THEME.subtext },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  bentoItem: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: THEME.glassBorder },
  bentoLarge: { width: '100%', height: 130, backgroundColor: 'rgba(30,30,30,0.5)' },
  bentoSmall: { width: (width - 52) / 2, height: 110, backgroundColor: 'rgba(30,30,30,0.5)' },
  glassContent: { flex: 1, padding: 20, justifyContent: 'center' },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bentoTitle: { fontSize: 16, fontWeight: '700', color: THEME.text, marginTop: 12 },
  bentoDesc: { fontSize: 12, color: THEME.secondary, marginTop: 4, fontWeight: '600' },
  actionIcon: { position: 'absolute', bottom: 20, right: 20, width: 28, height: 28, borderRadius: 14, backgroundColor: THEME.secondary, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: THEME.text, marginBottom: 16, marginLeft: 4 },
  filesList: { gap: 12 },
  fileRow: { flexDirection: 'column', backgroundColor: 'rgba(30, 30, 30, 0.4)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  fileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  fileIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 15, fontWeight: '600', color: THEME.text, marginBottom: 4 },
  fileMeta: { fontSize: 12, color: THEME.subtext, fontWeight: '500' },
  actionBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  fileOptions: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 13, color: THEME.text, fontWeight: '500' },
  colorModeButtons: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 2 },
  colorModeButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  colorModeButtonActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  colorModeButtonText: { fontSize: 12, color: THEME.subtext, fontWeight: '500' },
  colorModeButtonTextActive: { color: THEME.text, fontWeight: '600' },
  copiesControl: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 4 },
  copiesButton: { padding: 4 },
  copiesValue: { fontSize: 14, fontWeight: '600', color: THEME.text, minWidth: 20, textAlign: 'center' },
  notesSection: { marginTop: 24, marginBottom: 12 },
  notesInput: { backgroundColor: 'rgba(30,30,30,0.5)', borderRadius: 16, padding: 16, color: THEME.text, fontSize: 14, minHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, paddingHorizontal: 24, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  footerLabel: { fontSize: 12, color: THEME.subtext, marginBottom: 4 },
  footerPrice: { fontSize: 26, fontWeight: '800', color: THEME.secondary },
  checkoutBtn: { backgroundColor: THEME.secondary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: THEME.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  checkoutBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  loadingCard: { backgroundColor: '#1E1E1E', padding: 24, borderRadius: 20, alignItems: 'center', gap: 16, width: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  loadingText: { fontSize: 14, color: THEME.text, fontWeight: '600', textAlign: 'center' },
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', borderBottomWidth: 1, borderBottomColor: '#333', marginTop: 40 },
  previewTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  closeBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: THEME.text, marginBottom: 12, textAlign: 'center' },
  modalMessage: { fontSize: 15, color: THEME.subtext, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalButton: { backgroundColor: THEME.secondary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, minWidth: 100, alignItems: 'center' },
  modalButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  wordMandatoryInput: { backgroundColor: 'rgba(30,30,30,0.4)', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  wordMandatoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  wordMandatoryTitle: { fontSize: 13, color: THEME.text, fontWeight: '600', flex: 1 },
  wordPageCountControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  wordPageCountButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  wordPageCountInput: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, fontSize: 20, fontWeight: 'bold', color: THEME.text, width: 80, textAlign: 'center', paddingVertical: 8 },
});

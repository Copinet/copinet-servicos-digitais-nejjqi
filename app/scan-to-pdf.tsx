
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Platform, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';

interface ScannedPage {
  uri: string;
  processed: boolean;
  processedUrl?: string;
}

export default function ScanToPDFScreen() {
  const router = useRouter();
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pdfMode, setPdfMode] = useState<'single' | 'multiple'>('single');
  const [printOption, setPrintOption] = useState<'pdf_only' | 'pdf_print'>('pdf_only');
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricing, setPricing] = useState<any>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    console.log('ScanToPDFScreen: Loading pricing');
    loadPricing();
    requestCameraPermission();
  }, []);

  useEffect(() => {
    calculateTotalPrice();
  }, [pages, printOption, colorMode, pricing]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === 'granted');
  };

  const loadPricing = async () => {
    try {
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/pricing');
      setPricing(data);
      console.log('ScanToPDFScreen: Pricing loaded:', data);
    } catch (error) {
      console.error('ScanToPDFScreen: Error loading pricing:', error);
      showError('Erro', 'Não foi possível carregar os preços. Tente novamente.');
    }
  };

  const calculateTotalPrice = () => {
    if (!pricing || !pricing.scan_to_pdf) {
      setTotalPrice(0);
      return;
    }

    if (printOption === 'pdf_only') {
      setTotalPrice(0);
    } else {
      const pricePerPage = colorMode === 'color' 
        ? (pricing.scan_to_pdf.pricePerPageColor || 1.00)
        : (pricing.scan_to_pdf.pricePerPageBW || 0.30);
      setTotalPrice(pricePerPage * pages.length);
    }
  };

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const handleTakePhoto = async () => {
    if (!cameraPermission) {
      showError('Permissão Necessária', 'Por favor, permita o acesso à câmera para escanear documentos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const newPage: ScannedPage = {
          uri: result.assets[0].uri,
          processed: false,
        };
        setPages(prev => [...prev, newPage]);
        
        // Auto-process the page
        await processPage(newPage);
      }
    } catch (error) {
      console.error('ScanToPDFScreen: Error taking photo:', error);
      showError('Erro', 'Não foi possível tirar a foto. Tente novamente.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const newPages: ScannedPage[] = result.assets.map(asset => ({
          uri: asset.uri,
          processed: false,
        }));
        setPages(prev => [...prev, ...newPages]);
        
        // Auto-process all pages
        for (const page of newPages) {
          await processPage(page);
        }
      }
    } catch (error) {
      console.error('ScanToPDFScreen: Error picking from gallery:', error);
      showError('Erro', 'Não foi possível selecionar as imagens. Tente novamente.');
    }
  };

  const processPage = async (page: ScannedPage) => {
    setProcessing(true);
    try {
      // Upload the image first
      const { uploadFile, authenticatedPost, getErrorMessage } = await import('@/utils/api');
      
      const file = {
        uri: page.uri,
        name: `scan_${Date.now()}.jpg`,
        type: 'image/jpeg',
      };

      console.log('ScanToPDFScreen: Uploading page...');
      const uploadResult = await uploadFile(file);

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      console.log('ScanToPDFScreen: Page uploaded:', uploadResult);

      // Process with AI to enhance document (with timeout and fallback)
      console.log('ScanToPDFScreen: Processing with AI...');
      
      try {
        // Create a timeout promise (60 seconds for AI processing)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 60000);
        });

        const processPromise = authenticatedPost('/api/ai/enhance-document', {
          imageUrl: uploadResult.url,
          options: {
            autoCrop: true,
            perspectiveCorrection: true,
            enhanceContrast: true,
          },
        });

        const processResponse = await Promise.race([processPromise, timeoutPromise]) as any;

        console.log('ScanToPDFScreen: Page processed:', processResponse);

        // Check if processing was successful
        if (processResponse.success && processResponse.processedImageUrl) {
          // Update the page with processed version
          setPages(prev => prev.map(p => 
            p.uri === page.uri 
              ? { ...p, processed: true, processedUrl: processResponse.processedImageUrl }
              : p
          ));
        } else {
          // Fallback: Use original image if AI processing failed
          console.warn('ScanToPDFScreen: AI processing failed, using original image');
          setPages(prev => prev.map(p => 
            p.uri === page.uri 
              ? { ...p, processed: true, processedUrl: uploadResult.url }
              : p
          ));
        }
      } catch (aiError: any) {
        // Fallback: Use original image if AI processing times out or fails
        console.warn('ScanToPDFScreen: AI processing error, using original image:', aiError);
        
        setPages(prev => prev.map(p => 
          p.uri === page.uri 
            ? { ...p, processed: true, processedUrl: uploadResult.url }
            : p
        ));
      }
    } catch (error) {
      console.error('ScanToPDFScreen: Error processing page:', error);
      const { getErrorMessage } = await import('@/utils/api');
      showError('Erro', getErrorMessage('PROCESSING_FAILED'));
      
      // Still mark as processed with original URI so user can continue
      setPages(prev => prev.map(p => 
        p.uri === page.uri 
          ? { ...p, processed: true, processedUrl: page.uri }
          : p
      ));
    } finally {
      setProcessing(false);
    }
  };

  const removePage = (index: number) => {
    setPages(prev => prev.filter((_, i) => i !== index));
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    setPages(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);
      return updated;
    });
  };

  const handleContinue = async () => {
    if (pages.length === 0) {
      showError('Atenção', 'Por favor, adicione pelo menos uma página para escanear.');
      return;
    }

    const unprocessedPages = pages.filter(p => !p.processed);
    if (unprocessedPages.length > 0) {
      showError('Atenção', 'Aguarde o processamento de todas as páginas.');
      return;
    }

    setLoading(true);
    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      const printJob = {
        serviceType: 'scan_to_pdf',
        files: pages.map(p => ({
          url: p.processedUrl,
          name: `page_${pages.indexOf(p) + 1}.jpg`,
          size: 0,
          mimeType: 'image/jpeg',
          pageCount: 1,
        })),
        options: {
          pdfMode,
          printOption,
          colorMode: printOption === 'pdf_print' ? colorMode : undefined,
        },
      };

      console.log('ScanToPDFScreen: Creating print job:', printJob);
      const response = await authenticatedPost('/api/print-jobs', printJob);
      console.log('ScanToPDFScreen: Print job created:', response);

      router.push({
        pathname: '/payment',
        params: {
          serviceId: 'scan_to_pdf',
          serviceName: 'Escanear para PDF',
          totalPrice: totalPrice.toFixed(2),
          printJobId: response.id,
        },
      });
    } catch (error) {
      console.error('ScanToPDFScreen: Error creating print job:', error);
      showError('Erro', 'Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Escanear para PDF',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="doc.text.viewfinder" 
              android_material_icon_name="scanner" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Escanear para PDF</Text>
            <Text style={styles.headerSubtitle}>
              Tire fotos de documentos, edite automaticamente e gere PDF de alta qualidade
            </Text>
          </View>

          <View style={styles.optionsSection}>
            <Text style={styles.sectionTitle}>Modo de PDF</Text>
            <View style={styles.optionButtons}>
              <TouchableOpacity 
                style={[styles.optionButton, pdfMode === 'single' && styles.optionButtonActive]}
                onPress={() => setPdfMode('single')}
              >
                <Text style={[styles.optionButtonText, pdfMode === 'single' && styles.optionButtonTextActive]}>
                  PDF Único
                </Text>
                <Text style={[styles.optionButtonSubtext, pdfMode === 'single' && styles.optionButtonSubtextActive]}>
                  Todos em um arquivo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.optionButton, pdfMode === 'multiple' && styles.optionButtonActive]}
                onPress={() => setPdfMode('multiple')}
              >
                <Text style={[styles.optionButtonText, pdfMode === 'multiple' && styles.optionButtonTextActive]}>
                  PDFs Separados
                </Text>
                <Text style={[styles.optionButtonSubtext, pdfMode === 'multiple' && styles.optionButtonSubtextActive]}>
                  Um arquivo por página
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionsSection}>
            <Text style={styles.sectionTitle}>Opção de Saída</Text>
            <View style={styles.optionButtons}>
              <TouchableOpacity 
                style={[styles.optionButton, printOption === 'pdf_only' && styles.optionButtonActive]}
                onPress={() => setPrintOption('pdf_only')}
              >
                <Text style={[styles.optionButtonText, printOption === 'pdf_only' && styles.optionButtonTextActive]}>
                  Apenas PDF
                </Text>
                <Text style={[styles.optionButtonSubtext, printOption === 'pdf_only' && styles.optionButtonSubtextActive]}>
                  Grátis
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.optionButton, printOption === 'pdf_print' && styles.optionButtonActive]}
                onPress={() => setPrintOption('pdf_print')}
              >
                <Text style={[styles.optionButtonText, printOption === 'pdf_print' && styles.optionButtonTextActive]}>
                  PDF + Impressão
                </Text>
                <Text style={[styles.optionButtonSubtext, printOption === 'pdf_print' && styles.optionButtonSubtextActive]}>
                  Preço por página
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {printOption === 'pdf_print' && (
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>Modo de Impressão</Text>
              <View style={styles.optionButtons}>
                <TouchableOpacity 
                  style={[styles.optionButton, colorMode === 'bw' && styles.optionButtonActive]}
                  onPress={() => setColorMode('bw')}
                >
                  <Text style={[styles.optionButtonText, colorMode === 'bw' && styles.optionButtonTextActive]}>
                    P&B
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.optionButton, colorMode === 'color' && styles.optionButtonActive]}
                  onPress={() => setColorMode('color')}
                >
                  <Text style={[styles.optionButtonText, colorMode === 'color' && styles.optionButtonTextActive]}>
                    Colorido
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Adicionar Páginas</Text>
            
            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handleTakePhoto}
                disabled={processing}
              >
                <IconSymbol 
                  ios_icon_name="camera.fill" 
                  android_material_icon_name="camera" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Escanear</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickFromGallery}
                disabled={processing}
              >
                <IconSymbol 
                  ios_icon_name="photo.fill" 
                  android_material_icon_name="photo-library" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Galeria</Text>
              </TouchableOpacity>
            </View>

            {processing && (
              <View style={styles.processingIndicator}>
                <ActivityIndicator size="small" color={colors.secondary} />
                <Text style={styles.processingText}>Processando páginas...</Text>
              </View>
            )}
          </View>

          {pages.length > 0 && (
            <>
              <View style={styles.pagesSection}>
                <Text style={styles.sectionTitle}>Páginas Escaneadas ({pages.length})</Text>
                <Text style={styles.sectionSubtitle}>Arraste para reordenar</Text>
                
                <View style={styles.pagesGrid}>
                  {pages.map((page, index) => (
                    <View key={index} style={styles.pageContainer}>
                      <View style={styles.pageCard}>
                        <Image 
                          source={{ uri: page.processed && page.processedUrl ? page.processedUrl : page.uri }} 
                          style={styles.pageImage}
                          resizeMode="cover"
                        />
                        <View style={styles.pageNumber}>
                          <Text style={styles.pageNumberText}>{index + 1}</Text>
                        </View>
                        {page.processed && (
                          <View style={styles.processedBadge}>
                            <IconSymbol 
                              ios_icon_name="checkmark.circle.fill" 
                              android_material_icon_name="check-circle" 
                              size={20} 
                              color={colors.success} 
                            />
                          </View>
                        )}
                      </View>
                      <View style={styles.pageActions}>
                        {index > 0 && (
                          <TouchableOpacity 
                            style={styles.pageActionButton}
                            onPress={() => movePage(index, index - 1)}
                          >
                            <IconSymbol 
                              ios_icon_name="arrow.up" 
                              android_material_icon_name="arrow-upward" 
                              size={16} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                        )}
                        {index < pages.length - 1 && (
                          <TouchableOpacity 
                            style={styles.pageActionButton}
                            onPress={() => movePage(index, index + 1)}
                          >
                            <IconSymbol 
                              ios_icon_name="arrow.down" 
                              android_material_icon_name="arrow-downward" 
                              size={16} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                          style={styles.pageActionButton}
                          onPress={() => removePage(index)}
                        >
                          <IconSymbol 
                            ios_icon_name="trash.fill" 
                            android_material_icon_name="delete" 
                            size={16} 
                            color={colors.error} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total de Páginas:</Text>
                  <Text style={styles.summaryValue}>{pages.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Modo:</Text>
                  <Text style={styles.summaryValue}>
                    {pdfMode === 'single' ? 'PDF Único' : 'PDFs Separados'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Saída:</Text>
                  <Text style={styles.summaryValue}>
                    {printOption === 'pdf_only' ? 'Apenas PDF' : `PDF + Impressão ${colorMode === 'bw' ? 'P&B' : 'Colorida'}`}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total:</Text>
                  <Text style={styles.summaryTotalValue}>
                    {printOption === 'pdf_only' ? 'Grátis' : `R$ ${totalPrice.toFixed(2)}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.continueButton, (loading || processing) && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={loading || processing}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>
                      {printOption === 'pdf_only' ? 'Gerar PDF' : 'Continuar para Pagamento'}
                    </Text>
                    <IconSymbol 
                      ios_icon_name="arrow.right" 
                      android_material_icon_name="arrow-forward" 
                      size={24} 
                      color="#FFFFFF" 
                    />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{errorModal.title}</Text>
            <Text style={styles.modalMessage}>{errorModal.message}</Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
  },
  optionButtonSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionButtonSubtextActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.secondary + '30',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pagesSection: {
    marginBottom: 24,
  },
  pagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageContainer: {
    width: '31%',
  },
  pageCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 3/4,
    position: 'relative',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  pageNumber: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  processedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  pageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  pageActionButton: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  summaryTotal: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.secondary,
  },
  continueButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

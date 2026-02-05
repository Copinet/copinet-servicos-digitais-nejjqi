
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface UploadedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  pageCount: number;
  url?: string;
  photoSize: string;
  copies: number;
}

const PHOTO_SIZES = [
  { value: '10x15', label: '10x15 cm', price: 2.00 },
  { value: '13x18', label: '13x18 cm', price: 3.50 },
  { value: '15x21', label: '15x21 cm', price: 5.00 },
  { value: '21x29', label: '21x29 cm (A4)', price: 8.00 },
];

export default function PhotoPrintScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricing, setPricing] = useState<any>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    console.log('PhotoPrintScreen: Loading pricing');
    loadPricing();
  }, []);

  useEffect(() => {
    calculateTotalPrice();
  }, [files, pricing]);

  const loadPricing = async () => {
    try {
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/pricing');
      setPricing(data);
      console.log('PhotoPrintScreen: Pricing loaded:', data);
    } catch (error) {
      console.error('PhotoPrintScreen: Error loading pricing:', error);
      showError('Erro', 'Não foi possível carregar os preços. Tente novamente.');
    }
  };

  const calculateTotalPrice = () => {
    if (!pricing || !pricing.photo_print || !pricing.photo_print.sizes) {
      setTotalPrice(0);
      return;
    }

    let total = 0;
    files.forEach(file => {
      const sizePrice = pricing.photo_print.sizes[file.photoSize] || 0;
      total += sizePrice * file.copies;
    });

    setTotalPrice(total);
  };

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const handlePickImage = async () => {
    try {
      console.log('PhotoPrintScreen: Picking images');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        console.log('PhotoPrintScreen: Images picked:', result.assets.length);
        await uploadFiles(result.assets);
      }
    } catch (error) {
      console.error('PhotoPrintScreen: Error picking image:', error);
      showError('Erro', 'Não foi possível selecionar as imagens. Tente novamente.');
    }
  };

  const handlePickPDF = async () => {
    try {
      console.log('PhotoPrintScreen: Picking PDF');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        console.log('PhotoPrintScreen: PDFs picked:', result.assets.length);
        await uploadFiles(result.assets);
      }
    } catch (error) {
      console.error('PhotoPrintScreen: Error picking PDF:', error);
      showError('Erro', 'Não foi possível selecionar o PDF. Tente novamente.');
    }
  };

  const uploadFiles = async (assets: any[]) => {
    setUploading(true);
    try {
      const { uploadMultipleFiles, getErrorMessage } = await import('@/utils/api');
      
      const filesToUpload = assets.map(asset => ({
        uri: asset.uri,
        name: asset.name || asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));

      console.log('PhotoPrintScreen: Uploading files:', filesToUpload.length);
      
      const result = await uploadMultipleFiles(filesToUpload, (progress) => {
        console.log('PhotoPrintScreen: Upload progress:', progress + '%');
      });

      console.log('PhotoPrintScreen: Upload complete:', result);

      // Add successfully uploaded files
      if (result.uploads.length > 0) {
        const newFiles: UploadedFile[] = result.uploads.map(upload => ({
          uri: assets.find(a => (a.name || a.fileName) === upload.filename)?.uri || '',
          name: upload.filename,
          size: upload.size,
          mimeType: upload.mimeType,
          pageCount: upload.pageCount,
          url: upload.url,
          photoSize: '10x15',
          copies: 1,
        }));

        setFiles(prev => [...prev, ...newFiles]);
      }

      // Show errors for failed uploads
      if (result.failed.length > 0) {
        const failedNames = result.failed.map(f => f.filename).join(', ');
        const errorMsg = result.failed[0].error;
        showError(
          'Alguns arquivos falharam',
          `Não foi possível fazer upload de: ${failedNames}\n\nErro: ${errorMsg}`
        );
      }
    } catch (error) {
      console.error('PhotoPrintScreen: Error uploading files:', error);
      const { getErrorMessage } = await import('@/utils/api');
      showError('Erro no Upload', getErrorMessage('UPLOAD_FAILED'));
    } finally {
      setUploading(false);
    }
  };

  const updateFileOption = (index: number, field: keyof UploadedFile, value: any) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    if (files.length === 0) {
      showError('Atenção', 'Por favor, adicione pelo menos uma foto para imprimir.');
      return;
    }

    setLoading(true);
    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      const printJob = {
        serviceType: 'photo_print',
        files: files.map(f => ({
          url: f.url,
          name: f.name,
          size: f.size,
          mimeType: f.mimeType,
          pageCount: f.pageCount,
        })),
        options: {
          files: files.map(f => ({
            name: f.name,
            photoSize: f.photoSize,
            copies: f.copies,
            paperType: 'photographic',
          })),
        },
      };

      console.log('PhotoPrintScreen: Creating print job:', printJob);
      const response = await authenticatedPost('/api/print-jobs', printJob);
      console.log('PhotoPrintScreen: Print job created:', response);

      router.push({
        pathname: '/payment',
        params: {
          serviceId: 'photo_print',
          serviceName: 'Impressão de Fotos',
          totalPrice: totalPrice.toFixed(2),
          printJobId: response.id,
        },
      });
    } catch (error) {
      console.error('PhotoPrintScreen: Error creating print job:', error);
      showError('Erro', 'Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getSizePrice = (size: string) => {
    if (!pricing || !pricing.photo_print || !pricing.photo_print.sizes) {
      const defaultSize = PHOTO_SIZES.find(s => s.value === size);
      return defaultSize?.price || 0;
    }
    return pricing.photo_print.sizes[size] || 0;
  };

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Impressão de Fotos',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="photo.fill" 
              android_material_icon_name="photo" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Impressão de Fotos</Text>
            <Text style={styles.headerSubtitle}>
              Faça upload de fotos ou PDFs e escolha o tamanho de impressão em papel fotográfico
            </Text>
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Adicionar Fotos</Text>
            
            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickImage}
                disabled={uploading}
              >
                <IconSymbol 
                  ios_icon_name="photo.fill" 
                  android_material_icon_name="image" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Fotos</Text>
                <Text style={styles.uploadButtonSubtext}>JPG, PNG</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickPDF}
                disabled={uploading}
              >
                <IconSymbol 
                  ios_icon_name="doc.fill" 
                  android_material_icon_name="description" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>PDF</Text>
                <Text style={styles.uploadButtonSubtext}>Documento</Text>
              </TouchableOpacity>
            </View>

            {uploading && (
              <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="small" color={colors.secondary} />
                <Text style={styles.uploadingText}>Fazendo upload...</Text>
              </View>
            )}
          </View>

          {files.length > 0 && (
            <>
              <View style={styles.filesSection}>
                <Text style={styles.sectionTitle}>Fotos Adicionadas</Text>
                
                {files.map((file, index) => (
                  <View key={index} style={styles.fileCard}>
                    <View style={styles.fileHeader}>
                      <View style={styles.fileInfo}>
                        <IconSymbol 
                          ios_icon_name="photo.fill" 
                          android_material_icon_name="image" 
                          size={24} 
                          color={colors.secondary} 
                        />
                        <View style={styles.fileDetails}>
                          <Text style={styles.fileName}>{file.name}</Text>
                          <Text style={styles.filePages}>
                            {file.mimeType.includes('pdf') ? `${file.pageCount} página(s)` : 'Imagem'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removeFile(index)}>
                        <IconSymbol 
                          ios_icon_name="trash.fill" 
                          android_material_icon_name="delete" 
                          size={24} 
                          color={colors.error} 
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fileOptions}>
                      <View style={styles.optionRow}>
                        <Text style={styles.optionLabel}>Tamanho:</Text>
                        <View style={styles.sizeButtons}>
                          {PHOTO_SIZES.map(size => (
                            <TouchableOpacity 
                              key={size.value}
                              style={[
                                styles.sizeButton, 
                                file.photoSize === size.value && styles.sizeButtonActive
                              ]}
                              onPress={() => updateFileOption(index, 'photoSize', size.value)}
                            >
                              <Text style={[
                                styles.sizeButtonText, 
                                file.photoSize === size.value && styles.sizeButtonTextActive
                              ]}>
                                {size.label}
                              </Text>
                              <Text style={[
                                styles.sizeButtonPrice, 
                                file.photoSize === size.value && styles.sizeButtonPriceActive
                              ]}>
                                R$ {getSizePrice(size.value).toFixed(2)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.optionRow}>
                        <Text style={styles.optionLabel}>Cópias:</Text>
                        <View style={styles.copiesControl}>
                          <TouchableOpacity 
                            style={styles.copiesButton}
                            onPress={() => updateFileOption(index, 'copies', Math.max(1, file.copies - 1))}
                          >
                            <IconSymbol 
                              ios_icon_name="minus" 
                              android_material_icon_name="remove" 
                              size={20} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                          <Text style={styles.copiesValue}>{file.copies}</Text>
                          <TouchableOpacity 
                            style={styles.copiesButton}
                            onPress={() => updateFileOption(index, 'copies', file.copies + 1)}
                          >
                            <IconSymbol 
                              ios_icon_name="plus" 
                              android_material_icon_name="add" 
                              size={20} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total de Fotos:</Text>
                  <Text style={styles.summaryValue}>{files.reduce((sum, f) => sum + f.copies, 0)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Papel:</Text>
                  <Text style={styles.summaryValue}>Fotográfico</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total:</Text>
                  <Text style={styles.summaryTotalValue}>R$ {totalPrice.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.continueButton, loading && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>Continuar para Pagamento</Text>
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
  uploadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
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
  uploadButtonSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  uploadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filesSection: {
    marginBottom: 24,
  },
  fileCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  filePages: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  fileOptions: {
    gap: 16,
  },
  optionRow: {
    gap: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sizeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '48%',
  },
  sizeButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  sizeButtonTextActive: {
    color: '#FFFFFF',
  },
  sizeButtonPrice: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sizeButtonPriceActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  copiesControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copiesButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copiesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minWidth: 30,
    textAlign: 'center',
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

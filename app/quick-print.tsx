
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

interface UploadedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  pageCount: number;
  url?: string;
  colorMode: 'bw' | 'color';
  copies: number;
  pageRange: string;
}

export default function QuickPrintScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricing, setPricing] = useState<any>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    console.log('QuickPrintScreen: Loading pricing');
    loadPricing();
    
    if (params.sharedFile) {
      console.log('QuickPrintScreen: Received shared file:', params.sharedFile);
    }
  }, []);

  useEffect(() => {
    calculateTotalPrice();
  }, [files, pricing]);

  const loadPricing = async () => {
    try {
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/pricing');
      setPricing(data);
      console.log('QuickPrintScreen: Pricing loaded:', data);
    } catch (error) {
      console.error('QuickPrintScreen: Error loading pricing:', error);
      showError('Erro', 'Não foi possível carregar os preços. Tente novamente.');
    }
  };

  const calculateTotalPrice = () => {
    if (!pricing || !pricing.quick_print) {
      setTotalPrice(0);
      return;
    }

    let total = 0;
    const bwPrice = pricing.quick_print.pricePerPageBW || 0.50;
    const colorPrice = pricing.quick_print.pricePerPageColor || 1.00;

    files.forEach(file => {
      const pricePerPage = file.colorMode === 'color' ? colorPrice : bwPrice;
      const pagesToPrint = file.pageRange === 'all' ? file.pageCount : calculatePageRangeCount(file.pageRange, file.pageCount);
      total += pricePerPage * pagesToPrint * file.copies;
    });

    setTotalPrice(total);
  };

  const calculatePageRangeCount = (range: string, totalPages: number): number => {
    if (!range || range === 'all') {
      return totalPages;
    }

    try {
      const parts = range.split(',');
      let count = 0;
      
      parts.forEach(part => {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end) && start <= end && start > 0 && end <= totalPages) {
            count += (end - start + 1);
          }
        } else {
          const page = parseInt(trimmed);
          if (!isNaN(page) && page > 0 && page <= totalPages) {
            count += 1;
          }
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error calculating page range:', error);
      return totalPages;
    }
  };

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const handlePickDocument = async () => {
    try {
      console.log('QuickPrintScreen: Picking document');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        console.log('QuickPrintScreen: Documents picked:', result.assets.length);
        await uploadFiles(result.assets);
      }
    } catch (error) {
      console.error('QuickPrintScreen: Error picking document:', error);
      showError('Erro', 'Não foi possível selecionar o arquivo. Tente novamente.');
    }
  };

  const handlePickImage = async () => {
    try {
      console.log('QuickPrintScreen: Picking image');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        console.log('QuickPrintScreen: Images picked:', result.assets.length);
        await uploadFiles(result.assets);
      }
    } catch (error) {
      console.error('QuickPrintScreen: Error picking image:', error);
      showError('Erro', 'Não foi possível selecionar a imagem. Tente novamente.');
    }
  };

  const uploadFiles = async (assets: any[]) => {
    setUploading(true);
    try {
      const { uploadMultipleFiles, getErrorMessage } = await import('@/utils/api');
      
      const filesToUpload = assets.map(asset => ({
        uri: asset.uri,
        name: asset.name || asset.fileName || `file_${Date.now()}.pdf`,
        type: asset.mimeType || 'application/octet-stream',
      }));

      console.log('QuickPrintScreen: Uploading files:', filesToUpload.length);
      
      const result = await uploadMultipleFiles(filesToUpload, (progress) => {
        console.log('QuickPrintScreen: Upload progress:', progress + '%');
      });

      console.log('QuickPrintScreen: Upload complete:', result);

      // Add successfully uploaded files
      if (result.uploads.length > 0) {
        const newFiles: UploadedFile[] = result.uploads.map(upload => ({
          uri: assets.find(a => (a.name || a.fileName) === upload.filename)?.uri || '',
          name: upload.filename,
          size: upload.size,
          mimeType: upload.mimeType,
          pageCount: upload.pageCount,
          url: upload.url,
          colorMode: 'bw',
          copies: 1,
          pageRange: 'all',
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

      // Show success message if all uploaded
      if (result.uploads.length > 0 && result.failed.length === 0) {
        console.log('QuickPrintScreen: All files uploaded successfully');
      }
    } catch (error) {
      console.error('QuickPrintScreen: Error uploading files:', error);
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
      showError('Atenção', 'Por favor, adicione pelo menos um arquivo para imprimir.');
      return;
    }

    setLoading(true);
    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      const printJob = {
        serviceType: 'quick_print',
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
            colorMode: f.colorMode,
            copies: f.copies,
            paperType: 'A4',
            paperSize: 'A4',
            pageRange: f.pageRange,
          })),
          notes,
        },
      };

      console.log('QuickPrintScreen: Creating print job:', printJob);
      const response = await authenticatedPost('/api/print-jobs', printJob);
      console.log('QuickPrintScreen: Print job created:', response);

      router.push({
        pathname: '/payment',
        params: {
          serviceId: 'quick_print',
          serviceName: 'Impressão Rápida',
          totalPrice: totalPrice.toFixed(2),
          printJobId: response.id,
        },
      });
    } catch (error) {
      console.error('QuickPrintScreen: Error creating print job:', error);
      showError('Erro', 'Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const totalPagesText = files.reduce((sum, f) => {
    const pages = f.pageRange === 'all' ? f.pageCount : calculatePageRangeCount(f.pageRange, f.pageCount);
    return sum + (pages * f.copies);
  }, 0);

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Impressão Rápida',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="printer.fill" 
              android_material_icon_name="print" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Impressão Rápida</Text>
            <Text style={styles.headerSubtitle}>
              Faça upload de documentos PDF, Word ou imagens e escolha as opções de impressão
            </Text>
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Adicionar Arquivos</Text>
            
            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickDocument}
                disabled={uploading}
              >
                <IconSymbol 
                  ios_icon_name="doc.fill" 
                  android_material_icon_name="description" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Documentos</Text>
                <Text style={styles.uploadButtonSubtext}>PDF, Word</Text>
              </TouchableOpacity>

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
                <Text style={styles.uploadButtonText}>Imagens</Text>
                <Text style={styles.uploadButtonSubtext}>JPG, PNG</Text>
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
                <Text style={styles.sectionTitle}>Arquivos Adicionados</Text>
                
                {files.map((file, index) => (
                  <View key={index} style={styles.fileCard}>
                    <View style={styles.fileHeader}>
                      <View style={styles.fileInfo}>
                        <IconSymbol 
                          ios_icon_name="doc.fill" 
                          android_material_icon_name="description" 
                          size={24} 
                          color={colors.secondary} 
                        />
                        <View style={styles.fileDetails}>
                          <Text style={styles.fileName}>{file.name}</Text>
                          <Text style={styles.filePages}>{file.pageCount} página(s)</Text>
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
                        <Text style={styles.optionLabel}>Modo de Cor:</Text>
                        <View style={styles.colorModeButtons}>
                          <TouchableOpacity 
                            style={[styles.colorModeButton, file.colorMode === 'bw' && styles.colorModeButtonActive]}
                            onPress={() => updateFileOption(index, 'colorMode', 'bw')}
                          >
                            <Text style={[styles.colorModeButtonText, file.colorMode === 'bw' && styles.colorModeButtonTextActive]}>
                              P&B
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.colorModeButton, file.colorMode === 'color' && styles.colorModeButtonActive]}
                            onPress={() => updateFileOption(index, 'colorMode', 'color')}
                          >
                            <Text style={[styles.colorModeButtonText, file.colorMode === 'color' && styles.colorModeButtonTextActive]}>
                              Colorido
                            </Text>
                          </TouchableOpacity>
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

                      {file.pageCount > 1 && (
                        <View style={styles.optionRow}>
                          <Text style={styles.optionLabel}>Páginas:</Text>
                          <TextInput
                            style={styles.pageRangeInput}
                            value={file.pageRange}
                            onChangeText={(text) => updateFileOption(index, 'pageRange', text)}
                            placeholder="Ex: 1-3, 5, 7-10 ou 'all'"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>Observações (Opcional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ex: Arquivo com senha 1234, imprimir frente e verso, etc."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total de Páginas:</Text>
                  <Text style={styles.summaryValue}>{totalPagesText}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Papel:</Text>
                  <Text style={styles.summaryValue}>A4 Comum</Text>
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
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  colorModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  colorModeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorModeButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  colorModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  colorModeButtonTextActive: {
    color: '#FFFFFF',
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
  pageRangeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: 12,
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
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

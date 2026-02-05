
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Platform, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraType, CameraView } from 'expo-camera';

interface Photo {
  uri: string;
  selected: boolean;
  processed?: boolean;
  processedUrl?: string;
}

export default function Photo3x4Screen() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState(10.00);
  const [pricing, setPricing] = useState<any>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    console.log('Photo3x4Screen: Loading pricing');
    loadPricing();
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === 'granted');
  };

  const loadPricing = async () => {
    try {
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/pricing');
      setPricing(data);
      if (data.photo_3x4 && data.photo_3x4.price) {
        setTotalPrice(data.photo_3x4.price);
      }
      console.log('Photo3x4Screen: Pricing loaded:', data);
    } catch (error) {
      console.error('Photo3x4Screen: Error loading pricing:', error);
      showError('Erro', 'Não foi possível carregar os preços. Tente novamente.');
    }
  };

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const handleOpenCamera = () => {
    if (!cameraPermission) {
      showError('Permissão Necessária', 'Por favor, permita o acesso à câmera para tirar fotos.');
      return;
    }
    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) {
      return;
    }

    try {
      console.log('Photo3x4Screen: Taking photo...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
      });

      console.log('Photo3x4Screen: Photo taken:', photo.uri);
      setCapturedPhoto(photo.uri);
    } catch (error) {
      console.error('Photo3x4Screen: Error taking photo:', error);
      showError('Erro', 'Não foi possível tirar a foto. Tente novamente.');
    }
  };

  const handleAcceptPhoto = () => {
    if (capturedPhoto) {
      const newPhoto: Photo = {
        uri: capturedPhoto,
        selected: false,
        processed: false,
      };
      setPhotos(prev => [...prev, newPhoto]);
      setCapturedPhoto(null);
      setShowCamera(false);
    }
  };

  const handleRejectPhoto = () => {
    setCapturedPhoto(null);
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const newPhotos: Photo[] = result.assets.map(asset => ({
          uri: asset.uri,
          selected: false,
          processed: false,
        }));
        setPhotos(prev => [...prev, ...newPhotos]);
      }
    } catch (error) {
      console.error('Photo3x4Screen: Error picking from gallery:', error);
      showError('Erro', 'Não foi possível selecionar as fotos. Tente novamente.');
    }
  };

  const selectPhoto = (index: number) => {
    setPhotos(prev => prev.map((photo, i) => ({
      ...photo,
      selected: i === index,
    })));
    setSelectedPhoto(photos[index]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (selectedPhoto && photos[index].uri === selectedPhoto.uri) {
      setSelectedPhoto(null);
    }
  };

  const handleProcessPhoto = async () => {
    if (!selectedPhoto) {
      showError('Atenção', 'Por favor, selecione uma foto para processar.');
      return;
    }

    setProcessing(true);
    try {
      const { uploadFile, authenticatedPost, getErrorMessage } = await import('@/utils/api');
      
      const file = {
        uri: selectedPhoto.uri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      };

      console.log('Photo3x4Screen: Uploading photo...');
      const uploadResult = await uploadFile(file);

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      console.log('Photo3x4Screen: Photo uploaded:', uploadResult);

      console.log('Photo3x4Screen: Processing with AI...');
      
      try {
        // Create a timeout promise (5 minutes for AI processing)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 300000);
        });

        const processPromise = authenticatedPost('/api/ai/remove-background', {
          imageUrl: uploadResult.url,
        });

        const processResponse = await Promise.race([processPromise, timeoutPromise]) as any;

        console.log('Photo3x4Screen: Photo processed:', processResponse);

        if (processResponse.success && processResponse.processedImageUrl) {
          setPhotos(prev => prev.map(photo => 
            photo.uri === selectedPhoto.uri 
              ? { ...photo, processed: true, processedUrl: processResponse.processedImageUrl }
              : photo
          ));

          setSelectedPhoto({
            ...selectedPhoto,
            processed: true,
            processedUrl: processResponse.processedImageUrl,
          });

          showError('Sucesso', 'Foto processada com sucesso! Fundo branco aplicado.');
        } else {
          console.warn('Photo3x4Screen: AI processing failed, using original image');
          setPhotos(prev => prev.map(photo => 
            photo.uri === selectedPhoto.uri 
              ? { ...photo, processed: true, processedUrl: uploadResult.url }
              : photo
          ));

          setSelectedPhoto({
            ...selectedPhoto,
            processed: true,
            processedUrl: uploadResult.url,
          });

          showError('Aviso', 'Não foi possível remover o fundo automaticamente. A foto original será usada.');
        }
      } catch (aiError: any) {
        console.warn('Photo3x4Screen: AI processing error, using original image:', aiError);
        
        setPhotos(prev => prev.map(photo => 
          photo.uri === selectedPhoto.uri 
            ? { ...photo, processed: true, processedUrl: uploadResult.url }
            : photo
        ));

        setSelectedPhoto({
          ...selectedPhoto,
          processed: true,
          processedUrl: uploadResult.url,
        });

        const errorMsg = aiError.message === 'TIMEOUT' 
          ? 'O processamento demorou muito. A foto original será usada.'
          : 'Não foi possível remover o fundo automaticamente. A foto original será usada.';
        
        showError('Aviso', errorMsg);
      }
    } catch (error) {
      console.error('Photo3x4Screen: Error processing photo:', error);
      const { getErrorMessage } = await import('@/utils/api');
      showError('Erro', getErrorMessage('PROCESSING_FAILED'));
    } finally {
      setProcessing(false);
    }
  };

  const handleContinue = async () => {
    const processedPhoto = photos.find(p => p.processed && p.selected);
    
    if (!processedPhoto) {
      showError('Atenção', 'Por favor, selecione e processe uma foto antes de continuar.');
      return;
    }

    setLoading(true);
    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      const printJob = {
        serviceType: 'photo_3x4',
        files: [{
          url: processedPhoto.processedUrl,
          name: 'foto_3x4.jpg',
          size: 0,
          mimeType: 'image/jpeg',
          pageCount: 1,
        }],
        options: {
          photoSize: '3x4',
          copies: 6,
          paperType: 'photographic',
          paperSize: '10x15',
        },
      };

      console.log('Photo3x4Screen: Creating print job:', printJob);
      const response = await authenticatedPost('/api/print-jobs', printJob);
      console.log('Photo3x4Screen: Print job created:', response);

      router.push({
        pathname: '/stores-map',
        params: {
          serviceId: 'photo_3x4',
          serviceName: 'Foto 3x4 para Documentos',
          totalPrice: totalPrice.toFixed(2),
          printJobId: response.id,
          needsPrinting: 'true',
        },
      });
    } catch (error) {
      console.error('Photo3x4Screen: Error creating print job:', error);
      showError('Erro', 'Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (showCamera) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            title: 'Tirar Foto',
            headerShown: true,
            headerBackTitle: 'Voltar',
          }}
        />
        <View style={styles.cameraContainer}>
          {capturedPhoto ? (
            <>
              <Image source={{ uri: capturedPhoto }} style={styles.capturedImage} resizeMode="contain" />
              <View style={styles.captureActions}>
                <TouchableOpacity style={styles.rejectButton} onPress={handleRejectPhoto}>
                  <IconSymbol 
                    ios_icon_name="xmark.circle.fill" 
                    android_material_icon_name="cancel" 
                    size={32} 
                    color={colors.error} 
                  />
                  <Text style={styles.rejectButtonText}>Recusar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptPhoto}>
                  <IconSymbol 
                    ios_icon_name="checkmark.circle.fill" 
                    android_material_icon_name="check-circle" 
                    size={32} 
                    color={colors.success} 
                  />
                  <Text style={styles.acceptButtonText}>Aceitar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <CameraView 
                ref={cameraRef}
                style={styles.camera}
                facing="front"
              />
              <View style={styles.cameraControls}>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowCamera(false)}>
                  <IconSymbol 
                    ios_icon_name="xmark" 
                    android_material_icon_name="close" 
                    size={28} 
                    color="#FFFFFF" 
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
                <View style={styles.placeholder} />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Foto 3x4',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="camera.fill" 
              android_material_icon_name="camera" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Foto 3x4 para Documentos</Text>
            <Text style={styles.headerSubtitle}>
              Tire selfies, edite automaticamente com fundo branco e imprima 6 fotos em papel 10x15
            </Text>
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Tirar ou Selecionar Fotos</Text>
            
            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handleOpenCamera}
              >
                <IconSymbol 
                  ios_icon_name="camera.fill" 
                  android_material_icon_name="camera" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Tirar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickFromGallery}
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
          </View>

          {photos.length > 0 && (
            <>
              <View style={styles.photosSection}>
                <Text style={styles.sectionTitle}>Fotos Tiradas</Text>
                <Text style={styles.sectionSubtitle}>Toque para selecionar</Text>
                
                <View style={styles.photosGrid}>
                  {photos.map((photo, index) => (
                    <View key={index} style={styles.photoContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.photoCard,
                          photo.selected && styles.photoCardSelected,
                        ]}
                        onPress={() => selectPhoto(index)}
                      >
                        <Image 
                          source={{ uri: photo.processed && photo.processedUrl ? photo.processedUrl : photo.uri }} 
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                        {photo.processed && (
                          <View style={styles.processedBadge}>
                            <IconSymbol 
                              ios_icon_name="checkmark.circle.fill" 
                              android_material_icon_name="check-circle" 
                              size={20} 
                              color={colors.success} 
                            />
                          </View>
                        )}
                        {photo.selected && (
                          <View style={styles.selectedBadge}>
                            <IconSymbol 
                              ios_icon_name="checkmark.circle.fill" 
                              android_material_icon_name="check-circle" 
                              size={24} 
                              color={colors.secondary} 
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => removePhoto(index)}
                      >
                        <IconSymbol 
                          ios_icon_name="trash.fill" 
                          android_material_icon_name="delete" 
                          size={18} 
                          color={colors.error} 
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              {selectedPhoto && (
                <View style={styles.editorSection}>
                  <Text style={styles.sectionTitle}>Editar Foto Selecionada</Text>
                  
                  <View style={styles.previewCard}>
                    <Image 
                      source={{ uri: selectedPhoto.processed && selectedPhoto.processedUrl ? selectedPhoto.processedUrl : selectedPhoto.uri }} 
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  </View>

                  <TouchableOpacity 
                    style={[styles.processButton, (processing || selectedPhoto.processed) && styles.processButtonDisabled]}
                    onPress={handleProcessPhoto}
                    disabled={processing || selectedPhoto.processed}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <IconSymbol 
                          ios_icon_name="wand.and.stars" 
                          android_material_icon_name="auto-fix-high" 
                          size={24} 
                          color="#FFFFFF" 
                        />
                        <Text style={styles.processButtonText}>
                          {selectedPhoto.processed ? 'Foto Processada' : 'Aplicar Fundo Branco'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.infoCard}>
                    <IconSymbol 
                      ios_icon_name="info.circle.fill" 
                      android_material_icon_name="info" 
                      size={24} 
                      color={colors.accent} 
                    />
                    <Text style={styles.infoText}>
                      A foto será automaticamente ajustada para o tamanho 3x4cm com fundo branco. 
                      Você receberá 6 fotos impressas em papel fotográfico 10x15cm.
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Quantidade:</Text>
                  <Text style={styles.summaryValue}>6 fotos 3x4</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Papel:</Text>
                  <Text style={styles.summaryValue}>Fotográfico 10x15</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total:</Text>
                  <Text style={styles.summaryTotalValue}>R$ {totalPrice.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.continueButton, (loading || !selectedPhoto?.processed) && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={loading || !selectedPhoto?.processed}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>Escolher Onde Retirar</Text>
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  capturedImage: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.secondary,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
  },
  placeholder: {
    width: 56,
    height: 56,
  },
  captureActions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  rejectButton: {
    alignItems: 'center',
    gap: 8,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  acceptButton: {
    alignItems: 'center',
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
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
  photosSection: {
    marginBottom: 24,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoContainer: {
    width: '31%',
    position: 'relative',
  },
  photoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 3/4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoCardSelected: {
    borderColor: colors.secondary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  processedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  removeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editorSection: {
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: 200,
    height: 267,
    borderRadius: 12,
  },
  processButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: colors.accent + '20',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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

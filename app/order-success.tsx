
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Linking } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  const orderId = params.orderId as string;
  const serviceType = params.serviceType as string;

  const loadOrderDataCallback = React.useCallback(() => {
    const loadOrderDataInternal = async () => {
      try {
        const { authenticatedGet } = await import('@/utils/api');
        
        // For scan-to-pdf, load from print-jobs endpoint
        const isScanToPDF = serviceType === 'scan_to_pdf';
        
        let response;
        if (isScanToPDF) {
          console.log('OrderSuccessScreen: Loading print job data for scan-to-pdf');
          response = await authenticatedGet(`/api/print-jobs/${orderId}`);
          
          // Transform print job data to match order structure
          response = {
            ...response,
            orderNumber: response.id,
            serviceName: 'Escanear para PDF',
            serviceType: 'scan_to_pdf',
            printJobId: response.id,
          };
        } else {
          response = await authenticatedGet(`/api/orders/${orderId}`);
        }
        
        setOrderData(response);
        console.log('OrderSuccessScreen: Order data loaded:', response);
      } catch (error) {
        console.error('OrderSuccessScreen: Error loading order:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrderDataInternal();
  }, [orderId, serviceType]);

  useEffect(() => {
    loadOrderDataCallback();
  }, [loadOrderDataCallback]);



  const handleDownloadPDF = async () => {
    if (!orderData?.pdfUrl && !orderData?.printJobId) {
      console.error('OrderSuccessScreen: No PDF URL or print job ID available');
      return;
    }

    setDownloading(true);
    try {
      const { authenticatedGet } = await import('@/utils/api');
      
      // Get the download URL from the backend
      const printJobId = orderData.printJobId || orderData.id;
      console.log('OrderSuccessScreen: Fetching download URL for print job:', printJobId);
      
      const downloadData = await authenticatedGet(`/api/print-jobs/${printJobId}/download`);
      console.log('OrderSuccessScreen: Download data received:', downloadData);
      
      const pdfUrl = downloadData.pdfUrl;
      if (!pdfUrl) {
        throw new Error('PDF URL não disponível');
      }
      
      const fileName = downloadData.filename || `${orderData.orderNumber || 'documento'}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;

      console.log('OrderSuccessScreen: Downloading PDF from:', pdfUrl);
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
      
      console.log('OrderSuccessScreen: PDF downloaded to:', downloadResult.uri);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Salvar PDF',
        });
      } else {
        console.log('OrderSuccessScreen: Sharing not available on this device');
      }
    } catch (error) {
      console.error('OrderSuccessScreen: Error downloading PDF:', error);
      // Show error to user
      alert('Erro ao baixar PDF. Por favor, tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!orderData?.printJobId && !orderData?.id) {
      console.error('OrderSuccessScreen: No print job ID available for sharing');
      return;
    }

    try {
      const { authenticatedPost } = await import('@/utils/api');
      const printJobId = orderData.printJobId || orderData.id;
      
      console.log('OrderSuccessScreen: Sharing via WhatsApp for print job:', printJobId);
      
      // Call backend share endpoint
      const shareResponse = await authenticatedPost(`/api/print-jobs/${printJobId}/share`, {
        method: 'whatsapp',
        message: `Confira meu documento PDF escaneado! Pedido: ${orderData.orderNumber || printJobId}`,
      });
      
      console.log('OrderSuccessScreen: Share response:', shareResponse);
      
      // Get the shareable link from response
      const shareableLink = shareResponse.shareableLink || orderData.pdfUrl;
      
      if (shareableLink) {
        const message = encodeURIComponent(`Confira meu documento PDF escaneado!\n\nPedido: ${orderData.orderNumber || printJobId}\n\nBaixe aqui: ${shareableLink}`);
        const whatsappUrl = `whatsapp://send?text=${message}`;
        
        const supported = await Linking.canOpenURL(whatsappUrl);
        if (supported) {
          await Linking.openURL(whatsappUrl);
        } else {
          console.log('OrderSuccessScreen: WhatsApp not installed');
          alert('WhatsApp não está instalado neste dispositivo');
        }
      }
    } catch (error) {
      console.error('OrderSuccessScreen: Error sharing via WhatsApp:', error);
      alert('Erro ao compartilhar via WhatsApp. Por favor, tente novamente.');
    }
  };

  const handleShareEmail = async () => {
    if (!orderData?.printJobId && !orderData?.id) {
      console.error('OrderSuccessScreen: No print job ID available for sharing');
      return;
    }

    try {
      const { authenticatedPost } = await import('@/utils/api');
      const printJobId = orderData.printJobId || orderData.id;
      
      console.log('OrderSuccessScreen: Sharing via Email for print job:', printJobId);
      
      // Call backend share endpoint
      const shareResponse = await authenticatedPost(`/api/print-jobs/${printJobId}/share`, {
        method: 'email',
        message: `Segue o link para download do documento PDF escaneado. Pedido: ${orderData.orderNumber || printJobId}`,
      });
      
      console.log('OrderSuccessScreen: Share response:', shareResponse);
      
      // Get the shareable link from response
      const shareableLink = shareResponse.shareableLink || orderData.pdfUrl;
      
      if (shareableLink) {
        const subject = encodeURIComponent(`Documento PDF - Pedido ${orderData.orderNumber || printJobId}`);
        const body = encodeURIComponent(`Olá,\n\nSegue o link para download do documento PDF escaneado:\n\n${shareableLink}\n\nPedido: ${orderData.orderNumber || printJobId}\n\nAtenciosamente,\nCopinet Serviços Digitais`);
        const emailUrl = `mailto:?subject=${subject}&body=${body}`;
        
        await Linking.openURL(emailUrl);
      }
    } catch (error) {
      console.error('OrderSuccessScreen: Error sharing via Email:', error);
      alert('Erro ao compartilhar via Email. Por favor, tente novamente.');
    }
  };

  const handleShare = async () => {
    if (!orderData) return;

    try {
      const message = `Pedido #${orderData.orderNumber}\n\n` +
        `Serviço: ${orderData.serviceName}\n` +
        `Local: ${orderData.partnerName}\n` +
        `Endereço: ${orderData.partnerAddress}\n` +
        `Horário Estimado: ${orderData.estimatedReadyTime}\n\n` +
        `Apresente este código QR ao retirar: ${orderData.qrCode}`;

      await Share.share({
        message,
      });
    } catch (error) {
      console.error('OrderSuccessScreen: Error sharing:', error);
    }
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleViewOrders = () => {
    router.replace('/(tabs)/orders');
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            title: 'Processando',
            headerShown: true,
          }}
        />
        <View style={[commonStyles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={styles.loadingText}>Processando seu pedido...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderData) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            title: 'Erro',
            headerShown: true,
          }}
        />
        <View style={[commonStyles.container, styles.errorContainer]}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill" 
            android_material_icon_name="error" 
            size={80} 
            color={colors.error} 
          />
          <Text style={styles.errorTitle}>Erro ao Carregar Pedido</Text>
          <Text style={styles.errorText}>
            Não foi possível carregar os detalhes do pedido. Tente novamente mais tarde.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleGoHome}>
            <Text style={styles.buttonText}>Voltar para Início</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const orderNumberText = orderData.orderNumber || 'N/A';
  const serviceNameText = orderData.serviceName || 'Serviço';
  const partnerNameText = orderData.partnerName || 'Parceiro';
  const partnerAddressText = orderData.partnerAddress || 'Endereço não disponível';
  const estimatedReadyTimeText = orderData.estimatedReadyTime || 'A calcular';
  const qrCodeText = orderData.qrCode || '';
  const isScanToPDF = serviceType === 'scan_to_pdf' || orderData.serviceType === 'scan_to_pdf';
  const hasPDF = isScanToPDF && orderData.pdfUrl;

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: isScanToPDF ? 'PDF Pronto!' : 'Pedido Confirmado',
          headerShown: true,
          headerLeft: () => null,
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.successHeader}>
            <View style={styles.successIconContainer}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={100} 
                color={colors.success} 
              />
            </View>
            <Text style={styles.successTitle}>
              {isScanToPDF ? 'PDF Gerado com Sucesso!' : 'Impressão Enviada!'}
            </Text>
            <Text style={styles.successSubtitle}>
              {isScanToPDF 
                ? 'Seu documento foi escaneado e convertido para PDF. Faça o download ou compartilhe agora!'
                : 'Seu pedido foi confirmado e enviado para impressão.'}
            </Text>
          </View>

          {hasPDF && (
            <View style={styles.pdfCard}>
              <View style={styles.pdfCardHeader}>
                <IconSymbol 
                  ios_icon_name="doc.fill" 
                  android_material_icon_name="description" 
                  size={48} 
                  color={colors.secondary} 
                />
                <View style={styles.pdfCardInfo}>
                  <Text style={styles.pdfCardTitle}>Seu PDF está pronto!</Text>
                  <Text style={styles.pdfCardSubtitle}>Arquivo digital disponível para download</Text>
                </View>
              </View>

              <View style={styles.pdfActions}>
                <TouchableOpacity 
                  style={styles.pdfActionButton}
                  onPress={handleDownloadPDF}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <IconSymbol 
                        ios_icon_name="arrow.down.circle.fill" 
                        android_material_icon_name="download" 
                        size={24} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.pdfActionButtonText}>Baixar PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.shareSection}>
                <Text style={styles.shareSectionTitle}>Compartilhar via:</Text>
                <View style={styles.shareButtons}>
                  <TouchableOpacity 
                    style={styles.shareButton}
                    onPress={handleShareWhatsApp}
                  >
                    <View style={[styles.shareButtonIcon, { backgroundColor: '#25D366' }]}>
                      <IconSymbol 
                        ios_icon_name="message.fill" 
                        android_material_icon_name="chat" 
                        size={24} 
                        color="#FFFFFF" 
                      />
                    </View>
                    <Text style={styles.shareButtonText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.shareButton}
                    onPress={handleShareEmail}
                  >
                    <View style={[styles.shareButtonIcon, { backgroundColor: '#EA4335' }]}>
                      <IconSymbol 
                        ios_icon_name="envelope.fill" 
                        android_material_icon_name="email" 
                        size={24} 
                        color="#FFFFFF" 
                      />
                    </View>
                    <Text style={styles.shareButtonText}>Email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {!isScanToPDF && (
            <>
              <View style={styles.qrCodeCard}>
                <Text style={styles.qrCodeTitle}>Código QR do Pedido</Text>
                <View style={styles.qrCodePlaceholder}>
                  <IconSymbol 
                    ios_icon_name="qrcode" 
                    android_material_icon_name="qr-code" 
                    size={200} 
                    color={colors.secondary} 
                  />
                  <Text style={styles.qrCodeText}>{qrCodeText}</Text>
                </View>
                <Text style={styles.qrCodeSubtext}>
                  Apresente este código ao retirar sua impressão
                </Text>
              </View>

              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <IconSymbol 
                    ios_icon_name="number" 
                    android_material_icon_name="tag" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Número do Pedido</Text>
                    <Text style={styles.detailValue}>{orderNumberText}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <IconSymbol 
                    ios_icon_name="printer.fill" 
                    android_material_icon_name="print" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Serviço</Text>
                    <Text style={styles.detailValue}>{serviceNameText}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <IconSymbol 
                    ios_icon_name="building.2.fill" 
                    android_material_icon_name="store" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Local de Retirada</Text>
                    <Text style={styles.detailValue}>{partnerNameText}</Text>
                    <Text style={styles.detailAddress}>{partnerAddressText}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <IconSymbol 
                    ios_icon_name="clock.fill" 
                    android_material_icon_name="schedule" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Horário Estimado</Text>
                    <Text style={styles.detailValue}>{estimatedReadyTimeText}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoCard}>
                <IconSymbol 
                  ios_icon_name="info.circle.fill" 
                  android_material_icon_name="info" 
                  size={24} 
                  color={colors.accent} 
                />
                <Text style={styles.infoText}>
                  Você receberá uma notificação quando sua impressão estiver pronta para retirada. 
                  Não esqueça de levar um documento de identificação.
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.shareButtonAlt} onPress={handleShare}>
                  <IconSymbol 
                    ios_icon_name="square.and.arrow.up" 
                    android_material_icon_name="share" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <Text style={styles.shareButtonAltText}>Compartilhar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.ordersButton} onPress={handleViewOrders}>
                  <IconSymbol 
                    ios_icon_name="list.bullet" 
                    android_material_icon_name="list" 
                    size={24} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.ordersButtonText}>Ver Meus Pedidos</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isScanToPDF && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.ordersButton} onPress={handleViewOrders}>
                <IconSymbol 
                  ios_icon_name="list.bullet" 
                  android_material_icon_name="list" 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text style={styles.ordersButtonText}>Ver Meus Pedidos</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Text style={styles.homeButtonText}>Voltar para Início</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  pdfCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  pdfCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  pdfCardInfo: {
    flex: 1,
  },
  pdfCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  pdfCardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pdfActions: {
    marginBottom: 24,
  },
  pdfActionButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  pdfActionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
  shareSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  shareButton: {
    alignItems: 'center',
  },
  shareButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  qrCodeCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  qrCodePlaceholder: {
    width: 250,
    height: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  qrCodeSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    gap: 20,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  detailAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: colors.accent + '20',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  shareButtonAlt: {
    flex: 1,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  shareButtonAltText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  },
  ordersButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  ordersButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  homeButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  button: {
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

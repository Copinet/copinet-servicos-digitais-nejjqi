
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform, Linking } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const orderId = params.orderId as string;
  const isDigitalOnly = params.isDigitalOnly === 'true';

  const loadOrderData = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    try {
      const { authenticatedGet } = await import('@/utils/api');
      const data = await authenticatedGet(`/api/print-jobs/${orderId}`);
      setOrderData(data);
      console.log('OrderSuccessScreen: Order data loaded:', data);
    } catch (error) {
      console.error('OrderSuccessScreen: Error loading order data:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderData();
  }, [loadOrderData]);

  const handleDownload = async () => {
    if (!orderData || !orderData.pdfUrl) {
      console.error('OrderSuccessScreen: No PDF URL available');
      return;
    }

    setDownloading(true);
    try {
      console.log('OrderSuccessScreen: Downloading PDF:', orderData.pdfUrl);
      
      const fileName = orderData.options?.pdfFileName || `Documento_${Date.now()}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(
        orderData.pdfUrl,
        fileUri
      );

      console.log('OrderSuccessScreen: PDF downloaded:', downloadResult.uri);

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Salvar PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        const link = document.createElement('a');
        link.href = orderData.pdfUrl;
        link.download = fileName;
        link.click();
      }
    } catch (error) {
      console.error('OrderSuccessScreen: Error downloading PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!orderData || !orderData.pdfUrl) {
      console.error('OrderSuccessScreen: No PDF URL available');
      return;
    }

    setSharing(true);
    try {
      console.log('OrderSuccessScreen: Sharing PDF:', orderData.pdfUrl);
      
      const fileName = orderData.options?.pdfFileName || `Documento_${Date.now()}.pdf`;
      const message = `Confira o documento: ${fileName}`;
      
      if (Platform.OS === 'web') {
        await Share.share({
          title: fileName,
          message: message,
          url: orderData.pdfUrl,
        });
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        const downloadResult = await FileSystem.downloadAsync(
          orderData.pdfUrl,
          fileUri
        );

        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar PDF',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error) {
      console.error('OrderSuccessScreen: Error sharing PDF:', error);
    } finally {
      setSharing(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!orderData || !orderData.pdfUrl) {
      console.error('OrderSuccessScreen: No PDF URL available');
      return;
    }

    try {
      const fileName = orderData.options?.pdfFileName || `Documento_${Date.now()}.pdf`;
      const message = `Confira o documento: ${fileName}\n${orderData.pdfUrl}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        console.error('OrderSuccessScreen: WhatsApp not installed');
      }
    } catch (error) {
      console.error('OrderSuccessScreen: Error sharing to WhatsApp:', error);
    }
  };

  const handleShareEmail = async () => {
    if (!orderData || !orderData.pdfUrl) {
      console.error('OrderSuccessScreen: No PDF URL available');
      return;
    }

    try {
      const fileName = orderData.options?.pdfFileName || `Documento_${Date.now()}.pdf`;
      const subject = `Documento: ${fileName}`;
      const body = `Confira o documento em anexo:\n\n${orderData.pdfUrl}`;
      const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      await Linking.openURL(emailUrl);
    } catch (error) {
      console.error('OrderSuccessScreen: Error sharing to Email:', error);
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const handleViewOrders = () => {
    router.push('/(tabs)/orders');
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            title: 'Pedido Confirmado',
            headerShown: true,
            headerBackTitle: 'Voltar',
          }}
        />
        <View style={[commonStyles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={styles.loadingText}>Carregando detalhes do pedido...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Pedido Confirmado',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={80} 
                color={colors.success} 
              />
            </View>
            <Text style={styles.successTitle}>Pedido Confirmado!</Text>
            <Text style={styles.successSubtitle}>
              {isDigitalOnly 
                ? 'Seu documento foi processado com sucesso'
                : 'Seu pedido foi enviado para a loja selecionada'}
            </Text>
            {orderId && (
              <View style={styles.orderIdBadge}>
                <Text style={styles.orderIdLabel}>Pedido #</Text>
                <Text style={styles.orderIdValue}>{orderId.slice(0, 8)}</Text>
              </View>
            )}
          </View>

          {isDigitalOnly && orderData && orderData.pdfUrl && (
            <View style={styles.digitalSection}>
              <Text style={styles.sectionTitle}>Seu Documento Está Pronto!</Text>
              <Text style={styles.sectionSubtitle}>
                Faça o download ou compartilhe seu PDF
              </Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={handleDownload}
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
                      <Text style={styles.primaryButtonText}>Baixar PDF</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={handleShare}
                  disabled={sharing}
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : (
                    <>
                      <IconSymbol 
                        ios_icon_name="square.and.arrow.up" 
                        android_material_icon_name="share" 
                        size={24} 
                        color={colors.secondary} 
                      />
                      <Text style={styles.secondaryButtonText}>Compartilhar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.shareOptions}>
                <Text style={styles.shareOptionsTitle}>Compartilhar via:</Text>
                <View style={styles.shareButtons}>
                  <TouchableOpacity 
                    style={styles.shareButton}
                    onPress={handleShareWhatsApp}
                  >
                    <IconSymbol 
                      ios_icon_name="message.fill" 
                      android_material_icon_name="chat" 
                      size={28} 
                      color="#25D366" 
                    />
                    <Text style={styles.shareButtonText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.shareButton}
                    onPress={handleShareEmail}
                  >
                    <IconSymbol 
                      ios_icon_name="envelope.fill" 
                      android_material_icon_name="email" 
                      size={28} 
                      color={colors.secondary} 
                    />
                    <Text style={styles.shareButtonText}>Email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {!isDigitalOnly && (
            <View style={styles.nextStepsCard}>
              <Text style={styles.nextStepsTitle}>Próximos Passos</Text>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Aguarde a Confirmação</Text>
                  <Text style={styles.stepDescription}>
                    A loja irá revisar seu pedido e confirmar em breve
                  </Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Acompanhe o Status</Text>
                  <Text style={styles.stepDescription}>
                    Você receberá notificações sobre o andamento do pedido
                  </Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Retire na Loja</Text>
                  <Text style={styles.stepDescription}>
                    Quando estiver pronto, vá até a loja para retirar
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.navigationButtons}>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={handleViewOrders}
            >
              <IconSymbol 
                ios_icon_name="list.bullet" 
                android_material_icon_name="receipt" 
                size={24} 
                color={colors.secondary} 
              />
              <Text style={styles.navButtonText}>Ver Meus Pedidos</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={handleGoHome}
            >
              <IconSymbol 
                ios_icon_name="house.fill" 
                android_material_icon_name="home" 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>Voltar ao Início</Text>
            </TouchableOpacity>
          </View>
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
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  successCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  orderIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  orderIdLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
    fontFamily: 'monospace',
  },
  digitalSection: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
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
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  shareOptions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 24,
  },
  shareOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  shareButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
    minWidth: 120,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  nextStepsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  nextStepsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  navigationButtons: {
    gap: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  navButtonPrimary: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  navButtonTextPrimary: {
    color: '#FFFFFF',
  },
});

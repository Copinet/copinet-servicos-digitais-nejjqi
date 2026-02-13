
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  // Extract params
  const serviceId = params.serviceId as string;
  const serviceName = params.serviceName as string;
  const totalPrice = params.totalPrice as string;
  const printJobId = params.printJobId as string;

  const handlePayment = async () => {
    console.log('[Payment] Showing simulation modal for testing...');
    setShowSimulationModal(true);
  };

  const handleSimulatePayment = async (approved: boolean) => {
    setShowSimulationModal(false);
    
    if (!approved) {
      setErrorMessage('Pagamento cancelado para teste.');
      setShowErrorModal(true);
      return;
    }

    console.log('[Payment] Simulating payment approval...');
    setLoading(true);

    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('[Payment] Payment simulated successfully');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[Payment] Error simulating payment:', error);
      setErrorMessage(error.message || 'Erro ao processar pagamento. Por favor, tente novamente.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = async () => {
    setShowSuccessModal(false);
    
    try {
      // For scan-to-pdf, we don't need to create an order - just navigate to success with the print job
      const isScanToPDF = serviceId === 'scan_to_pdf' || params.serviceType === 'scan_to_pdf';
      
      if (isScanToPDF) {
        console.log('PaymentScreen: Scan-to-PDF payment approved, navigating to success with PDF');
        router.replace({
          pathname: '/order-success',
          params: {
            orderId: printJobId,
            serviceType: 'scan_to_pdf',
            pdfUrl: params.pdfUrl || '',
          },
        });
        return;
      }
      
      // For other services, create an order
      const { authenticatedPost } = await import('@/utils/api');
      
      const response = await authenticatedPost(`/api/orders/create-from-print-job`, {
        printJobId,
        paymentMethod: 'pix',
        paymentStatus: 'approved',
        partnerId: params.partnerId,
        partnerName: params.partnerName,
        partnerAddress: params.partnerAddress,
      });

      console.log('PaymentScreen: Order created:', response);

      router.replace({
        pathname: '/order-success',
        params: {
          orderId: response.orderId || printJobId,
        },
      });
    } catch (error) {
      console.error('PaymentScreen: Error creating order:', error);
      router.push('/(tabs)/orders');
    }
  };

  const priceValue = parseFloat(totalPrice);
  const formattedPrice = `R$ ${priceValue.toFixed(2)}`;

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Pagamento',
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          {/* Payment Header */}
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="creditcard.fill" 
              android_material_icon_name="payment" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Resumo do Pedido</Text>
          </View>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Serviço:</Text>
              <Text style={styles.summaryValue}>{serviceName}</Text>
            </View>
            
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total a pagar:</Text>
              <Text style={styles.totalValue}>{formattedPrice}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
          
          <View style={styles.paymentMethodCard}>
            <IconSymbol 
              ios_icon_name="qrcode" 
              android_material_icon_name="qr-code" 
              size={40} 
              color={colors.secondary} 
            />
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodTitle}>Pix</Text>
              <Text style={styles.paymentMethodDescription}>
                Pagamento rápido e seguro
              </Text>
            </View>
            <IconSymbol 
              ios_icon_name="checkmark.circle.fill" 
              android_material_icon_name="check-circle" 
              size={28} 
              color={colors.secondary} 
            />
          </View>

          {/* Test Mode Banner */}
          <View style={styles.testBanner}>
            <IconSymbol 
              ios_icon_name="exclamationmark.triangle.fill" 
              android_material_icon_name="warning" 
              size={24} 
              color={colors.accent} 
            />
            <Text style={styles.testBannerText}>
              Modo de Teste: O pagamento será simulado para você testar o fluxo completo
            </Text>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <IconSymbol 
              ios_icon_name="info.circle.fill" 
              android_material_icon_name="info" 
              size={24} 
              color={colors.secondary} 
            />
            <Text style={styles.infoText}>
              Após a confirmação do pagamento, você poderá selecionar a loja ou parceiro mais próximo para retirada.
            </Text>
          </View>

          {/* Payment Button */}
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={handlePayment}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.paymentButtonText}>Simular Pagamento Pix</Text>
                <IconSymbol 
                  ios_icon_name="qrcode" 
                  android_material_icon_name="qr-code" 
                  size={24} 
                  color="#FFFFFF" 
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Simulation Modal */}
      <Modal
        visible={showSimulationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSimulationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.simulationIcon}>
              <IconSymbol 
                ios_icon_name="qrcode" 
                android_material_icon_name="qr-code" 
                size={64} 
                color={colors.secondary} 
              />
            </View>
            <Text style={styles.modalTitle}>Simulação de Pagamento</Text>
            <Text style={styles.modalMessage}>
              Este é um ambiente de teste. Escolha se deseja aprovar ou recusar o pagamento:
            </Text>
            <View style={styles.simulationButtons}>
              <TouchableOpacity
                style={[styles.simulationButton, styles.approveButton]}
                onPress={() => handleSimulatePayment(true)}
              >
                <IconSymbol 
                  ios_icon_name="checkmark.circle.fill" 
                  android_material_icon_name="check-circle" 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text style={styles.simulationButtonText}>Aprovar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.simulationButton, styles.rejectButton]}
                onPress={() => handleSimulatePayment(false)}
              >
                <IconSymbol 
                  ios_icon_name="xmark.circle.fill" 
                  android_material_icon_name="cancel" 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text style={styles.simulationButtonText}>Recusar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={64} 
                color={colors.secondary} 
              />
            </View>
            <Text style={styles.modalTitle}>Pagamento Aprovado!</Text>
            <Text style={styles.modalMessage}>
              Seu pagamento foi processado com sucesso. Agora você pode selecionar onde deseja retirar seu pedido.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.modalButtonText}>Selecionar Loja/Parceiro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.successIcon, { backgroundColor: colors.error + '20' }]}>
              <IconSymbol 
                ios_icon_name="exclamationmark.triangle.fill" 
                android_material_icon_name="error" 
                size={64} 
                color={colors.error} 
              />
            </View>
            <Text style={styles.modalTitle}>Erro</Text>
            <Text style={styles.modalMessage}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.error }]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalButtonText}>Tentar Novamente</Text>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.textSecondary + '30',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.secondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  paymentMethodCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodInfo: {
    flex: 1,
    marginLeft: 16,
  },
  paymentMethodTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  testBanner: {
    backgroundColor: colors.accent + '20',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  testBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.secondary + '15',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.secondary + '40',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  paymentButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentButtonText: {
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
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
  },
  simulationIcon: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  simulationButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  simulationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: colors.secondary,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  simulationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

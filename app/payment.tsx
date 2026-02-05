
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PaymentScreen() {
  const router = useRouter();
  const { serviceId, serviceName, originalPrice, finalPrice, flow, selectedOption, formData } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePayment = async () => {
    console.log('[Payment] Processing payment...');
    setLoading(true);

    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      // Parse formData from string
      const parsedFormData = formData ? JSON.parse(formData as string) : {};
      
      // Create order via API
      const orderData = {
        serviceId: serviceId as string,
        flow: flow as 'fazemos' | 'sozinho',
        selectedOption: selectedOption as 'pdf' | 'pdf_impressao',
        formData: parsedFormData,
        customerData: parsedFormData, // Also send as customerData for backward compatibility
        totalPrice: priceFinal.toString(),
      };
      
      console.log('[Payment] Creating order:', orderData);
      const response = await authenticatedPost('/api/orders', orderData);
      
      console.log('[Payment] Order created successfully:', response);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[Payment] Error creating order:', error);
      // Show error to user
      setErrorMessage(error.message || 'Erro ao criar pedido. Por favor, tente novamente.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    router.push('/(tabs)/orders');
  };

  const priceOriginal = parseFloat(originalPrice as string);
  const priceFinal = parseFloat(finalPrice as string);
  const hasDiscount = priceOriginal !== priceFinal;
  
  const formattedOriginalPrice = `R$ ${priceOriginal.toFixed(2)}`;
  const formattedFinalPrice = `R$ ${priceFinal.toFixed(2)}`;
  const flowText = flow === 'sozinho' ? 'Faça Sozinho' : 'Fazemos pra Você';
  const optionText = selectedOption === 'pdf' ? 'Só PDF' : 'PDF + Impressão';

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
              color={colors.primary} 
            />
            <Text style={styles.headerTitle}>Resumo do Pedido</Text>
          </View>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Serviço:</Text>
              <Text style={styles.summaryValue}>{serviceName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Modalidade:</Text>
              <Text style={styles.summaryValue}>{flowText}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Entrega:</Text>
              <Text style={styles.summaryValue}>{optionText}</Text>
            </View>
            
            {hasDiscount && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Preço original:</Text>
                  <Text style={styles.originalPriceText}>{formattedOriginalPrice}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.discountLabel}>Desconto (20%):</Text>
                  <Text style={styles.discountValue}>
                    - R$ {(priceOriginal - priceFinal).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
            
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total a pagar:</Text>
              <Text style={styles.totalValue}>{formattedFinalPrice}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
          
          <View style={styles.paymentMethodCard}>
            <IconSymbol 
              ios_icon_name="qrcode" 
              android_material_icon_name="qr-code" 
              size={40} 
              color={colors.primary} 
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
              color={colors.primary} 
            />
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <IconSymbol 
              ios_icon_name="info.circle.fill" 
              android_material_icon_name="info" 
              size={24} 
              color={colors.primary} 
            />
            <Text style={styles.infoText}>
              Após a confirmação do pagamento, você receberá uma notificação e poderá acompanhar o status do seu pedido.
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
                <Text style={styles.paymentButtonText}>Gerar Pix</Text>
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
                color={colors.primary} 
              />
            </View>
            <Text style={styles.modalTitle}>Pedido Criado!</Text>
            <Text style={styles.modalMessage}>
              Seu pedido foi criado com sucesso. Aguarde a confirmação do pagamento Pix.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.modalButtonText}>Ver Meus Pedidos</Text>
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
  originalPriceText: {
    fontSize: 15,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  discountLabel: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '600',
  },
  discountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
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
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.primary,
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
  infoCard: {
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  paymentButton: {
    backgroundColor: colors.primary,
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
  modalButton: {
    backgroundColor: colors.primary,
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

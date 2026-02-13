
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

  const serviceId = params.serviceId as string;
  const serviceName = params.serviceName as string;
  const totalPrice = params.totalPrice as string;
  const printJobId = params.printJobId as string;
  const storeId = params.storeId as string;
  const storeName = params.storeName as string;
  const storeAddress = params.storeAddress as string;
  const isDigitalOnly = params.isDigitalOnly === 'true';

  const handlePayment = async () => {
    setLoading(true);
    try {
      console.log('PaymentScreen: Processing payment for:', {
        serviceId,
        serviceName,
        totalPrice,
        printJobId,
        isDigitalOnly,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('PaymentScreen: Payment successful');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('PaymentScreen: Payment error:', error);
      setErrorMessage('Não foi possível processar o pagamento. Tente novamente.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async (approved: boolean) => {
    setLoading(true);
    try {
      console.log('PaymentScreen: Simulating payment:', approved ? 'APPROVED' : 'REJECTED');

      await new Promise(resolve => setTimeout(resolve, 1500));

      if (approved) {
        console.log('PaymentScreen: Payment approved');
        setShowSuccessModal(true);
      } else {
        console.log('PaymentScreen: Payment rejected');
        setErrorMessage('Pagamento recusado. Verifique seus dados e tente novamente.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('PaymentScreen: Simulation error:', error);
      setErrorMessage('Erro ao simular pagamento. Tente novamente.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    router.push({
      pathname: '/order-success',
      params: {
        orderId: printJobId,
        serviceId,
        serviceName,
        totalPrice,
        isDigitalOnly: isDigitalOnly ? 'true' : 'false',
      },
    });
  };

  const priceValue = parseFloat(totalPrice || '0');
  const priceFormatted = priceValue.toFixed(2).replace('.', ',');

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Pagamento',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="creditcard.fill" 
              android_material_icon_name="payment" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Pagamento via Pix</Text>
            <Text style={styles.headerSubtitle}>
              Escaneie o QR Code ou copie o código Pix para pagar
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Serviço:</Text>
              <Text style={styles.summaryValue}>{serviceName}</Text>
            </View>
            {!isDigitalOnly && storeName && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Loja:</Text>
                  <Text style={styles.summaryValue}>{storeName}</Text>
                </View>
                {storeAddress && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Endereço:</Text>
                    <Text style={styles.summaryValue}>{storeAddress}</Text>
                  </View>
                )}
              </>
            )}
            {isDigitalOnly && (
              <View style={styles.digitalBadge}>
                <IconSymbol 
                  ios_icon_name="doc.fill" 
                  android_material_icon_name="description" 
                  size={20} 
                  color={colors.secondary} 
                />
                <Text style={styles.digitalBadgeText}>Documento Digital - Sem Retirada</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total:</Text>
              <Text style={styles.summaryTotalValue}>R$ {priceFormatted}</Text>
            </View>
          </View>

          <View style={styles.pixCard}>
            <View style={styles.qrCodePlaceholder}>
              <IconSymbol 
                ios_icon_name="qrcode" 
                android_material_icon_name="qr-code" 
                size={120} 
                color={colors.textSecondary} 
              />
              <Text style={styles.qrCodeText}>QR Code Pix</Text>
            </View>

            <View style={styles.pixCodeContainer}>
              <Text style={styles.pixCodeLabel}>Código Pix:</Text>
              <View style={styles.pixCodeBox}>
                <Text style={styles.pixCodeText}>00020126580014BR.GOV.BCB.PIX...</Text>
              </View>
              <TouchableOpacity style={styles.copyButton}>
                <IconSymbol 
                  ios_icon_name="doc.on.doc" 
                  android_material_icon_name="content-copy" 
                  size={20} 
                  color={colors.secondary} 
                />
                <Text style={styles.copyButtonText}>Copiar Código</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>Como Pagar</Text>
            <View style={styles.instructionItem}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>1</Text>
              </View>
              <Text style={styles.instructionText}>
                Abra o app do seu banco e escolha pagar com Pix
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>2</Text>
              </View>
              <Text style={styles.instructionText}>
                Escaneie o QR Code ou cole o código Pix
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>3</Text>
              </View>
              <Text style={styles.instructionText}>
                Confirme o pagamento e aguarde a confirmação
              </Text>
            </View>
          </View>

          <View style={styles.simulationCard}>
            <Text style={styles.simulationTitle}>Simulação de Pagamento</Text>
            <Text style={styles.simulationSubtitle}>
              Para testes, use os botões abaixo
            </Text>
            <View style={styles.simulationButtons}>
              <TouchableOpacity 
                style={[styles.simulationButton, styles.simulationButtonApprove]}
                onPress={() => handleSimulatePayment(true)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol 
                      ios_icon_name="checkmark.circle.fill" 
                      android_material_icon_name="check-circle" 
                      size={24} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.simulationButtonText}>Aprovar</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.simulationButton, styles.simulationButtonReject]}
                onPress={() => handleSimulatePayment(false)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol 
                      ios_icon_name="xmark.circle.fill" 
                      android_material_icon_name="cancel" 
                      size={24} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.simulationButtonText}>Recusar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol 
              ios_icon_name="checkmark.circle.fill" 
              android_material_icon_name="check-circle" 
              size={64} 
              color={colors.success} 
            />
            <Text style={styles.modalTitle}>Pagamento Confirmado!</Text>
            <Text style={styles.modalMessage}>
              {isDigitalOnly 
                ? 'Seu documento está sendo processado e estará disponível em instantes.'
                : 'Seu pedido foi confirmado e enviado para a loja.'}
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.modalButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol 
              ios_icon_name="exclamationmark.circle.fill" 
              android_material_icon_name="error" 
              size={64} 
              color={colors.error} 
            />
            <Text style={styles.modalTitle}>Erro no Pagamento</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonError]}
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
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
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  digitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  digitalBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
    flex: 1,
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
  pixCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.background,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  qrCodeText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  pixCodeContainer: {
    width: '100%',
  },
  pixCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  pixCodeBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pixCodeText: {
    fontSize: 13,
    color: colors.text,
    fontFamily: 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.secondary,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  },
  instructionsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  simulationCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
  },
  simulationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  simulationSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  simulationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  simulationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },
  simulationButtonApprove: {
    backgroundColor: colors.success,
  },
  simulationButtonReject: {
    backgroundColor: colors.error,
  },
  simulationButtonText: {
    fontSize: 16,
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
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonError: {
    backgroundColor: colors.error,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

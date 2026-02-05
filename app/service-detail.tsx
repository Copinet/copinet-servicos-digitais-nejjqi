
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

export default function ServiceDetailScreen() {
  const router = useRouter();
  const { serviceId } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<'fazemos' | 'sozinho' | null>(null);
  const [selectedOption, setSelectedOption] = useState<'pdf' | 'pdf_impressao'>('pdf');
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    try {
      console.log('[ServiceDetail] Loading service:', serviceId);
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet(`/api/services/${serviceId}`);
      
      const serviceData = {
        ...data,
        price: parseFloat(data.price),
        type: data.type || 'fazemos_pra_voce',
      };
      
      setService(serviceData);
      console.log('[ServiceDetail] Service loaded:', serviceData);
    } catch (error) {
      console.error('[ServiceDetail] Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!selectedFlow) {
      return;
    }

    console.log('[ServiceDetail] Continuing with flow:', selectedFlow);
    
    if (selectedFlow === 'sozinho') {
      router.push({
        pathname: '/faca-sozinho-form',
        params: { 
          serviceId: service.id,
          serviceName: service.name,
          servicePrice: service.price.toString(),
          selectedOption
        }
      });
    } else {
      router.push({
        pathname: '/fazemos-pra-voce-form',
        params: { 
          serviceId: service.id,
          serviceName: service.name,
          servicePrice: service.price.toString(),
          selectedOption
        }
      });
    }
  };

  const handleLoginPress = () => {
    setShowLoginModal(false);
    router.push('/auth');
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Serviço não encontrado</Text>
      </View>
    );
  }

  const serviceName = service.name;
  const serviceDescription = service.description || 'Serviço de qualidade com entrega rápida';
  const servicePrice = service.price;
  const serviceType = service.type;
  
  const canDoSozinho = serviceType === 'faca_sozinho' || serviceType === 'both';
  const canDoFazemos = serviceType === 'fazemos_pra_voce' || serviceType === 'both';
  
  const discountedPrice = servicePrice * 0.8;
  const formattedPrice = `R$ ${servicePrice.toFixed(2)}`;
  const formattedDiscountedPrice = `R$ ${discountedPrice.toFixed(2)}`;

  const currentPrice = selectedFlow === 'sozinho' ? discountedPrice : servicePrice;
  const formattedCurrentPrice = `R$ ${currentPrice.toFixed(2)}`;

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: serviceName,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          {/* Service Header */}
          <View style={styles.serviceHeader}>
            <View style={styles.serviceIcon}>
              <IconSymbol 
                ios_icon_name="doc.text.fill" 
                android_material_icon_name="description" 
                size={48} 
                color={colors.secondary} 
              />
            </View>
            <Text style={styles.serviceName}>{serviceName}</Text>
            <Text style={styles.serviceDescription}>{serviceDescription}</Text>
          </View>

          {/* Flow Selection */}
          <Text style={styles.sectionTitle}>Escolha como prefere fazer</Text>

          {canDoFazemos && (
            <TouchableOpacity
              style={[
                styles.flowCard,
                selectedFlow === 'fazemos' && styles.flowCardSelected
              ]}
              onPress={() => setSelectedFlow('fazemos')}
            >
              <View style={styles.flowCardHeader}>
                <View style={styles.flowIconContainer}>
                  <IconSymbol 
                    ios_icon_name="hand.raised.fill" 
                    android_material_icon_name="pan-tool" 
                    size={32} 
                    color={colors.secondary} 
                  />
                </View>
                <View style={styles.flowCardInfo}>
                  <Text style={styles.flowCardTitle}>Fazemos pra Você</Text>
                  <Text style={styles.flowCardDescription}>
                    Nossos parceiros cuidam de tudo
                  </Text>
                </View>
                {selectedFlow === 'fazemos' && (
                  <IconSymbol 
                    ios_icon_name="checkmark.circle.fill" 
                    android_material_icon_name="check-circle" 
                    size={28} 
                    color={colors.primary} 
                  />
                )}
              </View>
              <Text style={styles.flowCardPrice}>{formattedPrice}</Text>
            </TouchableOpacity>
          )}

          {canDoSozinho && (
            <TouchableOpacity
              style={[
                styles.flowCard,
                selectedFlow === 'sozinho' && styles.flowCardSelected
              ]}
              onPress={() => setSelectedFlow('sozinho')}
            >
              <View style={styles.flowCardHeader}>
                <View style={[styles.flowIconContainer, { backgroundColor: colors.accent + '20' }]}>
                  <IconSymbol 
                    ios_icon_name="person.fill" 
                    android_material_icon_name="person" 
                    size={32} 
                    color={colors.accent} 
                  />
                </View>
                <View style={styles.flowCardInfo}>
                  <Text style={styles.flowCardTitle}>Faça Sozinho</Text>
                  <Text style={styles.flowCardDescription}>
                    Economize 20% fazendo você mesmo
                  </Text>
                </View>
                {selectedFlow === 'sozinho' && (
                  <IconSymbol 
                    ios_icon_name="checkmark.circle.fill" 
                    android_material_icon_name="check-circle" 
                    size={28} 
                    color={colors.primary} 
                  />
                )}
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.originalPrice}>{formattedPrice}</Text>
                <Text style={styles.discountedPrice}>{formattedDiscountedPrice}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-20%</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Delivery Option */}
          {selectedFlow && (
            <>
              <Text style={styles.sectionTitle}>Como deseja receber?</Text>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedOption === 'pdf' && styles.optionCardSelected
                ]}
                onPress={() => setSelectedOption('pdf')}
              >
                <View style={styles.optionCardContent}>
                  <IconSymbol 
                    ios_icon_name="doc.fill" 
                    android_material_icon_name="description" 
                    size={24} 
                    color={colors.primary} 
                  />
                  <View style={styles.optionCardInfo}>
                    <Text style={styles.optionCardTitle}>Só PDF</Text>
                    <Text style={styles.optionCardDescription}>
                      Receba o documento digital no app
                    </Text>
                  </View>
                  {selectedOption === 'pdf' && (
                    <IconSymbol 
                      ios_icon_name="checkmark.circle.fill" 
                      android_material_icon_name="check-circle" 
                      size={24} 
                      color={colors.primary} 
                    />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedOption === 'pdf_impressao' && styles.optionCardSelected
                ]}
                onPress={() => setSelectedOption('pdf_impressao')}
              >
                <View style={styles.optionCardContent}>
                  <IconSymbol 
                    ios_icon_name="printer.fill" 
                    android_material_icon_name="print" 
                    size={24} 
                    color={colors.primary} 
                  />
                  <View style={styles.optionCardInfo}>
                    <Text style={styles.optionCardTitle}>PDF + Impressão</Text>
                    <Text style={styles.optionCardDescription}>
                      Receba digital e retire impresso
                    </Text>
                  </View>
                  {selectedOption === 'pdf_impressao' && (
                    <IconSymbol 
                      ios_icon_name="checkmark.circle.fill" 
                      android_material_icon_name="check-circle" 
                      size={24} 
                      color={colors.primary} 
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* Price Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Resumo</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Serviço:</Text>
                  <Text style={styles.summaryValue}>{serviceName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Modalidade:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedFlow === 'sozinho' ? 'Faça Sozinho' : 'Fazemos pra Você'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Entrega:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedOption === 'pdf' ? 'Só PDF' : 'PDF + Impressão'}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Total:</Text>
                  <Text style={styles.summaryTotalValue}>{formattedCurrentPrice}</Text>
                </View>
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinue}
              >
                <Text style={styles.continueButtonText}>Continuar</Text>
                <IconSymbol 
                  ios_icon_name="arrow.right" 
                  android_material_icon_name="arrow-forward" 
                  size={24} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Login Required Modal */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Login Necessário</Text>
            <Text style={styles.modalMessage}>
              Você precisa estar logado para continuar com o pedido.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowLoginModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleLoginPress}
              >
                <Text style={styles.modalButtonPrimaryText}>Fazer Login</Text>
              </TouchableOpacity>
            </View>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  serviceHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  serviceIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  serviceName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    marginTop: 8,
  },
  flowCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  flowCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  flowCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  flowIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  flowCardInfo: {
    flex: 1,
  },
  flowCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  flowCardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  flowCardPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.secondary,
    textAlign: 'right',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  originalPrice: {
    fontSize: 16,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
  },
  discountBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  optionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCardInfo: {
    flex: 1,
  },
  optionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionCardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
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
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.textSecondary + '30',
    marginVertical: 12,
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
    fontSize: 22,
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

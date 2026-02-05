
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('HomeScreen: Loading services, user:', user);
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      console.log('[HomeScreen] Fetching services from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/services');
      
      // Filter to show most used services: Impressão rápida, Digitalização, Foto 3x4, Currículo
      const mostUsedServices = data.filter((service: any) => 
        ['Impressão Rápida', 'Digitalização de Documento em PDF', 'Foto 3x4', 'Currículo'].includes(service.name)
      );
      
      setServices(mostUsedServices);
      console.log('[HomeScreen] Services loaded successfully:', mostUsedServices.length);
    } catch (error) {
      console.error('[HomeScreen] Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServicePress = (service: any) => {
    console.log('[HomeScreen] Service pressed:', service.name);
    router.push('/(tabs)/services');
  };

  const handleOrdersPress = () => {
    console.log('HomeScreen: Orders button pressed');
    router.push('/(tabs)/orders');
  };

  const handleLoginPress = () => {
    console.log('HomeScreen: Login button pressed');
    router.push('/auth');
  };

  if (authLoading || loading) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          {/* App Name */}
          <Text style={styles.appName}>COPINET SERVIÇOS DIGITAIS</Text>

          {/* Welcome Card */}
          <View style={styles.welcomeCard}>
            <IconSymbol 
              ios_icon_name="sparkles" 
              android_material_icon_name="star" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.welcomeTitle}>Bem-vindo!</Text>
            <Text style={styles.welcomeText}>
              Sua central de serviços digitais e documentos
            </Text>
          </View>

          {/* Login Button - Only show if user is NOT logged in */}
          {!user && (
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={handleLoginPress}
            >
              <IconSymbol 
                ios_icon_name="person.circle" 
                android_material_icon_name="account-circle" 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={styles.loginButtonText}>
                Entrar ou Cadastrar
              </Text>
            </TouchableOpacity>
          )}

          {/* Como Funciona Section */}
          <View style={styles.howItWorksCard}>
            <Text style={styles.howItWorksTitle}>Como Funciona</Text>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Escolha o serviço</Text>
                <Text style={styles.stepDescription}>
                  Navegue pelo catálogo e selecione o que você precisa
                </Text>
              </View>
            </View>

            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Faça o pedido</Text>
                <Text style={styles.stepDescription}>
                  Escolha a loja mais próxima para retirada
                </Text>
              </View>
            </View>

            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Pague com Pix</Text>
                <Text style={styles.stepDescription}>
                  Pagamento rápido e seguro, sem precisar de cartão
                </Text>
              </View>
            </View>

            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Retire onde escolheu</Text>
                <Text style={styles.stepDescription}>
                  Ou receba o seu documento em PDF aqui mesmo. Você receberá uma notificação quando estiver pronto
                </Text>
              </View>
            </View>
          </View>

          {/* Service Flow Options */}
          <View style={styles.flowOptionsCard}>
            <Text style={styles.flowOptionsTitle}>Escolha como prefere</Text>
            
            <View style={styles.flowOption}>
              <IconSymbol 
                ios_icon_name="hand.raised.fill" 
                android_material_icon_name="pan-tool" 
                size={32} 
                color={colors.secondary} 
              />
              <View style={styles.flowOptionContent}>
                <Text style={styles.flowOptionTitle}>Fazemos pra Você</Text>
                <Text style={styles.flowOptionDescription}>
                  Nossos parceiros cuidam de tudo para você
                </Text>
              </View>
            </View>

            <View style={styles.flowOption}>
              <IconSymbol 
                ios_icon_name="person.fill" 
                android_material_icon_name="person" 
                size={32} 
                color={colors.accent} 
              />
              <View style={styles.flowOptionContent}>
                <Text style={styles.flowOptionTitle}>Faça Sozinho</Text>
                <Text style={styles.flowOptionDescription}>
                  20% de desconto em serviços selecionados
                </Text>
              </View>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-20%</Text>
              </View>
            </View>
          </View>

          {/* Most Used Services */}
          <Text style={styles.sectionTitle}>Serviços Mais Usados</Text>

          {services.map((service, index) => {
            const serviceName = service.name;
            const servicePrice = service.price;
            const formattedPrice = `R$ ${servicePrice.toFixed(2)}`;
            
            return (
              <TouchableOpacity
                key={index}
                style={styles.serviceCard}
                onPress={() => handleServicePress(service)}
              >
                <View style={styles.serviceHeader}>
                  <IconSymbol 
                    ios_icon_name="doc.text.fill" 
                    android_material_icon_name="description" 
                    size={40} 
                    color={colors.secondary} 
                  />
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{serviceName}</Text>
                    <Text style={styles.servicePrice}>{formattedPrice}</Text>
                  </View>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={24} 
                    color={colors.textSecondary} 
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* View All Orders Button */}
          <TouchableOpacity 
            style={styles.ordersButton}
            onPress={handleOrdersPress}
          >
            <IconSymbol 
              ios_icon_name="receipt.fill" 
              android_material_icon_name="receipt" 
              size={24} 
              color="#FFFFFF" 
            />
            <Text style={styles.ordersButtonText}>
              Todos os Pedidos
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  welcomeCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  howItWorksCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  howItWorksTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  flowOptionsCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  flowOptionsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  flowOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  flowOptionContent: {
    flex: 1,
    marginLeft: 16,
  },
  flowOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  flowOptionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  discountBadge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  discountBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  ordersButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ordersButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});


import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
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
    console.log('HomeScreen: Loading services, user authenticated:', !!user);
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      console.log('[HomeScreen] Fetching services from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/services');
      
      const servicesWithType = data.map((service: any) => ({
        ...service,
        price: parseFloat(service.price),
        type: service.type || 'fazemos_pra_voce',
      }));
      
      setServices(servicesWithType);
      console.log('[HomeScreen] Services loaded successfully:', servicesWithType.length);
    } catch (error) {
      console.error('[HomeScreen] Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServicePress = (service: any) => {
    console.log('[HomeScreen] Service pressed:', service.name);
    router.push({
      pathname: '/service-detail',
      params: { serviceId: service.id }
    });
  };

  const handleOrdersPress = () => {
    console.log('HomeScreen: Orders button pressed');
    router.push('/(tabs)/orders');
  };

  const handleLoginPress = () => {
    console.log('HomeScreen: Login button pressed');
    router.push('/auth');
  };

  const handleStoresMapPress = () => {
    console.log('HomeScreen: Stores map button pressed');
    router.push('/stores-map');
  };

  const handleNotificationsPress = () => {
    console.log('HomeScreen: Notifications button pressed');
    // TODO: Navigate to notifications screen when implemented
  };

  if (authLoading || loading) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  // Define the specific services for "Serviços Mais Acessados"
  const mostAccessedServiceNames = [
    'Impressão',
    'Currículo',
    'Certidões',
    'Escanear / Digitalizar PDF',
    'Foto 3x4',
    'Situação CPF'
  ];

  const mostAccessedServices = mostAccessedServiceNames.map(name => {
    const found = services.find(s => s.name.includes(name.split(' ')[0]));
    return found || { id: name, name, price: 0 };
  });

  const userName = user?.name || 'Visitante';

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

          {/* Login Button - Only show if user is NOT logged in */}
          {!user && (
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={handleLoginPress}
            >
              <Text style={styles.loginButtonText}>Entrar / Cadastre-se</Text>
            </TouchableOpacity>
          )}

          {/* Welcome Card with Notification Bell */}
          {user && (
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeGreeting}>Bem-vindo(a)</Text>
              <Text style={styles.welcomeUser}>{userName}</Text>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={handleNotificationsPress}
              >
                <IconSymbol 
                  ios_icon_name="bell.fill" 
                  android_material_icon_name="notifications" 
                  size={24} 
                  color={colors.secondary} 
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Nossas Lojas Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nossas Lojas</Text>
          </View>

          <View style={styles.storesContainer}>
            <View style={styles.storeCard}>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>Copinet Centro</Text>
                <Text style={styles.storeAddress}>Rua XV de Novembro, 123</Text>
                <Text style={styles.storeAddress}>Centro - Cubatão/SP</Text>
              </View>
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={handleStoresMapPress}
              >
                <IconSymbol 
                  ios_icon_name="map.fill" 
                  android_material_icon_name="map" 
                  size={20} 
                  color="#FFFFFF" 
                />
                <Text style={styles.mapButtonText}>Mapa</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.storeCard}>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>Copinet Jardim</Text>
                <Text style={styles.storeAddress}>Av. 9 de Abril, 456</Text>
                <Text style={styles.storeAddress}>Jardim Casqueiro - Cubatão/SP</Text>
              </View>
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={handleStoresMapPress}
              >
                <IconSymbol 
                  ios_icon_name="map.fill" 
                  android_material_icon_name="map" 
                  size={20} 
                  color="#FFFFFF" 
                />
                <Text style={styles.mapButtonText}>Mapa</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Serviços Mais Acessados */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Serviços Mais Acessados</Text>
          </View>

          <View style={styles.quickServicesGrid}>
            {mostAccessedServices.map((service, index) => {
              const serviceName = service.name;
              let iconName = 'description';
              
              if (serviceName.includes('Impressão')) iconName = 'print';
              else if (serviceName.includes('Currículo')) iconName = 'work';
              else if (serviceName.includes('Certidões')) iconName = 'description';
              else if (serviceName.includes('Escanear') || serviceName.includes('Digitalizar')) iconName = 'scanner';
              else if (serviceName.includes('Foto')) iconName = 'camera';
              else if (serviceName.includes('CPF') || serviceName.includes('Situação')) iconName = 'badge';

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.quickServiceCard}
                  onPress={() => service.id && handleServicePress(service)}
                >
                  <View style={styles.quickServiceIcon}>
                    <IconSymbol 
                      ios_icon_name="doc.fill" 
                      android_material_icon_name={iconName} 
                      size={32} 
                      color="#FFFFFF" 
                    />
                  </View>
                  <Text style={styles.quickServiceName}>{serviceName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fazemos pra Você Section - ONLY EXPLANATION */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fazemos pra Você</Text>
          </View>

          <View style={styles.explanationCard}>
            <View style={styles.explanationIcon}>
              <IconSymbol 
                ios_icon_name="hand.raised.fill" 
                android_material_icon_name="pan-tool" 
                size={40} 
                color={colors.secondary} 
              />
            </View>
            <Text style={styles.explanationTitle}>Nossa equipe faz para você</Text>
            <Text style={styles.explanationText}>
              Nesta modalidade, nossa equipe especializada cuida de tudo para você. 
              Basta nos fornecer os dados necessários e nós emitimos seus documentos, 
              certidões e serviços em sites oficiais. Você recebe tudo pronto!
            </Text>
          </View>

          {/* Faça Sozinho Section - ONLY EXPLANATION */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Faça Sozinho</Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>20% OFF</Text>
            </View>
          </View>

          <View style={styles.explanationCard}>
            <View style={[styles.explanationIcon, { backgroundColor: colors.accent + '20' }]}>
              <IconSymbol 
                ios_icon_name="person.fill" 
                android_material_icon_name="person" 
                size={40} 
                color={colors.accent} 
              />
            </View>
            <Text style={styles.explanationTitle}>Nós te guiamos e ajudamos</Text>
            <Text style={styles.explanationText}>
              Prefere fazer você mesmo? Sem problema! Nós te guiamos passo a passo 
              e fornecemos todas as ferramentas necessárias. Você faz sozinho com 
              nossa ajuda e ainda ganha 20% de desconto!
            </Text>
          </View>

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
                <Text style={styles.stepTitle}>Retire onde escolheu / Receba em PDF</Text>
                <Text style={styles.stepDescription}>
                  Você receberá uma notificação quando estiver pronto
                </Text>
              </View>
            </View>
          </View>

          {/* Todos os Pedidos Button */}
          <TouchableOpacity 
            style={styles.ordersButton}
            onPress={handleOrdersPress}
          >
            <IconSymbol 
              ios_icon_name="list.bullet" 
              android_material_icon_name="list" 
              size={24} 
              color="#FFFFFF" 
            />
            <Text style={styles.ordersButtonText}>Ver Todos os Pedidos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  loginButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  welcomeCard: {
    backgroundColor: colors.secondary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    position: 'relative',
  },
  welcomeGreeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  welcomeUser: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  notificationButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  storesContainer: {
    gap: 12,
    marginBottom: 8,
  },
  storeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  mapButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  quickServiceCard: {
    width: '31%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickServiceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickServiceName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  explanationCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  explanationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  explanationText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  discountBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  discountBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  howItWorksCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  howItWorksTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  ordersButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  ordersButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

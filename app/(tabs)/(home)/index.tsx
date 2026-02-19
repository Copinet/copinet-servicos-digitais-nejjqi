import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Animated, Dimensions, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadServices = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    console.log('HomeScreen: Loading services, user authenticated:', !!user);
    loadServices();
  }, [loadServices, user]);

  const handleServicePress = (serviceName: string) => {
    console.log('[HomeScreen] Service pressed:', serviceName);

    if (serviceName === 'Impressão Rápida') {
      router.push('/quick-print');
    } else if (serviceName === 'Impressão de Fotos') {
      router.push('/photo-print');
    } else if (serviceName === 'Foto 3x4') {
      router.push('/photo-3x4');
    } else if (serviceName.includes('Escanear') || serviceName.includes('Digitalizar')) {
      router.push('/scan-to-pdf');
    } else {
      const service = services.find(s => s.name.includes(serviceName.split(' ')[0]));
      if (service) {
        router.push({
          pathname: '/service-detail',
          params: { serviceId: service.id }
        });
      }
    }
  };

  const handleOrdersPress = () => {
    console.log('HomeScreen: Orders button pressed');
    router.push('/(tabs)/orders');
  };

  const handleAllServicesPress = () => {
    console.log('HomeScreen: All services button pressed');
    router.push('/(tabs)/services');
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
  };

  if (authLoading || loading) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  const mostAccessedServiceNames = [
    'Impressão Rápida',
    'Impressão de Fotos',
    'Foto 3x4',
    'Escanear / Digitalizar PDF',
    'Currículo',
    'Certidões'
  ];

  const userName = user?.name || 'Visitante';

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background with Gradient and Decorative Elements */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[colors.background, '#1A1A1A', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
      </View>

      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={commonStyles.section}>
            <View style={styles.header}>
              <Text style={styles.appName}>COPINET</Text>
              <Text style={styles.appSubtitle}>SERVIÇOS DIGITAIS</Text>
            </View>

            {!user && (
              <TouchableOpacity
                style={commonStyles.largeButton}
                onPress={handleLoginPress}
              >
                <Text style={commonStyles.largeButtonText}>Entrar / Cadastre-se</Text>
              </TouchableOpacity>
            )}

            {user && (
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.2)', 'rgba(0,0,0,0.6)']}
                style={styles.welcomeCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.welcomeInfo}>
                  <Text style={styles.welcomeGreeting}>Bem-vindo(a),</Text>
                  <Text style={styles.welcomeUser}>{userName}</Text>
                </View>
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
                  <View style={styles.notificationBadge} />
                </TouchableOpacity>
              </LinearGradient>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nossas Lojas</Text>
            </View>

            <View style={styles.storesContainer}>
              <BlurView intensity={20} tint="dark" style={styles.storeCardWrapper}>
                <View style={styles.storeCard}>
                  <IconSymbol ios_icon_name="mappin.circle.fill" android_material_icon_name="store" size={40} color={colors.secondary} style={{ marginRight: 12 }} />
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>Unidade Centro</Text>
                    <Text style={styles.storeAddress}>Rua XV de Novembro, 123</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={handleStoresMapPress}
                  >
                    <IconSymbol ios_icon_name="map.fill" android_material_icon_name="map" size={18} color="#000" />
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Serviços Rápidos</Text>
              <TouchableOpacity onPress={handleAllServicesPress}>
                <Text style={styles.seeAllText}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickServicesGrid}>
              {mostAccessedServiceNames.map((serviceName, index) => {
                let iconName = 'description';
                let iconColor = colors.text;

                if (serviceName.includes('Impressão Rápida')) { iconName = 'print'; iconColor = colors.secondary; }
                else if (serviceName.includes('Currículo')) iconName = 'work';
                else if (serviceName.includes('Certidões')) iconName = 'description';
                else if (serviceName.includes('Escanear') || serviceName.includes('Digitalizar')) iconName = 'scanner';
                else if (serviceName.includes('Foto')) { iconName = 'camera'; iconColor = colors.secondary; }
                else if (serviceName.includes('CPF')) iconName = 'badge';

                const isFeatured = index < 2;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.quickServiceCard, isFeatured && styles.featuredServiceCard]}
                    onPress={() => handleServicePress(serviceName)}
                  >
                    <BlurView intensity={isFeatured ? 40 : 15} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.serviceContent}>
                      <View style={[styles.quickServiceIcon, isFeatured && { backgroundColor: 'rgba(212, 175, 55, 0.2)' }]}>
                        <IconSymbol
                          ios_icon_name={serviceName.includes('Foto') ? "camera.fill" : "doc.fill"}
                          android_material_icon_name={iconName as any}
                          size={isFeatured ? 32 : 28}
                          color={iconColor}
                        />
                      </View>
                      <Text style={[styles.quickServiceName, isFeatured && { fontSize: 13, fontWeight: '700' }]}>{serviceName}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.premiumBanner}
              onPress={handleAllServicesPress}
            >
              <LinearGradient
                colors={['rgba(30, 30, 30, 0.8)', 'rgba(20, 20, 20, 0.9)']}
                style={styles.premiumBannerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View>
                  <Text style={styles.premiumBannerTitle}>Catálogo Completo</Text>
                  <Text style={styles.premiumBannerSubtitle}>Explore mais de 20 serviços digitais</Text>
                </View>
                <IconSymbol ios_icon_name="arrow.right.circle.fill" android_material_icon_name="arrow-forward" size={32} color={colors.secondary} />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.rowSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Suporte</Text>
              </View>
              <View style={styles.supportCards}>
                <TouchableOpacity style={styles.supportCard}>
                  <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.cardContent}>
                    <IconSymbol ios_icon_name="questionmark.circle.fill" android_material_icon_name="help" size={28} color={colors.textSecondary} />
                    <Text style={styles.supportText}>Ajuda</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.supportCard} onPress={handleOrdersPress}>
                  <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.cardContent}>
                    <IconSymbol ios_icon_name="list.bullet.rectangle.fill" android_material_icon_name="history" size={28} color={colors.textSecondary} />
                    <Text style={styles.supportText}>Pedidos</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    opacity: 0.5,
  },
  decorativeCircle2: {
    position: 'absolute',
    top: 200,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(50, 50, 50, 0.15)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.secondary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  welcomeUser: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '600',
  },
  storesContainer: {
    marginBottom: 32,
  },
  storeCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(30,30,30,0.4)',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  storeAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mapButton: {
    backgroundColor: colors.secondary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  quickServiceCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(30,30,30,0.3)',
  },
  featuredServiceCard: {
    width: '48%',
    aspectRatio: 1.4,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  serviceContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  quickServiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickServiceName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  premiumBanner: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  premiumBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
  },
  premiumBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  premiumBannerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowSection: {
    marginBottom: 20,
  },
  supportCards: {
    flexDirection: 'row',
    gap: 12,
  },
  supportCard: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(30,30,30,0.3)',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  supportText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});

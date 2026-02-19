
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Animated, Dimensions, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

const { width } = Dimensions.get('window');

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      console.log('[ServicesScreen] Fetching services from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/services');

      const transformedServices = data.map((service: any) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        price: parseFloat(service.price),
        icon: service.icon || 'description',
        estimatedTime: service.estimatedTime,
        type: service.type || 'fazemos_pra_voce',
      }));

      setServices(transformedServices);
    } catch (error) {
      console.error('[ServicesScreen] Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'Todos', icon: 'apps' },
    { id: 'printing', name: 'Impressão', icon: 'print' },
    { id: 'documents', name: 'Documentos', icon: 'description' },
    { id: 'graphics', name: 'Gráficos', icon: 'image' },
  ];

  const filteredServices = selectedCategory === 'all'
    ? services
    : services.filter(s => s.category === selectedCategory);

  const handleServicePress = (service: any) => {
    console.log('ServicesScreen: Service pressed', service.id);
    router.push({
      pathname: '/service-detail',
      params: { serviceId: service.id }
    });
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[colors.background, '#1A1A1A', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.decorativeCircle} />
      </View>

      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={commonStyles.section}>

            <View style={styles.header}>
              <Text style={styles.screenTitle}>Catálogo de Serviços</Text>
              <Text style={styles.screenSubtitle}>Soluções digitais para você</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesContent}
            >
              {categories.map((category, index) => {
                const isSelected = selectedCategory === category.id;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <BlurView
                      intensity={isSelected ? 40 : 10}
                      tint="dark"
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    >
                      <IconSymbol
                        ios_icon_name={category.icon as any}
                        android_material_icon_name={category.icon as any}
                        size={18}
                        color={isSelected ? colors.secondary : colors.textSecondary}
                      />
                      <Text style={[
                        styles.categoryText,
                        isSelected && styles.categoryTextSelected
                      ]}>
                        {category.name}
                      </Text>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.servicesList}>
              {filteredServices.map((service, index) => {
                const serviceType = service.type || 'fazemos_pra_voce';
                const hasSelfService = serviceType === 'both' || serviceType === 'faca_sozinho';

                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    onPress={() => handleServicePress(service)}
                  >
                    <BlurView intensity={15} tint="dark" style={styles.serviceCardWrapper}>
                      <View style={styles.serviceCardContent}>
                        <View style={styles.serviceHeader}>
                          <View style={styles.iconContainer}>
                            <IconSymbol
                              ios_icon_name={service.icon}
                              android_material_icon_name={service.icon}
                              size={28}
                              color={colors.secondary}
                            />
                          </View>
                          <View style={styles.serviceInfo}>
                            <Text style={styles.serviceName}>{service.name}</Text>
                            <Text style={styles.serviceDescription} numberOfLines={2}>{service.description}</Text>
                          </View>
                          <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.glassBorder} />
                        </View>

                        <View style={styles.serviceFooter}>
                          <View style={styles.priceContainer}>
                            <Text style={styles.priceLabel}>A partir de</Text>
                            <Text style={styles.priceValue}>R$ {formatPrice(service.price)}</Text>
                          </View>
                          {hasSelfService && (
                            <View style={styles.discountTag}>
                              <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="bolt" size={12} color="#000" />
                              <Text style={styles.discountText}>-20% no Autoatendimento</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
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
  decorativeCircle: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  header: {
    marginBottom: 24,
    marginTop: 10,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  categoriesScroll: {
    marginBottom: 24,
    marginHorizontal: -20, // To allow scrolling edge-to-edge
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryChipSelected: {
    borderColor: colors.secondary,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextSelected: {
    color: colors.secondary,
  },
  servicesList: {
    gap: 16,
  },
  serviceCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(30,30,30,0.3)',
  },
  serviceCardContent: {
    padding: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  },
  discountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
});

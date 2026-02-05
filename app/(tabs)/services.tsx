
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    console.log('ServicesScreen: Loading services');
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      console.log('[ServicesScreen] Fetching services from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/services');
      
      // Transform API response to match UI expectations
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
      console.log('[ServicesScreen] Services loaded successfully:', transformedServices.length);
    } catch (error) {
      console.error('[ServicesScreen] Error loading services:', error);
      // Fallback to empty array on error
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
    const priceFormatted = price.toFixed(2).replace('.', ',');
    return priceFormatted;
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
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Serviços',
          headerStyle: {
            backgroundColor: colors.backgroundAlt,
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
          },
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContent}
          >
            {categories.map((category, index) => {
              const isSelected = selectedCategory === category.id;
              const categoryName = category.name;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <IconSymbol 
                    ios_icon_name={category.icon} 
                    android_material_icon_name={category.icon} 
                    size={20} 
                    color={isSelected ? '#FFFFFF' : colors.text} 
                  />
                  <Text style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected
                  ]}>
                    {categoryName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredServices.map((service, index) => {
            const serviceName = service.name;
            const serviceDescription = service.description;
            const priceText = formatPrice(service.price);
            const serviceType = service.type || 'fazemos_pra_voce';
            const hasSelfService = serviceType === 'both' || serviceType === 'faca_sozinho';
            
            return (
              <TouchableOpacity
                key={index}
                style={commonStyles.serviceCard}
                onPress={() => handleServicePress(service)}
              >
                <View style={styles.serviceHeader}>
                  <IconSymbol 
                    ios_icon_name={service.icon} 
                    android_material_icon_name={service.icon} 
                    size={40} 
                    color={colors.secondary} 
                  />
                  <View style={styles.serviceInfo}>
                    <View style={styles.serviceNameRow}>
                      <Text style={styles.serviceName}>{serviceName}</Text>
                      {hasSelfService && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>-20%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.serviceDescription}>{serviceDescription}</Text>
                    {hasSelfService && (
                      <Text style={styles.selfServiceText}>
                        💡 Faça sozinho e economize 20%
                      </Text>
                    )}
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceLabel}>A partir de</Text>
                      <Text style={styles.priceValue}>R$ {priceText}</Text>
                    </View>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesScroll: {
    marginBottom: 24,
  },
  categoriesContent: {
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  discountBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  selfServiceText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
});

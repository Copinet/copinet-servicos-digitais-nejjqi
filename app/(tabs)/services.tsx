
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
    // Navigate to services tab with category filter instead of detail page
    // This is more appropriate for the current UI flow
    router.push('/(tabs)/services');
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
                    <Text style={styles.serviceName}>{serviceName}</Text>
                    <Text style={styles.serviceDescription}>{serviceDescription}</Text>
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
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
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

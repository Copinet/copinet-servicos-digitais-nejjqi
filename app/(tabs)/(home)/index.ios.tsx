
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
    console.log('HomeScreen: Loading services');
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      console.log('[HomeScreen] Fetching services from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/services');
      
      // Group services by category for home screen display
      const categoryMap: Record<string, any> = {};
      
      data.forEach((service: any) => {
        const category = service.category;
        if (!categoryMap[category]) {
          categoryMap[category] = {
            id: category,
            name: getCategoryName(category),
            description: getCategoryDescription(category),
            icon: getCategoryIcon(category),
            category: category,
          };
        }
      });
      
      const groupedServices = Object.values(categoryMap);
      setServices(groupedServices);
      console.log('[HomeScreen] Services loaded successfully:', groupedServices.length);
    } catch (error) {
      console.error('[HomeScreen] Error loading services:', error);
      // Fallback to empty array on error
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (category: string): string => {
    const names: Record<string, string> = {
      printing: 'Cópias e Impressões',
      documents: 'Documentos Oficiais',
      graphics: 'Serviços Gráficos',
    };
    return names[category] || category;
  };

  const getCategoryDescription = (category: string): string => {
    const descriptions: Record<string, string> = {
      printing: 'Cópias coloridas e preto e branco',
      documents: 'Certidões, RG, CPF e mais',
      graphics: 'Banners, cartões, convites',
    };
    return descriptions[category] || '';
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      printing: 'print',
      documents: 'description',
      graphics: 'image',
    };
    return icons[category] || 'description';
  };

  const handleServicePress = (service: any) => {
    console.log('[HomeScreen] Service category pressed:', service.category);
    // Navigate to services tab with the category pre-selected
    router.push('/(tabs)/services');
  };

  const handleStoresPress = () => {
    console.log('HomeScreen: Stores button pressed');
    router.push('/stores-map');
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
          headerShown: true,
          title: 'Copinet Serviços Digitais',
          headerLargeTitle: true,
          headerStyle: {
            backgroundColor: colors.backgroundAlt,
          },
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
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

          {!user && (
            <TouchableOpacity 
              style={[commonStyles.largeButton, styles.loginButton]}
              onPress={handleLoginPress}
            >
              <IconSymbol 
                ios_icon_name="person.circle" 
                android_material_icon_name="account-circle" 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={[commonStyles.largeButtonText, styles.loginButtonText]}>
                Entrar ou Cadastrar
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[commonStyles.largeButton, styles.storesButton]}
            onPress={handleStoresPress}
          >
            <IconSymbol 
              ios_icon_name="map" 
              android_material_icon_name="location-on" 
              size={24} 
              color="#FFFFFF" 
            />
            <Text style={[commonStyles.largeButtonText, styles.storesButtonText]}>
              Ver Nossas Lojas
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Serviços Disponíveis</Text>

          {services.map((service, index) => {
            const serviceName = service.name;
            const serviceDescription = service.description;
            
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

          <View style={styles.infoCard}>
            <IconSymbol 
              ios_icon_name="info.circle" 
              android_material_icon_name="info" 
              size={32} 
              color={colors.secondary} 
            />
            <Text style={styles.infoTitle}>Fazemos pra você!</Text>
            <Text style={styles.infoText}>
              Precisa de certidões ou documentos oficiais? Nós cuidamos de tudo! 
              Nossos parceiros especializados emitem seus documentos com rapidez e segurança.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
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
    gap: 12,
    marginBottom: 16,
  },
  loginButtonText: {
    marginLeft: 8,
  },
  storesButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  storesButtonText: {
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
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
  serviceDescription: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.secondary,
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
});

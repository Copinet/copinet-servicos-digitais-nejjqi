
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Map } from '@/components/Map';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface Store {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  isOwned: boolean;
  distance?: number;
}

export default function StoresMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const needsPrinting = params.needsPrinting === 'true';
  const printJobId = params.printJobId as string;
  const serviceId = params.serviceId as string;
  const serviceName = params.serviceName as string;
  const totalPrice = params.totalPrice as string;
  const rejectedPartnerId = params.rejectedPartnerId as string;

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (userLocation) {
      loadStores();
    }
  }, [userLocation]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('StoresMapScreen: Location permission denied');
        loadStores();
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log('StoresMapScreen: User location:', location.coords);
    } catch (error) {
      console.error('StoresMapScreen: Error getting location:', error);
      loadStores();
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const loadStores = async () => {
    try {
      const { apiGet } = await import('@/utils/api');
      let storesData = await apiGet('/api/stores');
      console.log('StoresMapScreen: Stores loaded:', storesData);

      if (rejectedPartnerId) {
        storesData = storesData.filter((store: Store) => store.id !== rejectedPartnerId);
        console.log('StoresMapScreen: Filtered out rejected partner:', rejectedPartnerId);
      }

      if (userLocation) {
        storesData = storesData.map((store: Store) => ({
          ...store,
          distance: calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            store.latitude,
            store.longitude
          ),
        }));

        storesData.sort((a: Store, b: Store) => (a.distance || 0) - (b.distance || 0));
      }

      setStores(storesData);
    } catch (error) {
      console.error('StoresMapScreen: Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallPress = (phone: string) => {
    const phoneUrl = `tel:${phone}`;
    Linking.openURL(phoneUrl).catch(err => {
      console.error('StoresMapScreen: Error opening phone:', err);
    });
  };

  const handleDirectionsPress = (latitude: number, longitude: number, storeName: string) => {
    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
      default: 'https://maps.google.com',
    });
    const url = Platform.select({
      ios: `${scheme}?q=${latitude},${longitude}&ll=${latitude},${longitude}&label=${encodeURIComponent(storeName)}`,
      android: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(storeName)})`,
      default: `${scheme}?q=${latitude},${longitude}`,
    });

    Linking.openURL(url).catch(err => {
      console.error('StoresMapScreen: Error opening maps:', err);
    });
  };

  const handleSelectStore = async (store: Store) => {
    if (!needsPrinting) {
      router.push({
        pathname: '/payment',
        params: {
          serviceId,
          serviceName,
          totalPrice,
          storeId: store.id,
          storeName: store.name,
          storeAddress: store.address,
        },
      });
      return;
    }

    setSelectedStore(store);

    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      const response = await authenticatedPost(`/api/print-jobs/${printJobId}/assign-partner`, {
        partnerId: store.id,
      });

      console.log('StoresMapScreen: Partner assigned:', response);

      router.push({
        pathname: '/partner-waiting',
        params: {
          printJobId,
          partnerId: store.id,
          serviceId,
          serviceName,
          totalPrice,
        },
      });
    } catch (error) {
      console.error('StoresMapScreen: Error assigning partner:', error);
      Alert.alert('Erro', 'Não foi possível enviar o pedido para o parceiro. Tente novamente.');
      setSelectedStore(null);
    }
  };

  const distanceText = (distance?: number) => {
    if (!distance) {
      return '';
    }
    const distanceValue = distance.toFixed(1);
    return `${distanceValue} km`;
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            title: needsPrinting ? 'Escolher Onde Retirar' : 'Nossas Lojas',
            headerShown: true,
            headerBackTitle: 'Voltar',
          }}
        />
        <View style={[commonStyles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={styles.loadingText}>Carregando lojas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const markers = stores.map(store => ({
    id: store.id,
    latitude: store.latitude,
    longitude: store.longitude,
    title: store.name,
    description: store.address,
  }));

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : stores.length > 0
    ? {
        latitude: stores[0].latitude,
        longitude: stores[0].longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : undefined;

  const titleText = needsPrinting ? 'Escolher Onde Retirar' : 'Nossas Lojas';
  const subtitleText = needsPrinting 
    ? 'Selecione um parceiro próximo para retirar sua impressão'
    : 'Encontre a loja mais próxima de você';

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: titleText,
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <Map
            markers={markers}
            initialRegion={initialRegion}
            userLocation={userLocation}
          />
        </View>

        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{titleText}</Text>
            <Text style={styles.listSubtitle}>{subtitleText}</Text>
          </View>

          <ScrollView style={styles.storesList} contentContainerStyle={styles.storesListContent}>
            {stores.map((store) => {
              const storeDistanceText = distanceText(store.distance);
              const isSelected = selectedStore?.id === store.id;
              
              return (
                <View key={store.id} style={styles.storeCard}>
                  <View style={styles.storeHeader}>
                    <View style={styles.storeInfo}>
                      <Text style={styles.storeName}>{store.name}</Text>
                      {store.isOwned && (
                        <View style={styles.ownedBadge}>
                          <Text style={styles.ownedBadgeText}>Loja Própria</Text>
                        </View>
                      )}
                    </View>
                    {store.distance && (
                      <View style={styles.distanceBadge}>
                        <IconSymbol 
                          ios_icon_name="location.fill" 
                          android_material_icon_name="location-on" 
                          size={16} 
                          color={colors.secondary} 
                        />
                        <Text style={styles.distanceText}>{storeDistanceText}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.storeAddress}>{store.address}</Text>

                  <View style={styles.storeActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleCallPress(store.phone)}
                    >
                      <IconSymbol 
                        ios_icon_name="phone.fill" 
                        android_material_icon_name="phone" 
                        size={20} 
                        color={colors.secondary} 
                      />
                      <Text style={styles.actionButtonText}>Ligar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleDirectionsPress(store.latitude, store.longitude, store.name)}
                    >
                      <IconSymbol 
                        ios_icon_name="map.fill" 
                        android_material_icon_name="directions" 
                        size={20} 
                        color={colors.secondary} 
                      />
                      <Text style={styles.actionButtonText}>Rotas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.selectButton, isSelected && styles.selectButtonDisabled]}
                      onPress={() => handleSelectStore(store)}
                      disabled={isSelected}
                    >
                      {isSelected ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.selectButtonText}>
                            {needsPrinting ? 'Selecionar' : 'Ver Detalhes'}
                          </Text>
                          <IconSymbol 
                            ios_icon_name="arrow.right" 
                            android_material_icon_name="arrow-forward" 
                            size={20} 
                            color="#FFFFFF" 
                          />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  mapContainer: {
    height: '40%',
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listHeader: {
    padding: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  storesList: {
    flex: 1,
  },
  storesListContent: {
    padding: 16,
    gap: 16,
  },
  storeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  storeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  ownedBadge: {
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  storeAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  storeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  selectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    gap: 6,
  },
  selectButtonDisabled: {
    opacity: 0.6,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

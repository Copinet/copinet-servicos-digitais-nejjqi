
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { Map } from '@/components/Map';
import * as Location from 'expo-location';

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
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    console.log('StoresMapScreen: Initializing');
    requestLocationPermission();
    loadStores();
  }, []);

  const requestLocationPermission = async () => {
    try {
      console.log('[StoresMapScreen] Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('[StoresMapScreen] Location permission denied');
        setLocationPermission(false);
        return;
      }

      setLocationPermission(true);
      console.log('[StoresMapScreen] Location permission granted');

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userCoords);
      console.log('[StoresMapScreen] User location:', userCoords);
    } catch (error) {
      console.error('[StoresMapScreen] Error getting location:', error);
      setLocationPermission(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    // Haversine formula to calculate distance between two coordinates
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  const loadStores = async () => {
    try {
      console.log('[StoresMapScreen] Fetching stores from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/stores');
      
      // Transform API response to match UI expectations
      const transformedStores: Store[] = data.map((store: any) => ({
        id: store.id,
        name: store.name,
        address: store.address,
        latitude: parseFloat(store.latitude),
        longitude: parseFloat(store.longitude),
        phone: store.phone,
        isOwned: store.isOwned,
      }));
      
      setStores(transformedStores);
      console.log('[StoresMapScreen] Stores loaded successfully:', transformedStores.length);
    } catch (error) {
      console.error('[StoresMapScreen] Error loading stores:', error);
      // Fallback to empty array on error
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate distances when user location is available
  useEffect(() => {
    if (userLocation && stores.length > 0) {
      const storesWithDistance = stores.map(store => ({
        ...store,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          store.latitude,
          store.longitude
        ),
      }));

      // Sort by distance (closest first)
      storesWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      setStores(storesWithDistance);
      console.log('[StoresMapScreen] Distances calculated and sorted');
    }
  }, [userLocation]);

  const handleCallPress = (phone: string) => {
    console.log('StoresMapScreen: Call button pressed', phone);
    const phoneNumber = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleDirectionsPress = (latitude: number, longitude: number, storeName: string) => {
    console.log('StoresMapScreen: Directions button pressed', latitude, longitude);
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}(${encodeURIComponent(storeName)})`,
      android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(storeName)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url);
  };

  const handleSelectStore = (store: Store) => {
    console.log('[StoresMapScreen] Store selected:', store.name);
    
    // If we have a print job ID from params, update it with the selected store
    if (params.printJobId) {
      // TODO: Update print job with selected store
      console.log('[StoresMapScreen] Updating print job', params.printJobId, 'with store', store.id);
    }
    
    // Navigate back or to confirmation screen
    router.back();
  };

  const markers = stores.map(store => ({
    id: store.id,
    latitude: store.latitude,
    longitude: store.longitude,
    title: store.name,
    description: store.address,
  }));

  // Add user location marker if available
  if (userLocation) {
    markers.push({
      id: 'user-location',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      title: 'Você está aqui',
      description: 'Sua localização atual',
    });
  }

  // Calculate initial region based on user location or first store
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
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: -23.8900,
        longitude: -46.4200,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: 'Selecionar Loja',
            headerBackTitle: 'Voltar',
          }}
        />
        <View style={[commonStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={styles.loadingText}>Carregando lojas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Selecionar Loja',
          headerBackTitle: 'Voltar',
        }}
      />
      <View style={commonStyles.container}>
        {!locationPermission && (
          <View style={styles.permissionBanner}>
            <IconSymbol 
              ios_icon_name="location.slash" 
              android_material_icon_name="location-off" 
              size={24} 
              color={colors.accent} 
            />
            <Text style={styles.permissionText}>
              Permita o acesso à localização para ver as lojas mais próximas
            </Text>
          </View>
        )}
        
        <View style={styles.mapContainer}>
          <Map
            markers={markers}
            initialRegion={initialRegion}
            style={styles.map}
            showsUserLocation={locationPermission}
          />
        </View>
        
        <ScrollView style={styles.storesList} contentContainerStyle={styles.storesListContent}>
          <Text style={styles.listTitle}>
            {locationPermission ? 'Lojas mais próximas' : 'Nossas Lojas'}
          </Text>
          
          {stores.map((store, index) => {
            const storeName = store.name;
            const storeAddress = store.address;
            const storePhone = store.phone;
            const distanceText = store.distance 
              ? `${store.distance.toFixed(1)} km de você`
              : null;
            
            return (
              <View key={index} style={commonStyles.card}>
                <View style={styles.storeHeader}>
                  <IconSymbol 
                    ios_icon_name="building.2" 
                    android_material_icon_name="store" 
                    size={32} 
                    color={colors.secondary} 
                  />
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{storeName}</Text>
                    <View style={styles.badges}>
                      {store.isOwned && (
                        <View style={styles.ownedBadge}>
                          <Text style={styles.badgeText}>Loja Própria</Text>
                        </View>
                      )}
                      {distanceText && (
                        <View style={styles.distanceBadge}>
                          <IconSymbol 
                            ios_icon_name="location.fill" 
                            android_material_icon_name="location-on" 
                            size={14} 
                            color="#FFFFFF" 
                          />
                          <Text style={styles.badgeText}>{distanceText}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                
                <View style={styles.storeDetails}>
                  <View style={styles.detailRow}>
                    <IconSymbol 
                      ios_icon_name="location" 
                      android_material_icon_name="location-on" 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                    <Text style={styles.detailText}>{storeAddress}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <IconSymbol 
                      ios_icon_name="phone" 
                      android_material_icon_name="phone" 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                    <Text style={styles.detailText}>{storePhone}</Text>
                  </View>
                </View>
                
                <View style={styles.storeActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={() => handleCallPress(store.phone)}
                  >
                    <IconSymbol 
                      ios_icon_name="phone.fill" 
                      android_material_icon_name="phone" 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.actionButtonText}>Ligar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={() => handleDirectionsPress(store.latitude, store.longitude, store.name)}
                  >
                    <IconSymbol 
                      ios_icon_name="map" 
                      android_material_icon_name="directions" 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.actionButtonText}>Rotas</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleSelectStore(store)}
                  >
                    <IconSymbol 
                      ios_icon_name="checkmark.circle.fill" 
                      android_material_icon_name="check-circle" 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.actionButtonText}>Selecionar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  permissionBanner: {
    backgroundColor: colors.accent + '20',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent + '40',
  },
  permissionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  mapContainer: {
    height: 300,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  storesList: {
    flex: 1,
  },
  storesListContent: {
    padding: 20,
    paddingBottom: 100,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownedBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storeDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
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
    gap: 6,
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: colors.primary,
    flex: 0.7,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

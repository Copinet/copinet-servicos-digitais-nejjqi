
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { Map } from '@/components/Map';

export default function StoresMapScreen() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('StoresMapScreen: Loading stores');
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      console.log('[StoresMapScreen] Fetching stores from API...');
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/stores');
      
      // Transform API response to match UI expectations
      const transformedStores = data.map((store: any) => ({
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

  const handleCallPress = (phone: string) => {
    console.log('StoresMapScreen: Call button pressed', phone);
    const phoneNumber = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleDirectionsPress = (latitude: number, longitude: number) => {
    console.log('StoresMapScreen: Directions button pressed', latitude, longitude);
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url);
  };

  const markers = stores.map(store => ({
    id: store.id,
    latitude: store.latitude,
    longitude: store.longitude,
    title: store.name,
    description: store.address,
  }));

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
          title: 'Nossas Lojas',
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
      <View style={commonStyles.container}>
        <View style={styles.mapContainer}>
          <Map
            markers={markers}
            initialRegion={{
              latitude: -23.8900,
              longitude: -46.4200,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            style={styles.map}
            showsUserLocation={true}
          />
        </View>
        <ScrollView style={styles.storesList} contentContainerStyle={styles.storesListContent}>
          {stores.map((store, index) => {
            const storeName = store.name;
            const storeAddress = store.address;
            const storePhone = store.phone;
            
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
                    {store.isOwned && (
                      <View style={styles.ownedBadge}>
                        <Text style={styles.ownedText}>Loja Própria</Text>
                      </View>
                    )}
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
                    style={styles.actionButton}
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
                    onPress={() => handleDirectionsPress(store.latitude, store.longitude)}
                  >
                    <IconSymbol 
                      ios_icon_name="map" 
                      android_material_icon_name="directions" 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.actionButtonText}>Rotas</Text>
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
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  ownedBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ownedText: {
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
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  storeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

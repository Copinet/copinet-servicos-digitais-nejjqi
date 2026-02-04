
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLoginPress = () => {
    console.log('ProfileScreen: Login button pressed');
    router.push('/auth');
  };

  const handleSignOut = async () => {
    console.log('ProfileScreen: Sign out button pressed');
    try {
      await signOut();
      console.log('ProfileScreen: User signed out successfully');
    } catch (error) {
      console.error('ProfileScreen: Error signing out', error);
    }
  };

  const handleStoresPress = () => {
    console.log('ProfileScreen: Stores button pressed');
    router.push('/stores-map');
  };

  if (!user) {
    return (
      <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: 'Perfil',
            headerLargeTitle: true,
          }}
        />
        <View style={[commonStyles.container, styles.emptyContainer]}>
          <IconSymbol 
            ios_icon_name="person.circle" 
            android_material_icon_name="account-circle" 
            size={100} 
            color={colors.textSecondary} 
          />
          <Text style={styles.emptyTitle}>Bem-vindo!</Text>
          <Text style={styles.emptyText}>
            Faça login para acessar seu perfil e gerenciar seus pedidos
          </Text>
          <TouchableOpacity 
            style={commonStyles.largeButton}
            onPress={handleLoginPress}
          >
            <Text style={commonStyles.largeButtonText}>Entrar ou Cadastrar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const userName = user.name || user.email || 'Usuário';

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Perfil',
          headerLargeTitle: true,
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.profileHeader}>
            <IconSymbol 
              ios_icon_name="person.circle.fill" 
              android_material_icon_name="account-circle" 
              size={80} 
              color={colors.secondary} 
            />
            <Text style={styles.userName}>{userName}</Text>
            {user.email && (
              <Text style={styles.userEmail}>{user.email}</Text>
            )}
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleStoresPress}
            >
              <IconSymbol 
                ios_icon_name="map" 
                android_material_icon_name="location-on" 
                size={24} 
                color={colors.text} 
              />
              <Text style={styles.menuItemText}>Nossas Lojas</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleSignOut}
            >
              <IconSymbol 
                ios_icon_name="arrow.right.square" 
                android_material_icon_name="logout" 
                size={24} 
                color={colors.error} 
              />
              <Text style={[styles.menuItemText, styles.signOutText]}>Sair</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Copinet Serviços Digitais</Text>
            <Text style={styles.infoText}>
              Sua central de serviços digitais e documentos em Cubatão
            </Text>
            <Text style={styles.infoVersion}>Versão 1.0.0</Text>
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
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 24,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
  },
  signOutText: {
    color: colors.error,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  infoVersion: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

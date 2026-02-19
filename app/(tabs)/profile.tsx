import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
        <StatusBar barStyle="light-content" />
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.backgroundContainer}>
          <LinearGradient
            colors={[colors.background, '#1A1A1A', '#000000']}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[commonStyles.container, styles.emptyContainer]}>
          <View style={styles.emptyIconContainer}>
            <IconSymbol
              ios_icon_name="person.circle"
              android_material_icon_name="account-circle"
              size={80}
              color={colors.textSecondary}
            />
          </View>
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
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[colors.background, '#1A1A1A', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.decorativeCircle} />
      </View>

      <View style={styles.header}>
        <Text style={styles.screenTitle}>Meu Perfil</Text>
      </View>

      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>

          <BlurView intensity={20} tint="dark" style={styles.profileCardWrapper}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={50}
                  color={colors.secondary}
                />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userName}</Text>
                {user.email && (
                  <Text style={styles.userEmail}>{user.email}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.editButton}>
                <IconSymbol ios_icon_name="pencil.circle.fill" android_material_icon_name="edit" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </BlurView>

          <View style={styles.menuSection}>
            <Text style={styles.sectionLabel}>Minha Conta</Text>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={20} color={colors.text} />
              </View>
              <Text style={styles.menuItemText}>Meus Dados</Text>
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleStoresPress}>
              <View style={styles.menuIcon}>
                <IconSymbol ios_icon_name="map.fill" android_material_icon_name="location-on" size={20} color={colors.text} />
              </View>
              <Text style={styles.menuItemText}>Nossas Lojas</Text>
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={20} color={colors.text} />
              </View>
              <Text style={styles.menuItemText}>Privacidade e Segurança</Text>
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionLabel}>App</Text>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <IconSymbol ios_icon_name="bell.fill" android_material_icon_name="notifications" size={20} color={colors.text} />
              </View>
              <Text style={styles.menuItemText}>Notificações</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>On</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <IconSymbol ios_icon_name="questionmark.circle.fill" android_material_icon_name="help" size={20} color={colors.text} />
              </View>
              <Text style={styles.menuItemText}>Ajuda e Suporte</Text>
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <IconSymbol
              ios_icon_name="arrow.right.square"
              android_material_icon_name="logout"
              size={20}
              color={colors.error}
            />
            <Text style={styles.signOutText}>Sair da Conta</Text>
          </TouchableOpacity>

          <View style={styles.infoFooter}>
            <Text style={styles.infoTitle}>Copinet Serviços Digitais</Text>
            <Text style={styles.infoVersion}>Versão 1.0.0 (Premium)</Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 10,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  decorativeCircle: {
    position: 'absolute',
    top: -100,
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
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
  profileCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(30,30,30,0.4)',
    marginBottom: 32,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  editButton: {
    padding: 8,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
    backgroundColor: 'rgba(255, 82, 82, 0.05)',
    gap: 10,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  infoFooter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoVersion: {
    fontSize: 12,
    color: colors.textSecondary,
    opacity: 0.7,
  },
});


import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// 🎨 IDENTIDADE VISUAL COPINET - Premium Dark Theme
export const colors = {
  // Paleta Principal - Premium
  primary: '#FFFFFF',      // White for primary text/icons
  secondary: '#FFD700',    // Gold - Destaques principais
  accent: '#FFC107',       // Amber/Gold lighter

  // Backgrounds
  background: '#000000',   // Black
  backgroundAlt: '#121212', // Slightly lighter black
  card: 'rgba(30, 30, 30, 0.7)', // Glassmorphism base

  // Textos
  text: '#FFFFFF',         // White
  textSecondary: '#A0A0A0', // Grey

  // Bordas e Divisores
  border: 'rgba(255, 255, 255, 0.1)',

  // Glass Effects
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',

  // Estados
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#FF5252',
  highlight: '#D4AF37',
};

export const buttonStyles = StyleSheet.create({
  primaryButton: {
    backgroundColor: colors.secondary,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 24,
  },
  textSecondary: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goldAccent: {
    color: colors.secondary,
  },
  largeButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 12,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  largeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
});

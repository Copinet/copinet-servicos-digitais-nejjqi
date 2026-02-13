
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// 🎨 IDENTIDADE VISUAL COPINET - Dark Modern Theme
export const colors = {
  // Paleta Principal - Dark Modern
  primary: '#C0C0C0',      // Silver (Prata)
  secondary: '#D4AF37',    // Gold (Dourado) - Destaques e botões primários
  accent: '#FFD700',       // Bright Gold - Highlights especiais
  
  // Backgrounds - Dark Theme
  background: '#121212',   // Charcoal - Fundo principal (Dark)
  backgroundAlt: '#1E1E1E', // Dark Grey - Fundo alternativo
  card: '#1E1E1E',         // Dark Grey - Cards com Glassmorphism
  
  // Textos - High Contrast
  text: '#FFFFFF',         // White - Texto principal (high contrast)
  textSecondary: '#C0C0C0', // Silver - Textos secundários e bordas
  
  // Bordas e Divisores
  border: '#333333',       // Dark border
  
  // Estados
  success: '#4CAF50',      // Green
  warning: '#FF9800',      // Orange
  error: '#F44336',        // Red
  highlight: '#D4AF37',    // Gold highlight
};

export const buttonStyles = StyleSheet.create({
  primaryButton: {
    backgroundColor: colors.secondary,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
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
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 26,
  },
  textSecondary: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 24,
  },
  section: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  goldAccent: {
    color: colors.secondary,
  },
  largeButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  largeButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

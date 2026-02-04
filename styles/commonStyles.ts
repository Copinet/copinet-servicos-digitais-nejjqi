
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

export const colors = {
  primary: '#C0C0C0',      // Silver
  secondary: '#D4AF37',    // Gold
  accent: '#FFD700',       // Bright Gold
  background: '#F5F5F5',   // Light Silver/Grey
  backgroundAlt: '#FFFFFF', // White
  text: '#2C2C2C',         // Dark Grey (high contrast for elderly)
  textSecondary: '#666666', // Medium Grey
  card: '#FFFFFF',         // White cards
  border: '#E0E0E0',       // Light border
  success: '#4CAF50',      // Green
  warning: '#FF9800',      // Orange
  error: '#F44336',        // Red
  highlight: '#FFD700',    // Gold highlight
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

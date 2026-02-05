
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal as RNModal, Platform } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function Modal({
  visible,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
  children,
}: ModalProps) {
  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          ios: 'checkmark.circle.fill',
          android: 'check-circle',
          color: colors.success,
        };
      case 'warning':
        return {
          ios: 'exclamationmark.triangle.fill',
          android: 'warning',
          color: colors.warning,
        };
      case 'error':
        return {
          ios: 'exclamationmark.circle.fill',
          android: 'error',
          color: colors.error,
        };
      default:
        return {
          ios: 'info.circle.fill',
          android: 'info',
          color: colors.accent,
        };
    }
  };

  const iconConfig = getIconConfig();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <IconSymbol
              ios_icon_name={iconConfig.ios}
              android_material_icon_name={iconConfig.android}
              size={48}
              color={iconConfig.color}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          
          {message && <Text style={styles.message}>{message}</Text>}
          
          {children && <View style={styles.childrenContainer}>{children}</View>}

          <View style={styles.buttons}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.buttonTextSecondary}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                type === 'error' && styles.buttonDanger,
                !onCancel && styles.buttonFull,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={styles.buttonTextPrimary}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  childrenContainer: {
    width: '100%',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.error,
  },
  buttonTextPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

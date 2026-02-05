
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function FazemosPraVoceFormScreen() {
  const router = useRouter();
  const { serviceId, serviceName, servicePrice, selectedOption } = useLocalSearchParams();
  
  const [formData, setFormData] = useState({
    fullName: '',
    cpf: '',
    rg: '',
    birthDate: '',
    email: '',
    phone: '',
    notes: '',
  });

  const handleInputChange = (field: string, value: string) => {
    console.log(`[FazemosPraVoceForm] Field ${field} changed:`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    console.log('[FazemosPraVoceForm] Submitting form:', formData);
    
    const price = parseFloat(servicePrice as string);
    
    router.push({
      pathname: '/payment',
      params: {
        serviceId,
        serviceName,
        originalPrice: price.toString(),
        finalPrice: price.toString(),
        flow: 'fazemos',
        selectedOption,
        formData: JSON.stringify(formData),
      }
    });
  };

  const isFormValid = formData.fullName.trim() !== '' && formData.cpf.trim() !== '';

  const nameValue = formData.fullName;
  const cpfValue = formData.cpf;
  const rgValue = formData.rg;
  const birthDateValue = formData.birthDate;
  const emailValue = formData.email;
  const phoneValue = formData.phone;
  const notesValue = formData.notes;

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Preencha seus dados',
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          {/* Service Info */}
          <View style={styles.serviceInfoCard}>
            <Text style={styles.serviceInfoTitle}>{serviceName}</Text>
            <Text style={styles.serviceInfoSubtitle}>Fazemos pra Você</Text>
          </View>

          {/* Ethical Banner */}
          <View style={styles.ethicalBanner}>
            <IconSymbol 
              ios_icon_name="info.circle.fill" 
              android_material_icon_name="info" 
              size={24} 
              color={colors.secondary} 
            />
            <Text style={styles.ethicalBannerText}>
              Nossos parceiros farão a emissão do documento para você. Fazemos com seus dados, mas a responsabilidade legal é do usuário.
            </Text>
          </View>

          {/* Form Fields */}
          <Text style={styles.sectionTitle}>Dados Necessários</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome Completo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite seu nome completo"
              placeholderTextColor={colors.textSecondary}
              value={nameValue}
              onChangeText={(value) => handleInputChange('fullName', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CPF *</Text>
            <TextInput
              style={styles.input}
              placeholder="000.000.000-00"
              placeholderTextColor={colors.textSecondary}
              value={cpfValue}
              onChangeText={(value) => handleInputChange('cpf', value)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>RG</Text>
            <TextInput
              style={styles.input}
              placeholder="00.000.000-0"
              placeholderTextColor={colors.textSecondary}
              value={rgValue}
              onChangeText={(value) => handleInputChange('rg', value)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Data de Nascimento</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textSecondary}
              value={birthDateValue}
              onChangeText={(value) => handleInputChange('birthDate', value)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textSecondary}
              value={emailValue}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Telefone</Text>
            <TextInput
              style={styles.input}
              placeholder="(00) 00000-0000"
              placeholderTextColor={colors.textSecondary}
              value={phoneValue}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Observações</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Informações adicionais ou instruções especiais"
              placeholderTextColor={colors.textSecondary}
              value={notesValue}
              onChangeText={(value) => handleInputChange('notes', value)}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isFormValid}
          >
            <Text style={styles.submitButtonText}>Ir para Pagamento</Text>
            <IconSymbol 
              ios_icon_name="arrow.right" 
              android_material_icon_name="arrow-forward" 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          <Text style={styles.requiredNote}>* Campos obrigatórios</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  serviceInfoCard: {
    backgroundColor: colors.secondary + '20',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  serviceInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  serviceInfoSubtitle: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '600',
  },
  ethicalBanner: {
    backgroundColor: colors.secondary + '15',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.secondary + '40',
  },
  ethicalBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.textSecondary + '30',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requiredNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});


import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function FacaSozinhoFormScreen() {
  const router = useRouter();
  const { serviceId, serviceName, servicePrice, selectedOption } = useLocalSearchParams();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    objective: '',
    experience: '',
    education: '',
    skills: '',
    additionalInfo: '',
  });

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    console.log(`[FacaSozinhoForm] Field ${field} changed:`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    console.log('[FacaSozinhoForm] Submitting form:', formData);
    
    const price = parseFloat(servicePrice as string);
    const discountedPrice = price * 0.8;
    
    router.push({
      pathname: '/payment',
      params: {
        serviceId,
        serviceName,
        originalPrice: price.toString(),
        finalPrice: discountedPrice.toString(),
        flow: 'sozinho',
        selectedOption,
        formData: JSON.stringify(formData),
      }
    });
  };

  const isFormValid = formData.fullName.trim() !== '' && formData.email.trim() !== '';

  const nameValue = formData.fullName;
  const emailValue = formData.email;
  const phoneValue = formData.phone;
  const addressValue = formData.address;
  const objectiveValue = formData.objective;
  const experienceValue = formData.experience;
  const educationValue = formData.education;
  const skillsValue = formData.skills;
  const additionalInfoValue = formData.additionalInfo;

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
            <Text style={styles.serviceInfoSubtitle}>Faça Sozinho - 20% de desconto</Text>
          </View>

          {/* Ethical Banner */}
          <View style={styles.ethicalBanner}>
            <IconSymbol 
              ios_icon_name="info.circle.fill" 
              android_material_icon_name="info" 
              size={24} 
              color={colors.accent} 
            />
            <Text style={styles.ethicalBannerText}>
              Fazemos com seus dados, mas a responsabilidade legal é do usuário.
            </Text>
          </View>

          {/* Form Fields */}
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>

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
            <Text style={styles.inputLabel}>E-mail *</Text>
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
            <Text style={styles.inputLabel}>Endereço</Text>
            <TextInput
              style={styles.input}
              placeholder="Rua, número, bairro, cidade"
              placeholderTextColor={colors.textSecondary}
              value={addressValue}
              onChangeText={(value) => handleInputChange('address', value)}
            />
          </View>

          {/* Service-specific fields (for resume) */}
          <Text style={styles.sectionTitle}>Informações do Currículo</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Objetivo Profissional</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descreva seu objetivo profissional"
              placeholderTextColor={colors.textSecondary}
              value={objectiveValue}
              onChangeText={(value) => handleInputChange('objective', value)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Experiência Profissional</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Liste suas experiências profissionais (empresa, cargo, período)"
              placeholderTextColor={colors.textSecondary}
              value={experienceValue}
              onChangeText={(value) => handleInputChange('experience', value)}
              multiline
              numberOfLines={5}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Formação Acadêmica</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Liste sua formação (instituição, curso, período)"
              placeholderTextColor={colors.textSecondary}
              value={educationValue}
              onChangeText={(value) => handleInputChange('education', value)}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Habilidades e Competências</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Liste suas principais habilidades"
              placeholderTextColor={colors.textSecondary}
              value={skillsValue}
              onChangeText={(value) => handleInputChange('skills', value)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Informações Adicionais</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Cursos, certificações, idiomas, etc."
              placeholderTextColor={colors.textSecondary}
              value={additionalInfoValue}
              onChangeText={(value) => handleInputChange('additionalInfo', value)}
              multiline
              numberOfLines={3}
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
    backgroundColor: colors.accent + '20',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  serviceInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  serviceInfoSubtitle: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  ethicalBanner: {
    backgroundColor: colors.accent + '15',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.accent + '40',
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


import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PartnerWaitingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [status, setStatus] = useState<'waiting' | 'accepted' | 'rejected' | 'timeout'>('waiting');
  const [partnerName, setPartnerName] = useState('');

  const printJobId = params.printJobId as string;
  const partnerId = params.partnerId as string;
  const serviceName = params.serviceName as string;
  const totalPrice = params.totalPrice as string;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1;
        if (newTime >= 300) {
          setStatus('timeout');
          clearInterval(timer);
        }
        return newTime;
      });
    }, 1000);

    checkPartnerResponse();

    return () => clearInterval(timer);
  }, []);

  const checkPartnerResponse = async () => {
    try {
      const { authenticatedGet } = await import('@/utils/api');
      
      const interval = setInterval(async () => {
        try {
          const response = await authenticatedGet(`/api/print-jobs/${printJobId}`);
          
          if (response.status === 'accepted') {
            setStatus('accepted');
            setPartnerName(response.partnerName || 'Parceiro');
            clearInterval(interval);
            
            setTimeout(() => {
              router.replace({
                pathname: '/payment',
                params: {
                  serviceId: params.serviceId,
                  serviceName,
                  totalPrice,
                  printJobId,
                  partnerId,
                  partnerName: response.partnerName,
                  partnerAddress: response.partnerAddress,
                },
              });
            }, 2000);
          } else if (response.status === 'rejected') {
            setStatus('rejected');
            clearInterval(interval);
            
            setTimeout(() => {
              router.replace({
                pathname: '/stores-map',
                params: {
                  serviceId: params.serviceId,
                  serviceName,
                  totalPrice,
                  printJobId,
                  needsPrinting: 'true',
                  rejectedPartnerId: partnerId,
                },
              });
            }, 3000);
          }
        } catch (error) {
          console.error('PartnerWaitingScreen: Error checking status:', error);
        }
      }, 3000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('PartnerWaitingScreen: Error setting up polling:', error);
    }
  };

  const handleTimeout = () => {
    router.replace({
      pathname: '/stores-map',
      params: {
        serviceId: params.serviceId,
        serviceName,
        totalPrice,
        printJobId,
        needsPrinting: 'true',
        rejectedPartnerId: partnerId,
      },
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const minText = mins.toString();
    const secText = secs.toString().padStart(2, '0');
    return `${minText}:${secText}`;
  };

  const timeRemaining = 300 - timeElapsed;
  const timeRemainingText = formatTime(timeRemaining);

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Aguardando Aceite',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <View style={[commonStyles.container, styles.container]}>
        {status === 'waiting' && (
          <>
            <View style={styles.iconContainer}>
              <ActivityIndicator size="large" color={colors.secondary} />
              <IconSymbol 
                ios_icon_name="clock.fill" 
                android_material_icon_name="schedule" 
                size={80} 
                color={colors.secondary} 
                style={styles.icon}
              />
            </View>

            <Text style={styles.title}>Aguardando aceite da impressão...</Text>
            <Text style={styles.subtitle}>
              Enviamos seu pedido para o parceiro selecionado. Você será notificado quando ele aceitar.
            </Text>

            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>Tempo estimado:</Text>
              <Text style={styles.timeValue}>5-10 min</Text>
              <Text style={styles.timeRemaining}>Tempo restante: {timeRemainingText}</Text>
            </View>

            <View style={styles.infoCard}>
              <IconSymbol 
                ios_icon_name="info.circle.fill" 
                android_material_icon_name="info" 
                size={24} 
                color={colors.accent} 
              />
              <Text style={styles.infoText}>
                Se o parceiro não responder em 5 minutos, você poderá escolher outro parceiro.
              </Text>
            </View>
          </>
        )}

        {status === 'accepted' && (
          <>
            <View style={styles.iconContainer}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={100} 
                color={colors.success} 
              />
            </View>

            <Text style={styles.title}>Impressão Aceita!</Text>
            <Text style={styles.subtitle}>
              {partnerName} aceitou sua impressão. Redirecionando para pagamento...
            </Text>
          </>
        )}

        {status === 'rejected' && (
          <>
            <View style={styles.iconContainer}>
              <IconSymbol 
                ios_icon_name="xmark.circle.fill" 
                android_material_icon_name="cancel" 
                size={100} 
                color={colors.error} 
              />
            </View>

            <Text style={styles.title}>Parceiro Recusou</Text>
            <Text style={styles.subtitle}>
              Desculpe pelo inconveniente. Escolha outro parceiro para retirar sua impressão.
            </Text>
          </>
        )}

        {status === 'timeout' && (
          <>
            <View style={styles.iconContainer}>
              <IconSymbol 
                ios_icon_name="clock.badge.xmark" 
                android_material_icon_name="timer-off" 
                size={100} 
                color={colors.warning} 
              />
            </View>

            <Text style={styles.title}>Tempo Esgotado</Text>
            <Text style={styles.subtitle}>
              O parceiro não respondeu a tempo. Por favor, escolha outro parceiro.
            </Text>

            <TouchableOpacity style={styles.button} onPress={handleTimeout}>
              <Text style={styles.buttonText}>Escolher Outro Parceiro</Text>
              <IconSymbol 
                ios_icon_name="arrow.right" 
                android_material_icon_name="arrow-forward" 
                size={24} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  timeCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  timeLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 12,
  },
  timeRemaining: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.accent + '20',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 10,
    marginTop: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

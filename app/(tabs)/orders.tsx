
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

export default function OrdersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      console.log('[OrdersScreen] Fetching orders from API...');
      const { authenticatedGet } = await import('@/utils/api');

      // Fetch both regular orders and print jobs
      const [ordersData, printJobsData] = await Promise.all([
        authenticatedGet('/api/orders').catch(() => []),
        authenticatedGet('/api/print-jobs').catch(() => []),
      ]);

      // Transform regular orders
      const transformedOrders = ordersData.map((order: any) => ({
        id: order.id,
        serviceId: order.serviceId,
        serviceName: order.serviceName,
        status: order.status,
        customerData: order.customerData,
        totalPrice: parseFloat(order.totalPrice) || 0,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        type: 'order',
      }));

      // Transform print jobs
      const transformedPrintJobs = printJobsData.map((job: any) => ({
        id: job.id,
        serviceId: job.serviceType,
        serviceName: getServiceNameFromType(job.serviceType),
        status: job.status,
        customerData: null,
        totalPrice: parseFloat(job.totalPrice) || 0,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        type: 'print_job',
        files: job.files,
        options: job.options,
      }));

      // Combine and sort by date
      const allOrders = [...transformedOrders, ...transformedPrintJobs].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setOrders(allOrders);
      console.log('[OrdersScreen] Orders loaded successfully:', allOrders.length);
    } catch (error) {
      console.error('[OrdersScreen] Error loading orders:', error);
      // Fallback to empty array on error
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      console.log('OrdersScreen: Loading orders for user', user.id);
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [user, loadOrders]);

  const getServiceNameFromType = (type: string) => {
    const names: Record<string, string> = {
      quick_print: 'Impressão Rápida',
      photo_print: 'Impressão de Fotos',
      photo_3x4: 'Foto 3x4',
      scan_to_pdf: 'Escanear para PDF',
    };
    return names[type] || type;
  };

  const handleOrderPress = async (orderId: string) => {
    console.log('[OrdersScreen] Order pressed:', orderId);
    try {
      const { authenticatedGet } = await import('@/utils/api');
      const order = orders.find(o => o.id === orderId);

      let orderDetail;
      if (order && order.type === 'print_job') {
        orderDetail = await authenticatedGet(`/api/print-jobs/${orderId}`);
      } else {
        orderDetail = await authenticatedGet(`/api/orders/${orderId}`);
      }

      setSelectedOrder({ ...orderDetail, type: order?.type });
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('[OrdersScreen] Error loading order detail:', error);
      setErrorMessage(error.message || 'Erro ao carregar detalhes do pedido');
      setShowErrorModal(true);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;

    try {
      setDeleting(true);
      console.log('[OrdersScreen] Deleting order:', selectedOrder.id);
      const { authenticatedDelete } = await import('@/utils/api');

      if (selectedOrder.type === 'print_job') {
        await authenticatedDelete(`/api/print-jobs/${selectedOrder.id}`);
      } else {
        await authenticatedDelete(`/api/orders/${selectedOrder.id}`);
      }

      // Remove from local state
      setOrders(orders.filter(o => o.id !== selectedOrder.id));
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setSelectedOrder(null);
      console.log('[OrdersScreen] Order deleted successfully');
    } catch (error: any) {
      console.error('[OrdersScreen] Error deleting order:', error);
      setErrorMessage(error.message || 'Erro ao cancelar pedido');
      setShowErrorModal(true);
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleLoginPress = () => {
    router.push('/auth');
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  const activeOrders = orders.filter(o => ['ready', 'processing'].includes(o.status));
  const historyOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayedOrders = activeTab === 'active' ? activeOrders : historyOrders;

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
              ios_icon_name="list.bullet.clipboard"
              android_material_icon_name="list-alt"
              size={64}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>Acompanhe seus Pedidos</Text>
          <Text style={styles.emptyText}>
            Faça login para visualizar o status dos seus pedidos em tempo real e acessar seu histórico.
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
        <Text style={styles.screenTitle}>Meus Pedidos</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Em Andamento</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {displayedOrders.length === 0 ? (
            <View style={styles.noOrdersContainer}>
              <IconSymbol
                ios_icon_name="doc.text.magnifyingglass"
                android_material_icon_name="search"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.noOrdersText}>Nenhum pedido encontrado</Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {displayedOrders.map((order, index) => (
                <BlurView key={index} intensity={20} tint="dark" style={styles.orderCardWrapper}>
                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View style={styles.orderIdContainer}>
                        <IconSymbol ios_icon_name="number" android_material_icon_name="tag" size={12} color={colors.secondary} />
                        <Text style={styles.orderId}>{order.id}</Text>
                      </View>
                      <Text style={styles.orderDate}>{order.date}</Text>
                    </View>

                    <Text style={styles.orderService}>{order.service}</Text>
                    <Text style={styles.orderItems}>{order.items}</Text>

                    <View style={styles.divider} />

                    <View style={styles.orderFooter}>
                      <View style={[styles.statusBadge, { borderColor: getStatusColor(order.status) + '50', backgroundColor: getStatusColor(order.status) + '15' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                          {getStatusLabel(order.status)}
                        </Text>
                      </View>
                      <Text style={styles.orderPrice}>R$ {order.price.toFixed(2).replace('.', ',')}</Text>
                    </View>
                  </View>
                </BlurView>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes do Pedido</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Serviço:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.serviceName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(selectedOrder.status)}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Valor Total:</Text>
                  <Text style={styles.detailValue}>R$ {formatPrice(selectedOrder.totalPrice)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Data:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedOrder.createdAt)}</Text>
                </View>

                {selectedOrder.notes && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Observações:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.notes}</Text>
                  </View>
                )}

                {selectedOrder.customerData && (
                  <View style={styles.customerDataSection}>
                    <Text style={styles.sectionTitle}>Dados do Cliente</Text>
                    {selectedOrder.customerData.name && (
                      <Text style={styles.customerDataText}>Nome: {selectedOrder.customerData.name}</Text>
                    )}
                    {selectedOrder.customerData.cpf && (
                      <Text style={styles.customerDataText}>CPF: {selectedOrder.customerData.cpf}</Text>
                    )}
                    {selectedOrder.customerData.rg && (
                      <Text style={styles.customerDataText}>RG: {selectedOrder.customerData.rg}</Text>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[commonStyles.largeButton, styles.deleteButton]}
                  onPress={() => setShowDeleteModal(true)}
                >
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={commonStyles.largeButtonText}>Cancelar Pedido</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={48}
              color={colors.warning}
            />
            <Text style={styles.confirmTitle}>Cancelar Pedido?</Text>
            <Text style={styles.confirmText}>
              Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonSecondary]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.confirmButtonTextSecondary}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonDanger]}
                onPress={handleDeleteOrder}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Cancelar Pedido</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <IconSymbol
              ios_icon_name="exclamationmark.circle.fill"
              android_material_icon_name="error"
              size={48}
              color={colors.error}
            />
            <Text style={styles.confirmTitle}>Erro</Text>
            <Text style={styles.confirmText}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.confirmButton, styles.confirmButtonDanger, { width: '100%' }]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderService: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
  },
  customerDataSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  customerDataText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 6,
  },
  deleteButton: {
    backgroundColor: colors.error,
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  confirmModal: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonSecondary: {
    backgroundColor: colors.border,
  },
  confirmButtonDanger: {
    backgroundColor: colors.error,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

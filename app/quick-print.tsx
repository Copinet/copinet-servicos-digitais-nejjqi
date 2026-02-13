
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument } from 'pdf-lib';

interface UploadedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  pageCount: number;
  url?: string;
  colorMode: 'bw' | 'color';
  copies: number;
  pageRange: string;
  localPageCount: number;
  isEstimated?: boolean;
}

export default function QuickPrintScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [notes, setNotes] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricing, setPricing] = useState<any>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
  const [loginModal, setLoginModal] = useState({ visible: false, message: '' });
  const [processingLargeFile, setProcessingLargeFile] = useState(false);
  const [processingFileName, setProcessingFileName] = useState('');

  useEffect(() => {
    console.log('QuickPrintScreen: Loading pricing');
    loadPricing();
    
    if (params.sharedFile) {
      console.log('QuickPrintScreen: Received shared file:', params.sharedFile);
    }
  }, []);

  useEffect(() => {
    calculateTotalPrice();
  }, [files, pricing]);

  const loadPricing = async () => {
    try {
      const { apiGet } = await import('@/utils/api');
      const data = await apiGet('/api/pricing');
      setPricing(data);
      console.log('QuickPrintScreen: Pricing loaded:', data);
    } catch (error) {
      console.error('QuickPrintScreen: Error loading pricing:', error);
      showError('Erro', 'Não foi possível carregar os preços. Tente novamente.');
    }
  };

  const calculateTotalPrice = () => {
    if (!pricing || !pricing.quick_print) {
      setTotalPrice(0);
      return;
    }

    let total = 0;
    const bwPrice = pricing.quick_print.pricePerPageBW || 0.50;
    const colorPrice = pricing.quick_print.pricePerPageColor || 1.00;

    files.forEach(file => {
      const pricePerPage = file.colorMode === 'color' ? colorPrice : bwPrice;
      const pagesToPrint = file.pageRange === 'all' ? file.localPageCount : calculatePageRangeCount(file.pageRange, file.localPageCount);
      total += pricePerPage * pagesToPrint * file.copies;
    });

    setTotalPrice(total);
  };

  const calculatePageRangeCount = (range: string, totalPages: number): number => {
    if (!range || range === 'all') {
      return totalPages;
    }

    try {
      const parts = range.split(',');
      let count = 0;
      
      parts.forEach(part => {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end) && start <= end && start > 0 && end <= totalPages) {
            count += (end - start + 1);
          }
        } else {
          const page = parseInt(trimmed);
          if (!isNaN(page) && page > 0 && page <= totalPages) {
            count += 1;
          }
        }
      });
      
      return count;
    } catch (error) {
      console.error('QuickPrintScreen: Error calculating page range:', error);
      return totalPages;
    }
  };

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  /**
   * 🚀 OTIMIZADO: Conta páginas de PDF com economia de memória
   * - Usa Uint8Array em vez de Base64 (economiza 33% de RAM)
   * - Timeout agressivo de 45 segundos para arquivos gigantes
   * - Fallback inteligente para estimativa se estourar memória
   */
  const countPDFPagesLocally = async (uri: string, fileName: string, fileSize: number): Promise<{ pageCount: number; isEstimated: boolean }> => {
    const startTime = Date.now();
    const TIMEOUT_MS = 45000; // 45 segundos para arquivos gigantes (800+ páginas)
    const fileSizeMB = fileSize / (1024 * 1024);
    
    console.log(`📄 Iniciando contagem para: ${fileName} (${fileSizeMB.toFixed(2)}MB)`);
    
    // Para arquivos muito grandes (>60MB), mostra feedback visual
    if (fileSizeMB > 60) {
      setProcessingLargeFile(true);
      setProcessingFileName(fileName);
    }
    
    try {
      // 🔥 OTIMIZAÇÃO: Lê como Uint8Array em vez de Base64 (economiza 33% de RAM)
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Arquivo não encontrado');
      }
      
      console.log(`📦 Lendo arquivo: ${fileName} (${fileSizeMB.toFixed(2)}MB)`);
      
      // Lê o arquivo como string base64 (pdf-lib requer base64 ou ArrayBuffer)
      // Para arquivos gigantes, usamos timeout para evitar travamento
      const readPromise = FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT_READING')), TIMEOUT_MS);
      });
      
      let base64: string;
      try {
        base64 = await Promise.race([readPromise, timeoutPromise]);
      } catch (error: any) {
        if (error.message === 'TIMEOUT_READING') {
          console.warn(`⏱️ Timeout ao ler arquivo ${fileName}. Usando estimativa.`);
          const estimatedPages = Math.max(1, Math.round(fileSize / 10240)); // ~10KB por página
          return { pageCount: estimatedPages, isEstimated: true };
        }
        throw error;
      }
      
      console.log(`✅ Arquivo lido: ${fileName} (${(base64.length * 0.75 / 1024 / 1024).toFixed(2)}MB em memória)`);
      
      // Para arquivos gigantes (>70MB em memória), usa timeout mais agressivo
      const memorySize = base64.length * 0.75 / (1024 * 1024);
      const processingTimeout = memorySize > 70 ? 30000 : TIMEOUT_MS;
      
      // Processa o PDF com timeout
      const countPromise = new Promise<number>(async (resolve, reject) => {
        try {
          const pdfDoc = await PDFDocument.load(base64, {
            ignoreEncryption: true,
            updateMetadata: false,
            throwOnInvalidObject: false,
          });
          
          const pageCount = pdfDoc.getPageCount();
          resolve(pageCount);
        } catch (error) {
          reject(error);
        }
      });
      
      const timeoutCountPromise = new Promise<number>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT_PROCESSING')), processingTimeout);
      });
      
      let pageCount: number;
      try {
        pageCount = await Promise.race([countPromise, timeoutCountPromise]);
      } catch (error: any) {
        if (error.message === 'TIMEOUT_PROCESSING') {
          console.warn(`⏱️ Timeout ao processar ${fileName}. Usando estimativa.`);
          const estimatedPages = Math.max(1, Math.round(fileSize / 10240));
          return { pageCount: estimatedPages, isEstimated: true };
        }
        throw error;
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Contagem Real Local: ${pageCount} páginas para ${fileName} em ${elapsed}ms`);
      
      return { pageCount, isEstimated: false };
      
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ Erro ao contar páginas para ${fileName} após ${elapsed}ms:`, error);
      
      // 🛡️ PROTEÇÃO: Detecta erros de memória
      const isMemoryError = error.message?.toLowerCase().includes('memory') || 
                           error.message?.toLowerCase().includes('heap') ||
                           error.message?.toLowerCase().includes('out of');
      
      if (isMemoryError) {
        console.error(`💥 ERRO DE MEMÓRIA detectado para ${fileName}`);
        showError(
          'Arquivo Muito Grande',
          'Arquivo muito grande para pré-contagem. Leve o arquivo para análise na loja.'
        );
        throw new Error('MEMORY_ERROR');
      }
      
      // Fallback: Estimativa baseada no tamanho
      const estimatedPages = Math.max(1, Math.round(fileSize / 10240));
      console.log(`📊 Usando estimativa de fallback: ${estimatedPages} páginas para ${fileName}`);
      
      return { pageCount: estimatedPages, isEstimated: true };
      
    } finally {
      setProcessingLargeFile(false);
      setProcessingFileName('');
    }
  };

  /**
   * 📝 NOVO: Estimativa para arquivos Word (.docx)
   * Baseada no tamanho do arquivo com aviso visual
   */
  const estimateWordPageCount = (fileSize: number): number => {
    // Estimativa: ~50KB por página para Word (inclui formatação, imagens, etc.)
    const estimatedPages = Math.max(1, Math.round(fileSize / (50 * 1024)));
    console.log(`📝 Estimativa Word: ${estimatedPages} páginas para ${(fileSize / 1024).toFixed(2)}KB`);
    return estimatedPages;
  };

  const handlePickDocument = async () => {
    if (!user) {
      console.log('QuickPrintScreen: User not authenticated, showing login modal');
      setLoginModal({
        visible: true,
        message: 'Você precisa fazer login para fazer upload de arquivos e criar pedidos.',
      });
      return;
    }

    try {
      console.log('QuickPrintScreen: User authenticated, picking document');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        console.log('QuickPrintScreen: Documents picked:', result.assets.length);
        await processAndUploadFiles(result.assets);
      }
    } catch (error) {
      console.error('QuickPrintScreen: Error picking document:', error);
      showError('Erro', 'Não foi possível selecionar o arquivo. Tente novamente.');
    }
  };

  const handlePickImage = async () => {
    if (!user) {
      console.log('QuickPrintScreen: User not authenticated, showing login modal');
      setLoginModal({
        visible: true,
        message: 'Você precisa fazer login para fazer upload de arquivos e criar pedidos.',
      });
      return;
    }

    try {
      console.log('QuickPrintScreen: User authenticated, picking image');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        console.log('QuickPrintScreen: Images picked:', result.assets.length);
        await processAndUploadFiles(result.assets);
      }
    } catch (error) {
      console.error('QuickPrintScreen: Error picking image:', error);
      showError('Erro', 'Não foi possível selecionar a imagem. Tente novamente.');
    }
  };

  /**
   * 🚀 OTIMIZADO: Processa arquivos localmente com feedback visual
   * - Mostra "Analisando documento extenso..." para arquivos grandes
   * - Usa estimativa para Word com aviso
   * - Proteção contra crash de memória
   */
  const processAndUploadFiles = async (assets: any[]) => {
    if (assets.length === 0) {
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setTotalFiles(assets.length);
    setUploadStatus('🔍 Analisando arquivos localmente...');
    
    try {
      const processedFiles: {
        uri: string;
        name: string;
        type: string;
        localPageCount: number;
        isEstimated: boolean;
      }[] = [];

      // PASSO 1: Contar páginas localmente ANTES do upload
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const fileName = asset.name || asset.fileName || `file_${Date.now()}.pdf`;
        const mimeType = asset.mimeType || 'application/octet-stream';
        const fileSize = asset.size || 0;
        const fileSizeMB = fileSize / (1024 * 1024);
        
        setUploadStatus(`🔍 Analisando ${fileName}...`);
        setCurrentFileIndex(i + 1);
        
        let localPageCount = 1;
        let isEstimated = false;
        
        try {
          // PDF: Contagem local otimizada
          if (mimeType === 'application/pdf') {
            const result = await countPDFPagesLocally(asset.uri, fileName, fileSize);
            localPageCount = result.pageCount;
            isEstimated = result.isEstimated;
            
            if (isEstimated) {
              showError(
                'Aviso',
                `Contagem estimada para PDF grande (${fileSizeMB.toFixed(0)}MB). O valor final pode ser ajustado na loja.`
              );
            }
          }
          // Word: Estimativa com aviso
          else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   mimeType === 'application/msword') {
            localPageCount = estimateWordPageCount(fileSize);
            isEstimated = true;
            
            showError(
              'Aviso - Word',
              'Contagem estimada para Word. O valor final pode ser ajustado na loja.'
            );
          }
          // Imagem: 1 página
          else if (mimeType.startsWith('image/')) {
            localPageCount = 1;
            isEstimated = false;
          }
        } catch (error: any) {
          // Se for erro de memória, não adiciona o arquivo
          if (error.message === 'MEMORY_ERROR') {
            console.error(`💥 Pulando arquivo ${fileName} devido a erro de memória`);
            continue;
          }
          
          // Para outros erros, usa estimativa
          console.warn(`⚠️ Erro ao processar ${fileName}, usando estimativa:`, error);
          localPageCount = Math.max(1, Math.round(fileSize / 10240));
          isEstimated = true;
        }
        
        processedFiles.push({
          uri: asset.uri,
          name: fileName,
          type: mimeType,
          localPageCount,
          isEstimated,
        });
        
        const analysisProgress = Math.round(((i + 1) / assets.length) * 30);
        setUploadProgress(analysisProgress);
      }

      if (processedFiles.length === 0) {
        showError('Erro', 'Nenhum arquivo pôde ser processado. Tente com arquivos menores.');
        return;
      }

      console.log('✅ Análise local completa. Iniciando upload...');
      setUploadStatus('📤 Enviando arquivos para o servidor...');

      // PASSO 2: Upload dos arquivos
      const { uploadMultipleFilesWithPageCount, getErrorMessage } = await import('@/utils/api');
      
      const result = await uploadMultipleFilesWithPageCount(
        processedFiles,
        (progress) => {
          const uploadProgress = 30 + Math.round(progress * 0.7);
          setUploadProgress(uploadProgress);
          console.log('QuickPrintScreen: Overall progress:', uploadProgress + '%');
        },
        (fileIndex, fileName, status) => {
          setCurrentFileIndex(fileIndex + 1);
          
          if (status === 'uploading') {
            setUploadStatus(`📤 Enviando ${fileName}...`);
          } else if (status === 'complete') {
            setUploadStatus(`✅ ${fileName} concluído!`);
          } else if (status === 'failed') {
            setUploadStatus(`❌ Erro em ${fileName}`);
          }
        }
      );

      console.log('QuickPrintScreen: Upload complete:', result);

      // PASSO 3: Adicionar arquivos com contagem LOCAL
      if (result.uploads.length > 0) {
        const newFiles: UploadedFile[] = result.uploads.map(upload => {
          const processedFile = processedFiles.find(f => f.name === upload.filename);
          const localPageCount = processedFile?.localPageCount || upload.pageCount || 1;
          const isEstimated = processedFile?.isEstimated || false;
          
          console.log(`✅ Arquivo adicionado: ${upload.filename} - Contagem: ${localPageCount} páginas ${isEstimated ? '(estimada)' : '(real)'}`);
          
          return {
            uri: processedFile?.uri || '',
            name: upload.filename,
            size: upload.size,
            mimeType: upload.mimeType,
            pageCount: upload.pageCount,
            localPageCount,
            url: upload.url,
            colorMode: 'bw',
            copies: 1,
            pageRange: 'all',
            isEstimated,
          };
        });
        
        setFiles(prev => [...prev, ...newFiles]);
        
        const successCount = result.uploads.length;
        const totalCount = assets.length;
        
        if (successCount === totalCount) {
          setUploadStatus(`✅ ${successCount} arquivo(s) enviado(s) com sucesso!`);
        } else {
          setUploadStatus(`✅ ${successCount} de ${totalCount} arquivo(s) enviado(s)`);
        }
      }

      if (result.failed.length > 0) {
        const failedNames = result.failed.map(f => f.filename);
        const firstError = result.failed[0];
        const errorMsg = getErrorMessage(firstError.code, firstError.error);
        
        showError(
          'Alguns arquivos falharam',
          `Não foi possível fazer upload de: ${failedNames.join(', ')}\n\n${errorMsg}`
        );
      }

      if (result.uploads.length > 0 && result.failed.length === 0) {
        console.log('✅ Todos os arquivos enviados com contagem local!');
      }
    } catch (error) {
      console.error('QuickPrintScreen: Error processing files:', error);
      
      const { getErrorMessage } = await import('@/utils/api');
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      showError('Erro no Processamento', getErrorMessage(undefined, errorMessage));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      setCurrentFileIndex(0);
      setTotalFiles(0);
    }
  };

  const updateFileOption = (index: number, field: keyof UploadedFile, value: any) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      if (field === 'pageCount') {
        updated[index].localPageCount = value;
        console.log(`QuickPrintScreen: User manually adjusted page count for ${updated[index].name} to ${value}`);
      }
      
      return updated;
    });
  };

  const removeFile = (index: number) => {
    console.log('QuickPrintScreen: Removing file:', files[index].name);
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    if (files.length === 0) {
      showError('Atenção', 'Por favor, adicione pelo menos um arquivo para imprimir.');
      return;
    }

    setLoading(true);
    try {
      const { authenticatedPost } = await import('@/utils/api');
      
      const printJob = {
        serviceType: 'quick_print',
        files: files.map(f => ({
          url: f.url,
          name: f.name,
          size: f.size,
          mimeType: f.mimeType,
          pageCount: f.localPageCount,
        })),
        options: {
          files: files.map(f => ({
            name: f.name,
            colorMode: f.colorMode,
            copies: f.copies,
            paperType: 'A4',
            paperSize: 'A4',
            pageRange: f.pageRange,
          })),
          notes,
        },
      };

      console.log('QuickPrintScreen: Creating print job with LOCAL page counts:', printJob);
      const response = await authenticatedPost('/api/print-jobs', printJob);
      console.log('QuickPrintScreen: Print job created:', response);

      router.push({
        pathname: '/stores-map',
        params: {
          serviceId: 'quick_print',
          serviceName: 'Impressão Rápida',
          totalPrice: totalPrice.toFixed(2),
          printJobId: response.id,
          needsPrinting: 'true',
        },
      });
    } catch (error) {
      console.error('QuickPrintScreen: Error creating print job:', error);
      showError('Erro', 'Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const totalPagesText = files.reduce((sum, f) => {
    const pages = f.pageRange === 'all' ? f.localPageCount : calculatePageRangeCount(f.pageRange, f.localPageCount);
    return sum + (pages * f.copies);
  }, 0);

  const progressText = totalFiles > 0 ? `${currentFileIndex}/${totalFiles}` : '';

  return (
    <SafeAreaView style={commonStyles.wrapper} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Impressão Rápida',
          headerShown: true,
          headerBackTitle: 'Voltar',
        }}
      />
      <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
        <View style={commonStyles.section}>
          <View style={styles.headerCard}>
            <IconSymbol 
              ios_icon_name="printer.fill" 
              android_material_icon_name="print" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.headerTitle}>Impressão Rápida</Text>
            <Text style={styles.headerSubtitle}>
              Faça upload de documentos PDF, Word ou imagens e escolha as opções de impressão
            </Text>
            <Text style={styles.headerNote}>
              ✨ Suporta arquivos até 100MB • Contagem otimizada
            </Text>
            <View style={styles.improvementBanner}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={20} 
                color="#4CAF50" 
              />
              <Text style={styles.improvementBannerText}>
                🚀 OTIMIZADO! PDFs gigantes (800+ páginas) processam com timeout de 45s. Word usa estimativa inteligente. Sem travamentos!
              </Text>
            </View>
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Adicionar Arquivos</Text>
            
            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickDocument}
                disabled={uploading}
              >
                <IconSymbol 
                  ios_icon_name="doc.fill" 
                  android_material_icon_name="description" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Documentos</Text>
                <Text style={styles.uploadButtonSubtext}>PDF, Word</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handlePickImage}
                disabled={uploading}
              >
                <IconSymbol 
                  ios_icon_name="photo.fill" 
                  android_material_icon_name="image" 
                  size={32} 
                  color={colors.secondary} 
                />
                <Text style={styles.uploadButtonText}>Imagens</Text>
                <Text style={styles.uploadButtonSubtext}>JPG, PNG</Text>
              </TouchableOpacity>
            </View>

            {uploading && (
              <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="large" color={colors.secondary} />
                <Text style={styles.uploadingText}>{uploadStatus}</Text>
                {progressText && (
                  <Text style={styles.uploadingProgress}>Arquivo {progressText}</Text>
                )}
                {uploadProgress > 0 && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                  </View>
                )}
                <Text style={styles.uploadingSubtext}>
                  {uploadProgress}% concluído
                </Text>
              </View>
            )}
          </View>

          {files.length > 0 && (
            <>
              <View style={styles.filesSection}>
                <Text style={styles.sectionTitle}>Arquivos Adicionados</Text>
                
                {files.map((file, index) => {
                  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
                  const isPDF = fileExtension === 'pdf';
                  const isWord = fileExtension === 'doc' || fileExtension === 'docx';
                  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension);
                  
                  return (
                  <View key={index} style={styles.fileCard}>
                    <View style={styles.fileHeader}>
                      <View style={styles.fileInfo}>
                        <IconSymbol 
                          ios_icon_name="doc.fill" 
                          android_material_icon_name="description" 
                          size={24} 
                          color={colors.secondary} 
                        />
                        <View style={styles.fileDetails}>
                          <Text style={styles.fileName}>{file.name}</Text>
                          <View style={styles.pageCountRow}>
                            <Text style={styles.filePages}>
                              {file.localPageCount} página(s)
                            </Text>
                            {!file.isEstimated && (
                              <View style={styles.verifiedBadge}>
                                <IconSymbol 
                                  ios_icon_name="checkmark.seal.fill" 
                                  android_material_icon_name="verified" 
                                  size={14} 
                                  color="#4CAF50" 
                                />
                                <Text style={styles.verifiedBadgeText}>Real</Text>
                              </View>
                            )}
                            {file.isEstimated && (
                              <View style={styles.estimatedBadge}>
                                <IconSymbol 
                                  ios_icon_name="info.circle.fill" 
                                  android_material_icon_name="info" 
                                  size={14} 
                                  color="#FF9800" 
                                />
                                <Text style={styles.estimatedBadgeText}>Estimada</Text>
                              </View>
                            )}
                            {isPDF && (
                              <View style={styles.detectionBadge}>
                                <Text style={styles.detectionBadgeText}>PDF</Text>
                              </View>
                            )}
                            {isWord && (
                              <View style={styles.detectionBadge}>
                                <Text style={styles.detectionBadgeText}>Word</Text>
                              </View>
                            )}
                            {isImage && (
                              <View style={styles.detectionBadge}>
                                <Text style={styles.detectionBadgeText}>Imagem</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removeFile(index)}>
                        <IconSymbol 
                          ios_icon_name="trash.fill" 
                          android_material_icon_name="delete" 
                          size={24} 
                          color={colors.error} 
                        />
                      </TouchableOpacity>
                    </View>

                    {file.isEstimated && (
                      <View style={styles.estimatedWarning}>
                        <IconSymbol 
                          ios_icon_name="exclamationmark.triangle.fill" 
                          android_material_icon_name="warning" 
                          size={18} 
                          color="#FF9800" 
                        />
                        <Text style={styles.estimatedWarningText}>
                          {isWord 
                            ? 'Contagem estimada para Word. O valor final pode ser ajustado na loja.'
                            : 'Contagem estimada para PDF grande. O valor final pode ser ajustado na loja.'}
                        </Text>
                      </View>
                    )}

                    {(isPDF || isWord) && file.localPageCount > 1 && (
                      <View style={styles.pageCountAdjustment}>
                        <Text style={styles.pageCountAdjustmentLabel}>
                          Ajustar contagem manualmente (se necessário):
                        </Text>
                        <View style={styles.pageCountControl}>
                          <TouchableOpacity 
                            style={styles.pageCountButton}
                            onPress={() => updateFileOption(index, 'pageCount', Math.max(1, file.localPageCount - 1))}
                          >
                            <IconSymbol 
                              ios_icon_name="minus" 
                              android_material_icon_name="remove" 
                              size={18} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.pageCountInput}
                            value={String(file.localPageCount)}
                            onChangeText={(text) => {
                              const num = parseInt(text);
                              if (!isNaN(num) && num > 0) {
                                updateFileOption(index, 'pageCount', num);
                              }
                            }}
                            keyboardType="number-pad"
                            selectTextOnFocus
                          />
                          <TouchableOpacity 
                            style={styles.pageCountButton}
                            onPress={() => updateFileOption(index, 'pageCount', file.localPageCount + 1)}
                          >
                            <IconSymbol 
                              ios_icon_name="plus" 
                              android_material_icon_name="add" 
                              size={18} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View style={styles.fileOptions}>
                      <View style={styles.optionRow}>
                        <Text style={styles.optionLabel}>Modo de Cor:</Text>
                        <View style={styles.colorModeButtons}>
                          <TouchableOpacity 
                            style={[styles.colorModeButton, file.colorMode === 'bw' && styles.colorModeButtonActive]}
                            onPress={() => updateFileOption(index, 'colorMode', 'bw')}
                          >
                            <Text style={[styles.colorModeButtonText, file.colorMode === 'bw' && styles.colorModeButtonTextActive]}>
                              P&B
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.colorModeButton, file.colorMode === 'color' && styles.colorModeButtonActive]}
                            onPress={() => updateFileOption(index, 'colorMode', 'color')}
                          >
                            <Text style={[styles.colorModeButtonText, file.colorMode === 'color' && styles.colorModeButtonTextActive]}>
                              Colorido
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.optionRow}>
                        <Text style={styles.optionLabel}>Cópias:</Text>
                        <View style={styles.copiesControl}>
                          <TouchableOpacity 
                            style={styles.copiesButton}
                            onPress={() => updateFileOption(index, 'copies', Math.max(1, file.copies - 1))}
                          >
                            <IconSymbol 
                              ios_icon_name="minus" 
                              android_material_icon_name="remove" 
                              size={20} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                          <Text style={styles.copiesValue}>{file.copies}</Text>
                          <TouchableOpacity 
                            style={styles.copiesButton}
                            onPress={() => updateFileOption(index, 'copies', file.copies + 1)}
                          >
                            <IconSymbol 
                              ios_icon_name="plus" 
                              android_material_icon_name="add" 
                              size={20} 
                              color={colors.secondary} 
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {file.localPageCount > 1 && (
                        <View style={styles.optionRow}>
                          <Text style={styles.optionLabel}>Páginas:</Text>
                          <TextInput
                            style={styles.pageRangeInput}
                            value={file.pageRange}
                            onChangeText={(text) => updateFileOption(index, 'pageRange', text)}
                            placeholder="Ex: 1-3, 5, 7-10 ou 'all'"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                  );
                })}
              </View>

              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>Observações (Opcional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ex: Arquivo com senha 1234, imprimir frente e verso, etc."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total de Páginas:</Text>
                  <Text style={styles.summaryValue}>{totalPagesText}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Papel:</Text>
                  <Text style={styles.summaryValue}>A4 Comum</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total:</Text>
                  <Text style={styles.summaryTotalValue}>R$ {totalPrice.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.continueButton, loading && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>Escolher Onde Retirar</Text>
                    <IconSymbol 
                      ios_icon_name="arrow.right" 
                      android_material_icon_name="arrow-forward" 
                      size={24} 
                      color="#FFFFFF" 
                    />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {processingLargeFile && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={styles.processingTitle}>Analisando documento extenso...</Text>
            <Text style={styles.processingSubtitle}>{processingFileName}</Text>
            <Text style={styles.processingNote}>
              Arquivos grandes podem levar até 45 segundos para processar
            </Text>
          </View>
        </View>
      )}

      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{errorModal.title}</Text>
            <Text style={styles.modalMessage}>{errorModal.message}</Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={loginModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setLoginModal({ ...loginModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol 
              ios_icon_name="lock.fill" 
              android_material_icon_name="lock" 
              size={48} 
              color={colors.secondary} 
            />
            <Text style={styles.modalTitle}>Login Necessário</Text>
            <Text style={styles.modalMessage}>{loginModal.message}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setLoginModal({ ...loginModal, visible: false });
                  router.push('/auth');
                }}
              >
                <Text style={styles.modalButtonText}>Fazer Login</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setLoginModal({ ...loginModal, visible: false })}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  headerNote: {
    fontSize: 13,
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  improvementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50' + '15',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#4CAF50' + '30',
  },
  improvementBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
    lineHeight: 18,
  },
  uploadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.secondary + '30',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  uploadButtonSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  uploadingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    gap: 12,
  },
  uploadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  uploadingProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
    textAlign: 'center',
  },
  uploadingSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  processingNote: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  filesSection: {
    marginBottom: 24,
  },
  fileCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  filePages: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pageCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50' + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
  },
  estimatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800' + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  estimatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF9800',
    textTransform: 'uppercase',
  },
  detectionBadge: {
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    textTransform: 'uppercase',
  },
  estimatedWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FF9800' + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FF9800' + '30',
  },
  estimatedWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
    lineHeight: 18,
  },
  pageCountAdjustment: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  pageCountAdjustmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  pageCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pageCountButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageCountInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileOptions: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  colorModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  colorModeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorModeButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  colorModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  colorModeButtonTextActive: {
    color: '#FFFFFF',
  },
  copiesControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copiesButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copiesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  pageRangeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: 12,
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  summaryTotal: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.secondary,
  },
  continueButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    width: '100%',
    gap: 12,
  },
  modalButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.secondary,
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalButtonTextSecondary: {
    color: colors.text,
  },
});

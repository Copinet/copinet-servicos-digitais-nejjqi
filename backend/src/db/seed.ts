import * as schema from './schema.js';
import type { App } from '../index.js';

export async function seedInitialServices(app: App) {
  try {
    // Check if services already exist
    const existingServices = await app.db.query.services.findMany();

    if (existingServices.length > 0) {
      app.logger.info({ count: existingServices.length }, 'Services already seeded, skipping');
      return;
    }

    const initialServices = [
      // Document Services
      {
        name: 'Cópia Simples de Documentos',
        description: 'Xerocópia simples de documentos em preto e branco de alta qualidade',
        category: 'documents',
        price: '0.50',
        estimatedTime: '1 dia útil',
        icon: 'document-copy',
      },
      {
        name: 'Cópia Colorida de Documentos',
        description: 'Xerocópia colorida de documentos com alta qualidade',
        category: 'documents',
        price: '1.50',
        estimatedTime: '1 dia útil',
        icon: 'document-color',
      },
      {
        name: 'Autenticação de Documentos',
        description: 'Autenticação de documentos através de cartório eletrônico',
        category: 'documents',
        price: '45.00',
        estimatedTime: '3-5 dias úteis',
        icon: 'document-check',
      },
      {
        name: 'Tradução de Documentos',
        description: 'Tradução juramentada de documentos por tradutor certificado',
        category: 'documents',
        price: '80.00',
        estimatedTime: '5-7 dias úteis',
        icon: 'translate',
      },
      {
        name: 'Digitalização de Documentos',
        description: 'Digitalização profissional de documentos com alta resolução',
        category: 'documents',
        price: '2.00',
        estimatedTime: '1-2 dias úteis',
        icon: 'scan',
      },
      {
        name: 'Encadernação de Documentos',
        description: 'Encadernação espiral, capa dura ou mole de documentos',
        category: 'documents',
        price: '15.00',
        estimatedTime: '2-3 dias úteis',
        icon: 'book',
      },

      // Printing Services
      {
        name: 'Impressão P&B A4',
        description: 'Impressão em preto e branco no formato A4',
        category: 'printing',
        price: '0.35',
        estimatedTime: '1 dia útil',
        icon: 'printer',
      },
      {
        name: 'Impressão Colorida A4',
        description: 'Impressão colorida de alta qualidade no formato A4',
        category: 'printing',
        price: '1.20',
        estimatedTime: '1 dia útil',
        icon: 'printer-color',
      },
      {
        name: 'Impressão em Banner',
        description: 'Impressão de banners em lona com até 2m x 2m',
        category: 'printing',
        price: '35.00',
        estimatedTime: '2-3 dias úteis',
        icon: 'banner',
      },
      {
        name: 'Cartões de Visita',
        description: 'Impressão de cartões de visita personalizados (250 unidades)',
        category: 'printing',
        price: '45.00',
        estimatedTime: '3-5 dias úteis',
        icon: 'id-card',
      },
      {
        name: 'Convites e Panfletos',
        description: 'Impressão de convites, panfletos e materiais promocionais',
        category: 'printing',
        price: '0.60',
        estimatedTime: '2-3 dias úteis',
        icon: 'flyer',
      },
      {
        name: 'Adesivos Personalizados',
        description: 'Adesivos personalizados em diversos tamanhos e formatos',
        category: 'printing',
        price: '25.00',
        estimatedTime: '3-4 dias úteis',
        icon: 'sticker',
      },

      // Graphics Design Services
      {
        name: 'Design de Logo',
        description: 'Criação profissional de logo com múltiplas versões',
        category: 'graphics',
        price: '250.00',
        estimatedTime: '5-7 dias úteis',
        icon: 'palette',
      },
      {
        name: 'Design de Material Marketing',
        description: 'Design de cartões, panfletos, banners e outros materiais',
        category: 'graphics',
        price: '150.00',
        estimatedTime: '3-5 dias úteis',
        icon: 'design',
      },
      {
        name: 'Edição de Fotos',
        description: 'Edição profissional de fotografias (remoção de fundo, retoque, etc)',
        category: 'graphics',
        price: '30.00',
        estimatedTime: '1-2 dias úteis',
        icon: 'image-edit',
      },
      {
        name: 'Design de Embalagem',
        description: 'Design criativo de embalagens para produtos',
        category: 'graphics',
        price: '200.00',
        estimatedTime: '5-7 dias úteis',
        icon: 'box',
      },
      {
        name: 'Criação de Apresentação',
        description: 'Design e criação de apresentações profissionais (PowerPoint, PDF)',
        category: 'graphics',
        price: '100.00',
        estimatedTime: '2-3 dias úteis',
        icon: 'presentation',
      },
    ];

    // Insert initial services
    await app.db.insert(schema.services).values(initialServices);
    app.logger.info({ count: initialServices.length }, 'Initial services seeded successfully');

    // Seed initial stores
    const initialStores = [
      {
        name: 'Copinet Centro',
        address: 'Avenida Paulista, 1000, São Paulo, SP',
        latitude: '-23.5615',
        longitude: '-46.6560',
        phone: '(11) 3088-0000',
        isOwned: true,
      },
      {
        name: 'Copinet Zona Sul',
        address: 'Rua Oscar Freire, 500, São Paulo, SP',
        latitude: '-23.5878',
        longitude: '-46.6752',
        phone: '(11) 3088-0001',
        isOwned: true,
      },
      {
        name: 'Copinet Zona Leste',
        address: 'Avenida Tatuapé, 1500, São Paulo, SP',
        latitude: '-23.5419',
        longitude: '-46.4850',
        phone: '(11) 3088-0002',
        isOwned: true,
      },
    ];

    // Check if stores already exist
    const existingStores = await app.db.query.stores.findMany();
    if (existingStores.length === 0) {
      await app.db.insert(schema.stores).values(initialStores);
      app.logger.info({ count: initialStores.length }, 'Initial stores seeded successfully');
    }
  } catch (error) {
    app.logger.error({ err: error }, 'Failed to seed initial services');
  }
}

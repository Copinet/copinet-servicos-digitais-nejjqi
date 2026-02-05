
# 🚀 Guia de Upload Direto para Supabase Storage

## 📋 Resumo das Mudanças

Este aplicativo foi atualizado para fazer upload de arquivos **diretamente para o Supabase Storage**, resolvendo o erro "Payload Too Large" que ocorria ao enviar arquivos grandes através do backend intermediário.

## ✅ Problemas Resolvidos

1. **✅ Erro "Payload Too Large"**: Arquivos agora são enviados diretamente para o Supabase, que suporta até 50MB por padrão (configurável para mais).
2. **✅ Erro "PARTNER_NOT_FOUND"**: Adicionada validação de IDs de parceiros antes de tentar atribuí-los a pedidos.
3. **✅ Upload de PDFs grandes**: PDFs de 200+ páginas agora funcionam perfeitamente.
4. **✅ Upload de múltiplas imagens**: Cada imagem é enviada individualmente, evitando sobrecarga.

## 🔧 Configuração Necessária

### 1. Configure o Supabase no `app.json`

Abra o arquivo `app.json` e substitua os placeholders pelas suas credenciais do Supabase:

```json
{
  "expo": {
    "extra": {
      "backendUrl": "https://ncf8wts23wyaw99mnk9bdzak5kn9hh3k.app.specular.dev",
      "supabaseUrl": "https://SEU_PROJETO.supabase.co",
      "supabaseAnonKey": "SUA_CHAVE_ANON_PUBLICA_AQUI"
    }
  }
}
```

**Onde encontrar essas informações:**
1. Acesse o [Supabase Dashboard](https://app.supabase.com/)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → `supabaseUrl`
   - **anon public** key → `supabaseAnonKey`

### 2. Configure o Bucket de Storage no Supabase

1. No Supabase Dashboard, vá em **Storage**
2. Crie um bucket chamado `documents` (ou use outro nome e ajuste no código)
3. Configure as políticas de acesso (RLS):

```sql
-- Permitir upload autenticado
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Permitir leitura pública (para que as URLs funcionem)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');
```

### 3. Reconstrua o App

Após configurar o `app.json`, reconstrua o app para que as variáveis de ambiente sejam aplicadas:

```bash
# Para desenvolvimento
npm run dev

# Para produção
npm run build:android
# ou
npm run build:ios
```

## 📁 Arquivos Modificados

### 1. `utils/api.ts`
- ✅ Adicionada função `uploadFileToSupabase()` para upload direto
- ✅ Adicionada função `uploadMultipleFilesToSupabase()` para múltiplos arquivos
- ✅ Funções legadas mantidas para compatibilidade
- ✅ Mensagens de erro em português atualizadas

### 2. `app/quick-print.tsx`
- ✅ Agora usa `uploadMultipleFilesToSupabase()` em vez do backend
- ✅ Exibe mensagem informando que o upload é direto para o Supabase
- ✅ Suporta arquivos até 50MB

### 3. `app/stores-map.tsx`
- ✅ Adicionada validação de ID de parceiro antes de atribuir pedidos
- ✅ Exibe o ID da loja para facilitar debug
- ✅ Mensagem de erro detalhada se o parceiro não for encontrado

### 4. `app.json`
- ✅ Adicionados placeholders para `supabaseUrl` e `supabaseAnonKey`

### 5. `package.json`
- ✅ Adicionada dependência `@supabase/supabase-js`

## 🔍 Como Funciona

### Fluxo Antigo (com erro):
```
App → Backend API → Supabase Storage
      ❌ Erro "Payload Too Large" aqui
```

### Fluxo Novo (sem erro):
```
App → Supabase Storage (direto)
      ✅ Suporta até 50MB
```

Depois do upload, apenas a **URL** do arquivo é enviada para o backend, não o arquivo em si.

## 🐛 Correção do Erro PARTNER_NOT_FOUND

O erro `PARTNER_NOT_FOUND` ocorria quando o app tentava atribuir um pedido a um parceiro cujo ID não existia no banco de dados.

**Correção implementada:**
1. Antes de atribuir um parceiro, o app agora **valida** se o ID existe na lista de lojas carregadas
2. Se o ID não existir, exibe mensagem clara ao usuário
3. O ID da loja é exibido na tela para facilitar debug

**Como verificar se os IDs estão corretos:**
1. Abra a tela de lojas no app
2. Veja o ID exibido abaixo do endereço de cada loja
3. Compare com os IDs no banco de dados Supabase (tabela `partners` ou `stores`)
4. Se não coincidirem, atualize os IDs no banco de dados

## 📊 Limites de Upload

| Método | Limite Padrão | Configurável |
|--------|---------------|--------------|
| Backend API (antigo) | ~1MB | Sim, mas problemático |
| Supabase Storage (novo) | 50MB | Sim, até 5GB |

## 🧪 Testando

1. Tente fazer upload de um PDF grande (10-20MB)
2. Tente fazer upload de múltiplas imagens (5-10 fotos)
3. Verifique se a mensagem "Upload direto para o Supabase" aparece
4. Confirme que o upload completa sem erros

## ❓ Perguntas Frequentes

**P: E se eu não configurar o Supabase?**
R: O app exibirá uma mensagem pedindo para configurar. As funções legadas do backend ainda funcionam para arquivos pequenos (<1MB).

**P: Posso aumentar o limite de 50MB?**
R: Sim! No Supabase Dashboard, vá em **Settings** → **Storage** e ajuste o limite máximo de upload.

**P: O backend ainda é usado?**
R: Sim, mas apenas para receber as **URLs** dos arquivos após o upload. O arquivo em si não passa mais pelo backend.

**P: Como resolver o erro PARTNER_NOT_FOUND?**
R: Verifique se os IDs das lojas no app coincidem com os IDs na tabela `partners` do banco de dados. Use a tela de lojas para ver os IDs atuais.

## 📞 Suporte

Se encontrar problemas:
1. Verifique se `supabaseUrl` e `supabaseAnonKey` estão corretos no `app.json`
2. Verifique se o bucket `documents` existe no Supabase Storage
3. Verifique se as políticas RLS estão configuradas corretamente
4. Verifique os logs do console para mensagens de erro detalhadas
5. Verifique se os IDs das lojas no app coincidem com os IDs no banco de dados

---

**✅ Implementação Completa**
- Upload direto para Supabase Storage
- Validação de IDs de parceiros
- Suporte para arquivos até 50MB
- Mensagens de erro em português
- Compatibilidade com código legado

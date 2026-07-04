# Guia: Como Controlar Tamanho de Arquivos de Música

## Soluções Recomendadas

### 1. **Validação de Tamanho (Frontend + Backend)**

#### No Frontend (antes do upload):
```typescript
// Limite máximo: 10 MB por arquivo
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  if (file.size > MAX_FILE_SIZE) {
    alert(`Arquivo muito grande! Tamanho máximo: 10 MB. Seu arquivo: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    e.target.value = ''; // Limpar seleção
    return;
  }
  
  // Verificar tipo de arquivo
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'];
  if (!allowedTypes.includes(file.type)) {
    alert('Formato não suportado! Use MP3, WAV ou M4A');
    e.target.value = '';
    return;
  }
  
  // Continuar com upload...
};
```

#### No Backend (API):
```typescript
// Validar tamanho antes de processar
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { error: `Arquivo muito grande. Tamanho máximo: 10 MB` },
    { status: 400 }
  );
}
```

### 2. **Compressão Automática no Servidor**

#### Opção A: Usar FFmpeg (mais complexo, melhor qualidade)
- Instalar FFmpeg no servidor Vercel (via Docker ou função serverless)
- Converter automaticamente para MP3 128-192 kbps
- Reduz tamanho em 70-80%

#### Opção B: Usar biblioteca JavaScript (mais simples)
- `audiobuffer-to-wav` + `lamejs` (compressor MP3 em JS)
- Funciona direto no Node.js sem dependências externas
- Reduz tamanho em 50-60%

### 3. **Limites por Plano/Assinatura**

```typescript
// Exemplo de limites por plano
const LIMITS = {
  free: { maxFileSize: 5 * 1024 * 1024, maxFilesPerMonth: 10 },      // 5 MB, 10 músicas/mês
  premium: { maxFileSize: 10 * 1024 * 1024, maxFilesPerMonth: 100 }, // 10 MB, 100 músicas/mês
  unlimited: { maxFileSize: 20 * 1024 * 1024, maxFilesPerMonth: -1 }  // 20 MB, ilimitado
};
```

### 4. **Mensagem Educativa para Compositor**

Adicionar no formulário de upload:
```tsx
<div className="bg-blue-900/50 border border-blue-800 rounded-lg p-4 mb-4">
  <p className="text-sm text-blue-300">
    💡 <strong>Dica:</strong> Para melhor performance, recomendamos arquivos MP3 de até 10 MB.
    Arquivos maiores serão comprimidos automaticamente.
  </p>
</div>
```

## Recomendação Final

**Implementar:**
1. ✅ Validação de tamanho (frontend + backend) - **10 MB máximo**
2. ✅ Compressão automática para MP3 192 kbps se exceder 10 MB
3. ✅ Mensagem educativa no formulário
4. ✅ Limites por plano (opcional, para futuro)

**Não precisa:**
- ❌ Pedir para compositor comprimir manualmente
- ❌ Rejeitar arquivos grandes sem tentar comprimir

Quer que eu implemente alguma dessas soluções?

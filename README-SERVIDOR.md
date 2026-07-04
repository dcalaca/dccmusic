# 🚀 Como Iniciar o Servidor DCC Music

## Método 1: Usando os arquivos .bat (Recomendado)

### Para iniciar o servidor:
1. Clique duas vezes em `iniciar-servidor.bat`
2. O servidor será iniciado automaticamente em `http://localhost:3000`
3. Para parar, pressione `CTRL+C` no terminal ou feche a janela

### Para parar o servidor:
1. Clique duas vezes em `parar-servidor.bat`
2. Todos os processos Node.js relacionados serão finalizados

## Método 2: Usando comandos npm diretamente

### Iniciar servidor de desenvolvimento:
```bash
npm run dev
```

### Parar servidor:
- Pressione `CTRL+C` no terminal onde o servidor está rodando

### Build de produção:
```bash
npm run build
npm start
```

## 📝 Notas

- O servidor roda na porta **3000** por padrão
- Se a porta 3000 estiver ocupada, o Next.js tentará usar a próxima porta disponível
- Certifique-se de ter o arquivo `.env` configurado com as variáveis necessárias
- O primeiro uso pode demorar um pouco para instalar as dependências

## 🔧 Solução de Problemas

### Porta 3000 já está em uso:
1. Execute `parar-servidor.bat` para finalizar processos antigos
2. Ou altere a porta no comando: `npm run dev -- -p 3001`

### Erro ao instalar dependências:
```bash
npm install
```

### Erro de permissão:
- Execute o terminal como Administrador
- Ou verifique se não há outros processos usando a porta

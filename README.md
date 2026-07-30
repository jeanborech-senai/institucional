# EduShare — Plataforma de Conteúdo Educacional

Plataforma web para professores compartilharem materiais didáticos organizados por curso e Unidade Curricular (UC), com painel de administração completo.

---

## Tecnologias

- **Frontend:** HTML, CSS e JavaScript puros (sem framework)
- **Backend/Auth/Storage:** [Supabase](https://supabase.com)
- **Hospedagem:** GitHub Pages

---

## Estrutura de arquivos

```
/
├── index.html          ← Login e cadastro
├── dashboard.html      ← Feed de conteúdos + filtros
├── admin.html          ← Painel administrativo
├── css/
│   ├── style.css       ← Estilos globais + login
│   ├── dashboard.css   ← Dashboard e cards
│   └── admin.css       ← Painel admin
├── js/
│   ├── supabase.js     ← Configuração do client + utilitários
│   ├── auth.js         ← Login, cadastro, logout
│   ├── dashboard.js    ← Feed, filtros, upload
│   └── admin.js        ← Gerenciar cursos, UCs, usuários
└── supabase-setup.sql  ← SQL completo para configurar o Supabase
```

---

## Passo a passo de configuração

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta/projeto
2. Anote a **Project URL** e a **anon/public key** (em Settings > API)

### 2. Configurar o banco de dados

1. No painel do Supabase, vá em **SQL Editor > New Query**
2. Cole o conteúdo do arquivo `supabase-setup.sql`
3. Clique em **Run** — isso cria todas as tabelas, políticas de segurança, o bucket de storage e dados de exemplo

### 3. Configurar as credenciais na aplicação

Abra o arquivo `js/supabase.js` e substitua as variáveis:

```javascript
const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';
```

### 4. Publicar no GitHub Pages

1. Crie um repositório no GitHub (pode ser público ou privado com Pages habilitado)
2. Faça upload de todos os arquivos mantendo a estrutura de pastas
3. Vá em **Settings > Pages**
4. Em **Source**, selecione `Deploy from a branch` → branch `main` → pasta `/root`
5. Salve — em alguns minutos o site estará em `https://seu-usuario.github.io/nome-do-repo/`

> **Importante:** Adicione a URL do seu GitHub Pages como **Site URL** em Supabase > Authentication > URL Configuration, para que os e-mails de confirmação funcionem corretamente.

### 5. Criar o primeiro administrador

1. Acesse o site e faça seu cadastro normalmente
2. No **SQL Editor** do Supabase, execute:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'seu-email@exemplo.com';
```

3. Faça logout e login novamente — o link "Painel Admin" aparecerá na sidebar

---

## Funcionalidades

### Todos os professores
- ✅ Cadastro com e-mail válido e senha segura
- ✅ Login com autenticação via Supabase Auth
- ✅ Feed de conteúdos com filtro por curso, UC e tipo
- ✅ Busca por título
- ✅ Upload de arquivos (slides, PDFs, docs, planilhas, imagens)
- ✅ Publicação de links de vídeo (YouTube, etc)
- ✅ Classificação por competências/habilidades (tags customizadas)
- ✅ Excluir seus próprios conteúdos

### Administrador
- ✅ Tudo que os professores têm
- ✅ Cadastrar, editar e ativar/desativar cursos
- ✅ Cadastrar, editar e excluir Unidades Curriculares por curso
- ✅ Ver todos os usuários e promover/rebaixar admins
- ✅ Excluir qualquer conteúdo
- ✅ Painel com estatísticas gerais

---

## Tipos de conteúdo suportados

| Ícone | Tipo           |
|-------|----------------|
| 📊    | Slide / Apresentação |
| 📄    | Documento / Doc |
| 📋    | Planilha       |
| 📕    | PDF            |
| 🖼️   | Imagem         |
| 🎥    | Vídeo (link)   |
| 📝    | Avaliação / Prova |
| ✏️    | Lista de Exercícios |
| 📁    | Outro          |

---

## Cursos e UCs pré-cadastrados

O SQL de setup já inclui:

- **TM** — Técnico em Mecânica (Desenho Técnico, Metrologia, Processos de Fabricação)
- **TE** — Técnico em Eletrotécnica (Fundamentos, Instalações, Máquinas Elétricas)
- **TDS** — Técnico em Desenvolvimento de Sistemas (Lógica, Web, BD, POO)
- **TAI** — Técnico em Automação Industrial (CLP, Sensores, IoT)

O administrador pode adicionar, editar ou desativar qualquer curso/UC pelo painel.

---

## Segurança

- Row Level Security (RLS) ativado em todas as tabelas
- Professores só editam/excluem seus próprios conteúdos
- Apenas admins gerenciam cursos, UCs e papéis de usuário
- Arquivos no Storage com políticas de acesso por usuário
- Validação de e-mail e força de senha no frontend

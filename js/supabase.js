// =============================================
// CONFIGURAÇÃO DO SUPABASE
// Substitua pelos seus dados do projeto Supabase
// =============================================
const SUPABASE_URL = 'https://gzlorfthevgkelpipnuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bG9yZnRoZXZna2VscGlwbnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDcyNTcsImV4cCI6MjEwMTAyMzI1N30.tvExxVD6rTTnG0jPlQbdUK79zTZfvyjGQpYzb5RWRgU';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bucket do Storage para uploads
const STORAGE_BUCKET = 'content-files';

// Tipos de conteúdo disponíveis
const CONTENT_TYPES = [
  { value: 'slide', label: 'Slide / Apresentação', icon: '📊' },
  { value: 'doc', label: 'Documento / Doc', icon: '📄' },
  { value: 'planilha', label: 'Planilha', icon: '📋' },
  { value: 'pdf', label: 'PDF', icon: '📕' },
  { value: 'imagem', label: 'Imagem', icon: '🖼️' },
  { value: 'video', label: 'Vídeo (link)', icon: '🎥' },
  { value: 'prova', label: 'Avaliação / Prova', icon: '📝' },
  { value: 'exercicio', label: 'Lista de Exercícios', icon: '✏️' },
  { value: 'outro', label: 'Outro', icon: '📁' },
];

// Obtém sessão atual
async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// Obtém perfil do usuário logado
async function getUserProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// Redireciona para login se não autenticado
async function requireAuth(adminRequired = false) {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  const profile = await getUserProfile(session.user.id);
  if (adminRequired && profile.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return null;
  }
  return { session, profile };
}

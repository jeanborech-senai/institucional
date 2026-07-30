-- =============================================
-- EDUSHARE — Setup completo do Supabase
-- Execute este SQL no SQL Editor do Supabase
-- Projeto > SQL Editor > New Query
-- =============================================


-- ── 1. Tabela de perfis ───────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'professor' CHECK (role IN ('professor', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Tabela de cursos ───────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  abbreviation TEXT,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Tabela de Unidades Curriculares ────────
CREATE TABLE IF NOT EXISTS public.curricular_units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  abbreviation TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Tabela de conteúdos ────────────────────
CREATE TABLE IF NOT EXISTS public.contents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.courses(id),
  uc_id         UUID NOT NULL REFERENCES public.curricular_units(id),
  title         TEXT NOT NULL,
  description   TEXT,
  content_type  TEXT NOT NULL,
  file_url      TEXT,
  file_path     TEXT,
  competencies  TEXT[] DEFAULT '{}',
  published_at  TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_units  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents          ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──────────────────────────────────
-- Qualquer usuário autenticado pode ler perfis (para exibir nome do autor)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Cada usuário pode inserir/atualizar apenas o próprio perfil
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admin pode atualizar qualquer perfil (para mudar role)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Courses ───────────────────────────────────
-- Todos autenticados podem ler
CREATE POLICY "courses_select" ON public.courses
  FOR SELECT TO authenticated USING (true);

-- Apenas admin pode inserir/atualizar/deletar
CREATE POLICY "courses_admin_write" ON public.courses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Curricular Units ──────────────────────────
CREATE POLICY "ucs_select" ON public.curricular_units
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ucs_admin_write" ON public.curricular_units
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Contents ──────────────────────────────────
-- Todos autenticados podem ler
CREATE POLICY "contents_select" ON public.contents
  FOR SELECT TO authenticated USING (true);

-- Qualquer professor pode inserir
CREATE POLICY "contents_insert" ON public.contents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = professor_id);

-- Apenas o próprio professor ou admin pode deletar
CREATE POLICY "contents_delete" ON public.contents
  FOR DELETE TO authenticated
  USING (
    auth.uid() = professor_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- =============================================
-- STORAGE BUCKET
-- Execute no SQL Editor também
-- =============================================

-- Cria o bucket para arquivos de conteúdo
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-files', 'content-files', true)
ON CONFLICT (id) DO NOTHING;

-- Permite que usuários autenticados façam upload
CREATE POLICY "storage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-files');

-- Permite leitura pública dos arquivos
CREATE POLICY "storage_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'content-files');

-- Permite que o dono ou admin delete arquivos
CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );


-- =============================================
-- TRIGGER: cria perfil automaticamente
-- quando um novo usuário se cadastra
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email,
    'professor'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================
-- DADOS INICIAIS DE EXEMPLO
-- Cursos e UCs para começar
-- =============================================

-- Cursos
INSERT INTO public.courses (name, abbreviation, active) VALUES
  ('Técnico em Mecânica',                'TM',   true),
  ('Técnico em Eletrotécnica',           'TE',   true),
  ('Técnico em Desenvolvimento de Sistemas', 'TDS', true),
  ('Técnico em Automação Industrial',    'TAI',  true)
ON CONFLICT DO NOTHING;

-- UCs para Mecânica
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Desenho Técnico Mecânico', 'DTM' FROM public.courses WHERE abbreviation = 'TM'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Metrologia e Controle de Qualidade', 'MCQ' FROM public.courses WHERE abbreviation = 'TM'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Processos de Fabricação Mecânica', 'PFM' FROM public.courses WHERE abbreviation = 'TM'
ON CONFLICT DO NOTHING;

-- UCs para Eletrotécnica
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Fundamentos de Eletricidade', 'FE' FROM public.courses WHERE abbreviation = 'TE'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Instalações Elétricas Residenciais', 'IER' FROM public.courses WHERE abbreviation = 'TE'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Máquinas Elétricas', 'ME' FROM public.courses WHERE abbreviation = 'TE'
ON CONFLICT DO NOTHING;

-- UCs para Desenvolvimento de Sistemas
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Lógica de Programação', 'LP' FROM public.courses WHERE abbreviation = 'TDS'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Desenvolvimento Web', 'DW' FROM public.courses WHERE abbreviation = 'TDS'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Banco de Dados', 'BD' FROM public.courses WHERE abbreviation = 'TDS'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Programação Orientada a Objetos', 'POO' FROM public.courses WHERE abbreviation = 'TDS'
ON CONFLICT DO NOTHING;

-- UCs para Automação Industrial
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Controladores Lógicos Programáveis', 'CLP' FROM public.courses WHERE abbreviation = 'TAI'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Sensores e Atuadores', 'SA' FROM public.courses WHERE abbreviation = 'TAI'
ON CONFLICT DO NOTHING;
INSERT INTO public.curricular_units (course_id, name, abbreviation)
SELECT id, 'Redes Industriais e IoT', 'IoT' FROM public.courses WHERE abbreviation = 'TAI'
ON CONFLICT DO NOTHING;


-- =============================================
-- COMO CRIAR O PRIMEIRO ADMIN
-- Após se cadastrar na plataforma, execute:
-- (substitua pelo seu e-mail)
-- =============================================

-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'seu-email@exemplo.com';

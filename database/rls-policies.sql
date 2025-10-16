-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - POLÍTICAS DE ESCRITURA ÚNICAMENTE
-- ============================================================================
-- Estas políticas permiten que la extensión Chrome (usuario anónimo) 
-- SOLO ESCRIBA datos en las tablas, sin poder leer datos de otros usuarios.
-- ============================================================================

-- 1) HABILITAR RLS EN TABLA app_users
-- Restricción: Solo permite INSERT (crear nuevos usuarios)
-- No permite SELECT, UPDATE, DELETE
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Política: Permitir INSERT anónimo (crear nuevos usuarios)
CREATE POLICY "Allow anonymous INSERT on app_users" ON app_users
  FOR INSERT
  WITH CHECK (true);

-- Política: DENEGAR SELECT a usuarios anónimos
CREATE POLICY "Deny anonymous SELECT on app_users" ON app_users
  FOR SELECT
  USING (false);

-- Política: DENEGAR UPDATE a usuarios anónimos
CREATE POLICY "Deny anonymous UPDATE on app_users" ON app_users
  FOR UPDATE
  USING (false);

-- Política: DENEGAR DELETE a usuarios anónimos
CREATE POLICY "Deny anonymous DELETE on app_users" ON app_users
  FOR DELETE
  USING (false);

-- ============================================================================

-- 2) HABILITAR RLS EN TABLA feedback_responses
-- Restricción: Solo permite INSERT (enviar feedback)
-- No permite SELECT, UPDATE, DELETE
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- Política: Permitir INSERT anónimo (enviar feedback)
CREATE POLICY "Allow anonymous INSERT on feedback_responses" ON feedback_responses
  FOR INSERT
  WITH CHECK (true);

-- Política: DENEGAR SELECT a usuarios anónimos
CREATE POLICY "Deny anonymous SELECT on feedback_responses" ON feedback_responses
  FOR SELECT
  USING (false);

-- Política: DENEGAR UPDATE a usuarios anónimos
CREATE POLICY "Deny anonymous UPDATE on feedback_responses" ON feedback_responses
  FOR UPDATE
  USING (false);

-- Política: DENEGAR DELETE a usuarios anónimos
CREATE POLICY "Deny anonymous DELETE on feedback_responses" ON feedback_responses
  FOR DELETE
  USING (false);

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Estas políticas aplican SOLO a usuarios anónimos (rol 'anon' en Supabase)
-- 2. La extensión Chrome usa el ANON_KEY, por lo que se considera usuario anónimo
-- 3. Las funciones RPC con SECURITY DEFINER pueden ejecutarse sin restricciones RLS
-- 4. Para administradores/authenticated users, crear políticas adicionales según sea necesario
-- 5. El ANON_KEY sigue siendo visible en el código, pero ahora está protegido por RLS
-- ============================================================================

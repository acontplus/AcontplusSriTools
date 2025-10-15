-- 0) Extensión para UUIDs aleatorios
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Tabla de usuarios (app_users)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- opcional, si más adelante usas Supabase Auth
  email text NOT NULL,
  email_lower text GENERATED ALWAYS AS (lower(email)) STORED,
  full_name text NOT NULL,
  telefono text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices y unicidad
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_users_email_lower ON app_users (email_lower);
CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON app_users (created_at DESC);

-- 2) Tabla de feedback (respuestas)
CREATE TABLE IF NOT EXISTS feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,

  comentarios text NOT NULL,
  extension_instance_id text NOT NULL,
  extension_version text NOT NULL,
  detected_types text[] NOT NULL,
  scan_timestamp timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,

  handled boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_extension_instance ON feedback_responses (extension_instance_id);

-- 3) Función RPC atómica para insertar usuario + feedback
CREATE OR REPLACE FUNCTION insert_feedback_with_user(
  p_comentarios text,
  p_extension_instance_id text,
  p_extension_version text,
  p_detected_types text[],
  p_scan_timestamp timestamptz DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_ruc text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := NULL;
  v_email_norm text;
  v_full_name_norm text;
  v_feedback_id uuid := gen_random_uuid();
BEGIN
  -- Normalizar email
  IF p_email IS NOT NULL THEN
    v_email_norm := lower(btrim(p_email));
    IF v_email_norm = '' THEN
      v_email_norm := NULL;
    END IF;
  END IF;

  v_full_name_norm := COALESCE(NULLIF(btrim(COALESCE(p_full_name, '')),''), 'Sin nombre');

  -- Crear/actualizar usuario si tiene email
  IF v_email_norm IS NOT NULL THEN
    INSERT INTO app_users (email, full_name, telefono, metadata, created_at, updated_at)
    VALUES (v_email_norm, v_full_name_norm, p_telefono, COALESCE(p_metadata, '{}'::jsonb), now(), now())
    ON CONFLICT (email_lower) DO UPDATE
      SET
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
        telefono = COALESCE(NULLIF(EXCLUDED.telefono, ''), app_users.telefono),
        metadata = app_users.metadata || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
        updated_at = now()
    RETURNING id INTO v_user_id;
  END IF;

  -- Insertar feedback
  INSERT INTO feedback_responses (
    id,
    user_id,
    comentarios,
    extension_instance_id,
    extension_version,
    detected_types,
    scan_timestamp,
    metadata,
    created_at
  ) VALUES (
    v_feedback_id,
    v_user_id,
    p_comentarios,
    p_extension_instance_id,
    p_extension_version,
    p_detected_types,
    p_scan_timestamp,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ruc', p_ruc, 'insertion_via_rpc', true),
    now()
  );

  RETURN v_feedback_id;
END;
$$;

-- 4) Permisos (para que la extensión pueda usar la función)
GRANT EXECUTE ON FUNCTION insert_feedback_with_user(
  text, text, text, text[], timestamptz, text, text, text, text, jsonb
) TO anon;

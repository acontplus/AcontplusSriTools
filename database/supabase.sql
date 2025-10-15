-- Asegúrate de tener gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- (Asumo que ya existen las tablas app_users y feedback_responses tal como las definiste.)
-- Si no, usa las definiciones que ya acordamos antes.

-- 1) Función RPC que hace upsert user (si email) y luego inserta feedback — atómica.
CREATE OR REPLACE FUNCTION insert_feedback_with_user(
  p_email text,
  p_full_name text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_ruc text DEFAULT NULL,
  p_comentarios text,
  p_extension_instance_id text,
  p_extension_version text,
  p_detected_types text[],
  p_scan_timestamp timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER   -- important: run with owner privileges so anon can call safely
AS $$
DECLARE
  v_user_id uuid := NULL;
  v_email_norm text;
  v_full_name_norm text;
  v_feedback_id uuid := gen_random_uuid();
BEGIN
  -- Normalize and validate minimal inputs
  IF p_email IS NOT NULL THEN
    v_email_norm := lower(btrim(p_email));
    IF v_email_norm = '' THEN
      v_email_norm := NULL;
    END IF;
  END IF;

  v_full_name_norm := COALESCE(NULLIF(btrim(COALESCE(p_full_name, '')),''), 'Sin nombre');

  -- 1) Upsert user only if email provided
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

  -- 2) Insert feedback linking to v_user_id (nullable)
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
    -- guardamos el ruc y otros campos en metadata por trazabilidad
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ruc', p_ruc, 'insertion_via_rpc', true),
    now()
  );

  -- 3) Devolver id del feedback
  RETURN v_feedback_id;
END;
$$;

-- 2) GRANT execute a anon (para que la extensión pueda llamar la función vía RPC)
GRANT EXECUTE ON FUNCTION insert_feedback_with_user(
  text, text, text, text, text, text, text, text[], timestamptz, jsonb
) TO anon;

-- 3) Seguridad extra: revocar depende de tu modelo. Asegúrate que la función no haga algo más potente.
-- 4) Índices recomendados (si no existen)
CREATE INDEX IF NOT EXISTS idx_feedback_extension_instance ON feedback_responses (extension_instance_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email_lower ON app_users (email_lower);

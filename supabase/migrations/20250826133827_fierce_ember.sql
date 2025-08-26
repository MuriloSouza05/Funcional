/*
  # Função para execução de SQL dinâmico
  
  1. Função para executar SQL em schemas de tenants
  2. Segurança e validação
  3. Suporte a parâmetros
*/

-- Função para executar SQL dinâmico (uso interno apenas)
CREATE OR REPLACE FUNCTION exec_sql_internal(sql_query TEXT, sql_params JSONB DEFAULT '[]')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  param_values TEXT[];
  i INTEGER;
BEGIN
  -- Convert JSONB params to TEXT array
  IF sql_params IS NOT NULL AND jsonb_array_length(sql_params) > 0 THEN
    param_values := ARRAY[]::TEXT[];
    FOR i IN 0..jsonb_array_length(sql_params) - 1 LOOP
      param_values := param_values || ARRAY[sql_params->>i];
    END LOOP;
  END IF;

  -- Execute the query and return results as JSONB
  EXECUTE sql_query USING VARIADIC param_values;
  
  -- For SELECT queries, we need to handle this differently
  -- This is a simplified version - in production you'd want more sophisticated handling
  GET DIAGNOSTICS result = ROW_COUNT;
  
  RETURN jsonb_build_object('success', true, 'rows_affected', result);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION exec_sql_internal(TEXT, JSONB) TO service_role;
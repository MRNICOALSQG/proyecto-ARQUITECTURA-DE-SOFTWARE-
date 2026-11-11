import type { PoolClient } from 'pg';

export interface ColumnSnapshot {
  name: string;
  dataType: string;
  maxLength: number | null;
  nullable: boolean;
  default: string | null;
  /** Collation explicita; null si usa la del tipo/base de datos. */
  collation: string | null;
}

export interface TableSnapshot {
  columns: ColumnSnapshot[];
  primaryKey: string[];
  /** Definiciones completas (pg_get_constraintdef) de todas las constraints de la tabla. */
  constraints: string[];
  /** pg_class.relrowsecurity. */
  rlsEnabled: boolean;
  /** pg_class.relforcerowsecurity. */
  rlsForced: boolean;
  /** Politicas de pg_policy como claves canonicas. */
  policies: string[];
}

export interface SchemaSnapshot {
  tables: Record<string, TableSnapshot>;
  indexes: string[];
  triggers: string[];
  functions: string[];
  aggregates: string[];
  extensions: string[];
  sequences: string[];
  types: string[];
  views: string[];
}

export const SCHEMA_MIGRATIONS_TABLE = 'schema_migrations';

function column(
  name: string,
  dataType: string,
  nullable: boolean,
  defaultValue: string | null,
  maxLength: number | null = null,
  collation: string | null = null
): ColumnSnapshot {
  return { name, dataType, maxLength, nullable, default: defaultValue, collation };
}

function table(
  columns: ColumnSnapshot[],
  primaryKey: string[],
  constraints: string[]
): TableSnapshot {
  return {
    columns,
    primaryKey,
    constraints,
    rlsEnabled: false,
    rlsForced: false,
    policies: [],
  };
}

// pg_get_functiondef() devuelve el cuerpo, los argumentos, el tipo de retorno,
// la volatilidad, SECURITY DEFINER/INVOKER, LEAKPROOF, STRICT, COST/ROWS y los
// SET de configuración de la función. Se normaliza el fin de línea porque
// init.sql usa CRLF y 001 usa LF.
const EXPECTED_FUNCTION_DEFINITION = `CREATE OR REPLACE FUNCTION public.create_default_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO user_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$`;

// Expected schema produced by 001_esquema_inicial.sql. It is intentionally
// explicit: baseline adoption must prove that an existing database really has
// the initial schema before recording the migration as applied.
const EXPECTED_TABLES: Record<string, TableSnapshot> = {
  users: table(
    [
      column('id', 'uuid', false, 'gen_random_uuid()'),
      column('email', 'character varying', false, null, 255),
      column('password_hash', 'character varying', false, null, 255),
      column('username', 'character varying', true, null, 100),
      column('avatar_url', 'text', true, null),
      column('created_at', 'timestamp with time zone', true, 'now()'),
      column('updated_at', 'timestamp with time zone', true, 'now()'),
    ],
    ['id'],
    ['p:PRIMARY KEY (id)', 'u:UNIQUE (email)']
  ),
  songs: table(
    [
      column('id', 'uuid', false, 'gen_random_uuid()'),
      column('user_id', 'uuid', false, null),
      column('title', 'character varying', false, null, 255),
      column('artist', 'character varying', true, "'Unknown Artist'", 255),
      column('album', 'character varying', true, "'Unknown Album'", 255),
      column('duration_seconds', 'integer', true, '0'),
      column('file_path', 'character varying', false, null, 500),
      column('cover_path', 'character varying', true, null, 500),
      column('file_size', 'bigint', true, '0'),
      column('mime_type', 'character varying', true, "'audio/mpeg'", 100),
      column('uploaded_at', 'timestamp with time zone', true, 'now()'),
    ],
    ['id'],
    [
      'f:FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      'p:PRIMARY KEY (id)',
    ]
  ),
  user_preferences: table(
    [
      column('user_id', 'uuid', false, null),
      column('background_type', 'character varying', true, "'solid'", 50),
      column('background_value', 'character varying', true, "'#131315'", 500),
      column('hud_color', 'character varying', true, "'#00dbe9'", 7),
      column('hud_opacity', 'double precision', true, '0.8'),
      column('particles_type', 'character varying', true, "'none'", 50),
      column('particles_color', 'character varying', true, "'white'", 50),
      column('particles_speed', 'double precision', true, '1'),
      column('particles_opacity', 'double precision', true, '0.5'),
      column('background_size', 'character varying', true, "'cover'", 50),
      column('background_position', 'character varying', true, "'center'", 50),
      column('background_repeat', 'character varying', true, "'no-repeat'", 50),
      column('updated_at', 'timestamp with time zone', true, 'now()'),
    ],
    ['user_id'],
    [
      'f:FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      'p:PRIMARY KEY (user_id)',
    ]
  ),
  playlists: table(
    [
      column('id', 'uuid', false, 'gen_random_uuid()'),
      column('user_id', 'uuid', false, null),
      column('name', 'character varying', false, null, 255),
      column('cover_url', 'text', true, null),
      column('created_at', 'timestamp with time zone', true, 'now()'),
    ],
    ['id'],
    [
      'f:FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      'p:PRIMARY KEY (id)',
    ]
  ),
  playlist_songs: table(
    [
      column('playlist_id', 'uuid', false, null),
      column('song_id', 'uuid', false, null),
      column('added_at', 'timestamp with time zone', true, 'now()'),
    ],
    ['playlist_id', 'song_id'],
    [
      'f:FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE',
      'f:FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE',
      'p:PRIMARY KEY (playlist_id, song_id)',
    ]
  ),
  favorites: table(
    [
      column('user_id', 'uuid', false, null),
      column('song_id', 'uuid', false, null),
      column('created_at', 'timestamp with time zone', true, 'now()'),
    ],
    ['user_id', 'song_id'],
    [
      'f:FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE',
      'f:FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      'p:PRIMARY KEY (user_id, song_id)',
    ]
  ),
  revoked_tokens: table(
    [
      column('id', 'integer', false, "nextval('revoked_tokens_id_seq')"),
      column('token_jti', 'character varying', false, null, 255),
      column('revoked_at', 'timestamp with time zone', true, 'now()'),
      column('expires_at', 'timestamp with time zone', false, null),
    ],
    ['id'],
    ['p:PRIMARY KEY (id)', 'u:UNIQUE (token_jti)']
  ),
};

interface ExpectedIndex {
  table: string;
  definition: string;
}

// pg_get_indexdef() incluye nombre, tabla, método, expresiones, columnas,
// orden, collation, opclass, columnas INCLUDE y el predicado parcial WHERE.
const EXPECTED_INDEXES: ExpectedIndex[] = [
  {
    table: 'favorites',
    definition:
      'CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (user_id, song_id)',
  },
  {
    table: 'favorites',
    definition:
      'CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id)',
  },
  {
    table: 'playlist_songs',
    definition:
      'CREATE UNIQUE INDEX playlist_songs_pkey ON public.playlist_songs USING btree (playlist_id, song_id)',
  },
  {
    table: 'playlists',
    definition:
      'CREATE INDEX idx_playlists_user_id ON public.playlists USING btree (user_id)',
  },
  {
    table: 'playlists',
    definition:
      'CREATE UNIQUE INDEX playlists_pkey ON public.playlists USING btree (id)',
  },
  {
    table: 'revoked_tokens',
    definition:
      'CREATE INDEX idx_revoked_tokens_jti ON public.revoked_tokens USING btree (token_jti)',
  },
  {
    table: 'revoked_tokens',
    definition:
      'CREATE UNIQUE INDEX revoked_tokens_pkey ON public.revoked_tokens USING btree (id)',
  },
  {
    table: 'revoked_tokens',
    definition:
      'CREATE UNIQUE INDEX revoked_tokens_token_jti_key ON public.revoked_tokens USING btree (token_jti)',
  },
  {
    table: 'songs',
    definition:
      'CREATE INDEX idx_songs_artist ON public.songs USING btree (artist)',
  },
  {
    table: 'songs',
    definition: 'CREATE INDEX idx_songs_title ON public.songs USING btree (title)',
  },
  {
    table: 'songs',
    definition:
      'CREATE INDEX idx_songs_user_id ON public.songs USING btree (user_id)',
  },
  {
    table: 'songs',
    definition: 'CREATE UNIQUE INDEX songs_pkey ON public.songs USING btree (id)',
  },
  {
    table: 'user_preferences',
    definition:
      'CREATE UNIQUE INDEX user_preferences_pkey ON public.user_preferences USING btree (user_id)',
  },
  {
    table: 'users',
    definition:
      'CREATE INDEX idx_users_email ON public.users USING btree (email)',
  },
  {
    table: 'users',
    definition:
      'CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)',
  },
  {
    table: 'users',
    definition: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)',
  },
];

const EXPECTED_TRIGGERS = [
  'users:CREATE TRIGGER trigger_create_preferences AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION create_default_preferences()|enabled=O|deferrable=false|initdeferred=false',
];

const EXPECTED_FUNCTIONS = [
  'create_default_preferences()|volatile=v|secdef=false|leakproof=false|strict=false|config=|definition=' +
    EXPECTED_FUNCTION_DEFINITION,
];

const EXPECTED_EXTENSIONS = ['pgcrypto:public', 'plpgsql:pg_catalog'];
const EXPECTED_SEQUENCES = ['public:revoked_tokens_id_seq:1:1:2147483647:1:false:1'];
const EXPECTED_TYPES: string[] = [];
const EXPECTED_VIEWS: string[] = [];
const EXPECTED_AGGREGATES: string[] = [];

export function expectedSnapshot(): SchemaSnapshot {
  return {
    tables: EXPECTED_TABLES,
    indexes: EXPECTED_INDEXES.map((index) =>
      indexKey(index.table, index.definition, true, true, true)
    ),
    triggers: [...EXPECTED_TRIGGERS],
    functions: [...EXPECTED_FUNCTIONS],
    aggregates: [...EXPECTED_AGGREGATES],
    extensions: [...EXPECTED_EXTENSIONS],
    sequences: [...EXPECTED_SEQUENCES],
    types: [...EXPECTED_TYPES],
    views: [...EXPECTED_VIEWS],
  };
}

// Strip casts and schema qualifiers so defaults compare the same regardless of
// how PostgreSQL renders them in information_schema.
export function normalizeDefault(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return value
    .replace(/::[A-Za-z_][A-Za-z0-9_ ]*(\(\d+\))?/g, '')
    .replace(/\bpublic\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// PostgreSQL may render stored definitions with CRLF when the SQL file was
// loaded from Windows. The schema comparison must not depend on that.
function normalizeDefinition(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

function indexKey(
  table: string,
  definition: string,
  valid: boolean,
  ready: boolean,
  live: boolean
): string {
  return (
    `${table}:${normalizeDefinition(definition)}|` +
    `valid=${valid}|ready=${ready}|live=${live}`
  );
}

function triggerKey(
  table: string,
  definition: string,
  enabled: string,
  deferrable: boolean,
  initDeferred: boolean
): string {
  return (
    `${table}:${normalizeDefinition(definition)}|` +
    `enabled=${enabled}|deferrable=${deferrable}|initdeferred=${initDeferred}`
  );
}

function functionKey(
  name: string,
  identityArguments: string,
  definition: string,
  volatility: string,
  securityDefiner: boolean,
  leakproof: boolean,
  strict: boolean,
  config: string[] | null
): string {
  return (
    `${name}(${identityArguments})|volatile=${volatility}|` +
    `secdef=${securityDefiner}|leakproof=${leakproof}|strict=${strict}|` +
    `config=${(config ?? []).join(',')}|definition=${normalizeDefinition(definition)}`
  );
}

function extensionKey(name: string, schema: string): string {
  return `${name}:${schema}`;
}

interface AggregateRow {
  schema_name: string;
  name: string;
  identity_arguments: string;
  aggkind: string;
  aggnumdirectargs: number;
  transfn: string;
  finalfn: string;
  combinefn: string;
  serialfn: string;
  deserialfn: string;
  mtransfn: string;
  minvtransfn: string;
  mfinalfn: string;
  aggfinalextra: boolean;
  aggmfinalextra: boolean;
  aggfinalmodify: string;
  aggmfinalmodify: string;
  sortop: string;
  transtype: string;
  transspace: number;
  mtranstype: string;
  mtransspace: number;
  initval: string | null;
  minitval: string | null;
  result_type: string;
  volatility: string;
  parallel: string;
  strict: boolean;
  security_definer: boolean;
  leakproof: boolean;
  config: string[] | null;
}

// PostgreSQL no expone un pg_get_aggregatedef(): la definicion se reconstruye a
// partir de pg_aggregate y de las propiedades de pg_proc. El esquema esperado de
// 001 no contiene agregados, por lo que cualquier agregado de usuario se rechaza.
function aggregateKey(row: AggregateRow): string {
  return [
    `${row.schema_name}.${row.name}(${row.identity_arguments})`,
    `kind=${row.aggkind}`,
    `directargs=${row.aggnumdirectargs}`,
    `transfn=${row.transfn}`,
    `finalfn=${row.finalfn}`,
    `combinefn=${row.combinefn}`,
    `serialfn=${row.serialfn}`,
    `deserialfn=${row.deserialfn}`,
    `mtransfn=${row.mtransfn}`,
    `minvtransfn=${row.minvtransfn}`,
    `mfinalfn=${row.mfinalfn}`,
    `finalextra=${row.aggfinalextra}`,
    `mfinalextra=${row.aggmfinalextra}`,
    `finalmodify=${row.aggfinalmodify}`,
    `mfinalmodify=${row.aggmfinalmodify}`,
    `sortop=${row.sortop}`,
    `transtype=${row.transtype}`,
    `transspace=${row.transspace}`,
    `mtranstype=${row.mtranstype}`,
    `mtransspace=${row.mtransspace}`,
    `initval=${String(row.initval)}`,
    `minitval=${String(row.minitval)}`,
    `result=${row.result_type}`,
    `volatile=${row.volatility}`,
    `parallel=${row.parallel}`,
    `strict=${row.strict}`,
    `secdef=${row.security_definer}`,
    `leakproof=${row.leakproof}`,
    `config=${(row.config ?? []).join(',')}`,
  ].join('|');
}

interface PolicyRow {
  policy_name: string;
  command: string;
  permissive: boolean;
  roles: string;
  using_expression: string | null;
  check_expression: string | null;
}

function policyKey(row: PolicyRow): string {
  return (
    `${row.policy_name}|cmd=${row.command}|permissive=${row.permissive}|` +
    `roles=${row.roles}|` +
    `using=${normalizeDefinition(row.using_expression ?? '')}|` +
    `check=${normalizeDefinition(row.check_expression ?? '')}`
  );
}

function sequenceKey(row: {
  schemaname: string;
  sequencename: string;
  start_value: string | number | null;
  min_value: string | number | null;
  max_value: string | number | null;
  increment_by: string | number | null;
  cycle: boolean | null;
  cache_size: string | number | null;
}): string {
  return (
    `${row.schemaname}:${row.sequencename}:` +
    `${String(row.start_value)}:${String(row.min_value)}:${String(row.max_value)}:` +
    `${String(row.increment_by)}:${String(row.cycle)}:${String(row.cache_size)}`
  );
}

export async function takeSnapshot(
  client: PoolClient,
  excludeTables: string[] = []
): Promise<SchemaSnapshot> {
  const excluded = new Set(excludeTables);

  const tableResult = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  const tableNames = tableResult.rows
    .map((row) => row.table_name)
    .filter((tableName) => !excluded.has(tableName));

  const columnResult = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    character_maximum_length: number | null;
    is_nullable: string;
    column_default: string | null;
    collation_schema: string | null;
    collation_name: string | null;
  }>(
    `SELECT table_name, column_name, data_type, character_maximum_length,
            is_nullable, column_default, collation_schema, collation_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`
  );

  const primaryKeyResult = await client.query<{ table_name: string; column_name: string }>(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position`
  );

  // Se incluyen PK, UNIQUE, FK, CHECK y EXCLUDE. La definición completa de las
  // FKs incluye ON DELETE, ON UPDATE, MATCH y diferibilidad.
  const constraintResult = await client.query<{
    table_name: string;
    constraint_type: string;
    definition: string;
  }>(
    `SELECT c.relname AS table_name,
            con.contype::text AS constraint_type,
            pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY c.relname, con.contype::text, pg_get_constraintdef(con.oid)`
  );

  const indexResult = await client.query<{
    table_name: string;
    index_name: string;
    definition: string;
    indisvalid: boolean;
    indisready: boolean;
    indislive: boolean;
  }>(
    `SELECT t.relname AS table_name,
            i.relname AS index_name,
            pg_get_indexdef(ix.indexrelid) AS definition,
            ix.indisvalid, ix.indisready, ix.indislive
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE n.nspname = 'public' AND t.relkind = 'r'
      ORDER BY t.relname, i.relname`
  );

  const triggerResult = await client.query<{
    table_name: string;
    trigger_name: string;
    definition: string;
    enabled: string;
    deferrable: boolean;
    initdeferred: boolean;
  }>(
    `SELECT c.relname AS table_name,
            tg.tgname AS trigger_name,
            pg_get_triggerdef(tg.oid) AS definition,
            tg.tgenabled::text AS enabled,
            tg.tgdeferrable AS deferrable,
            tg.tginitdeferred AS initdeferred
       FROM pg_trigger tg
       JOIN pg_class c ON c.oid = tg.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT tg.tgisinternal
      ORDER BY c.relname, tg.tgname`
  );

  // pg_get_functiondef() incluye cuerpo, argumentos, volatilidad, seguridad y
  // configuración. Se excluyen las funciones que pertenecen a extensiones.
  const functionResult = await client.query<{
    name: string;
    identity_arguments: string;
    definition: string;
    volatility: string;
    security_definer: boolean;
    leakproof: boolean;
    strict: boolean;
    config: string[] | null;
  }>(
    `SELECT p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS identity_arguments,
            pg_get_functiondef(p.oid) AS definition,
            p.provolatile::text AS volatility,
            p.prosecdef AS security_definer,
            p.proleakproof AS leakproof,
            p.proisstrict AS strict,
            p.proconfig AS config
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind IN ('f', 'p')
        AND NOT EXISTS (
          SELECT 1
            FROM pg_depend d
           WHERE d.classid = 'pg_proc'::regclass
             AND d.objid = p.oid
             AND d.deptype = 'e'
        )
      ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`
  );

  // pg_aggregate no tiene una funcion pg_get_aggregatedef(); se reconstruye la
  // clave con la identidad, las funciones de transicion/finalizacion y el resto
  // de propiedades de pg_aggregate y pg_proc.
  const aggregateResult = await client.query<AggregateRow>(
    `SELECT n.nspname AS schema_name,
            p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS identity_arguments,
            a.aggkind::text AS aggkind,
            a.aggnumdirectargs,
            a.aggtransfn::regproc::text AS transfn,
            a.aggfinalfn::regproc::text AS finalfn,
            a.aggcombinefn::regproc::text AS combinefn,
            a.aggserialfn::regproc::text AS serialfn,
            a.aggdeserialfn::regproc::text AS deserialfn,
            a.aggmtransfn::regproc::text AS mtransfn,
            a.aggminvtransfn::regproc::text AS minvtransfn,
            a.aggmfinalfn::regproc::text AS mfinalfn,
            a.aggfinalextra,
            a.aggmfinalextra,
            a.aggfinalmodify::text AS aggfinalmodify,
            a.aggmfinalmodify::text AS aggmfinalmodify,
            CASE WHEN a.aggsortop = 0 THEN ''
                 ELSE a.aggsortop::regoperator::text END AS sortop,
            a.aggtranstype::regtype::text AS transtype,
            a.aggtransspace AS transspace,
            a.aggmtranstype::regtype::text AS mtranstype,
            a.aggmtransspace AS mtransspace,
            a.agginitval AS initval,
            a.aggminitval AS minitval,
            p.prorettype::regtype::text AS result_type,
            p.provolatile::text AS volatility,
            p.proparallel::text AS parallel,
            p.proisstrict AS strict,
            p.prosecdef AS security_definer,
            p.proleakproof AS leakproof,
            p.proconfig AS config
       FROM pg_aggregate a
       JOIN pg_proc p ON p.oid = a.aggfnoid
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND NOT EXISTS (
          SELECT 1
            FROM pg_depend d
           WHERE d.classid = 'pg_proc'::regclass
             AND d.objid = p.oid
             AND d.deptype = 'e'
        )
      ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`
  );

  // RLS se compara por tabla. Las politicas se capturan con roles, comando,
  // caracter permissive y expresiones USING / WITH CHECK completas.
  const rlsResult = await client.query<{
    table_name: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    `SELECT c.relname AS table_name,
            c.relrowsecurity,
            c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname`
  );

  const policyResult = await client.query<{
    table_name: string;
    policy_name: string;
    command: string;
    permissive: boolean;
    roles: string;
    using_expression: string | null;
    check_expression: string | null;
  }>(
    `SELECT c.relname AS table_name,
            p.polname AS policy_name,
            p.polcmd::text AS command,
            p.polpermissive AS permissive,
            COALESCE((
              SELECT string_agg(
                       CASE WHEN pr.oid = 0 THEN 'PUBLIC'
                            ELSE COALESCE(r.rolname, pr.oid::text) END,
                       ',' ORDER BY pr.ord)
                FROM unnest(p.polroles) WITH ORDINALITY AS pr(oid, ord)
                LEFT JOIN pg_roles r ON r.oid = pr.oid
            ), '') AS roles,
            pg_get_expr(p.polqual, p.polrelid) AS using_expression,
            pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY c.relname, p.polname`
  );

  const extensionResult = await client.query<{ extname: string; schema_name: string }>(
    `SELECT e.extname, n.nspname AS schema_name
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
      ORDER BY e.extname`
  );

  const sequenceResult = await client.query<{
    schemaname: string;
    sequencename: string;
    start_value: string | number | null;
    min_value: string | number | null;
    max_value: string | number | null;
    increment_by: string | number | null;
    cycle: boolean | null;
    cache_size: string | number | null;
  }>(
    `SELECT schemaname, sequencename, start_value, min_value, max_value,
            increment_by, cycle, cache_size
       FROM pg_sequences
      WHERE schemaname = 'public'
      ORDER BY sequencename`
  );

  // Los tipos compuestos implícitos de cada tabla se excluyen (typrelid != 0);
  // un enum, dominio, rango o compuesto independiente adicional sí se detecta.
  const typeResult = await client.query<{ name: string; type: string }>(
    `SELECT t.typname AS name, t.typtype::text AS type
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND (t.typtype IN ('e', 'd', 'r', 'm') OR (t.typtype = 'c' AND t.typrelid = 0))
        AND NOT EXISTS (
          SELECT 1
            FROM pg_depend d
           WHERE d.classid = 'pg_type'::regclass
             AND d.objid = t.oid
             AND d.deptype = 'e'
        )
      ORDER BY t.typname`
  );

  const viewResult = await client.query<{ name: string; kind: string }>(
    `SELECT c.relname AS name, c.relkind::text AS kind
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm', 'f')
      ORDER BY c.relname`
  );

  const tables: Record<string, TableSnapshot> = {};
  for (const tableName of tableNames) {
    tables[tableName] = {
      columns: [],
      primaryKey: [],
      constraints: [],
      rlsEnabled: false,
      rlsForced: false,
      policies: [],
    };
  }

  for (const row of columnResult.rows) {
    const table = tables[row.table_name];
    if (!table) {
      continue;
    }
    table.columns.push({
      name: row.column_name,
      dataType: row.data_type,
      maxLength: row.character_maximum_length,
      nullable: row.is_nullable === 'YES',
      default: normalizeDefault(row.column_default),
      // information_schema devuelve NULL cuando la columna usa la collation
      // por defecto del tipo/base de datos; solo se materializa la explicita.
      collation:
        row.collation_name === null
          ? null
          : `${row.collation_schema ?? ''}.${row.collation_name}`,
    });
  }

  for (const row of primaryKeyResult.rows) {
    const table = tables[row.table_name];
    if (table) {
      table.primaryKey.push(row.column_name);
    }
  }

  for (const row of constraintResult.rows) {
    const table = tables[row.table_name];
    if (table) {
      table.constraints.push(
        `${row.constraint_type}:${normalizeDefinition(row.definition)}`
      );
    }
  }

  for (const row of rlsResult.rows) {
    const table = tables[row.table_name];
    if (table) {
      table.rlsEnabled = row.relrowsecurity;
      table.rlsForced = row.relforcerowsecurity;
    }
  }

  for (const row of policyResult.rows) {
    const table = tables[row.table_name];
    if (table) {
      table.policies.push(policyKey(row));
    }
  }

  return {
    tables,
    indexes: indexResult.rows
      .filter((row) => tables[row.table_name] !== undefined)
      .map((row) =>
        indexKey(
          row.table_name,
          row.definition,
          row.indisvalid,
          row.indisready,
          row.indislive
        )
      ),
    triggers: triggerResult.rows
      .filter((row) => tables[row.table_name] !== undefined)
      .map((row) =>
        triggerKey(
          row.table_name,
          row.definition,
          row.enabled,
          row.deferrable,
          row.initdeferred
        )
      ),
    functions: functionResult.rows.map((row) =>
      functionKey(
        row.name,
        row.identity_arguments,
        row.definition,
        row.volatility,
        row.security_definer,
        row.leakproof,
        row.strict,
        row.config
      )
    ),
    aggregates: aggregateResult.rows.map((row) => aggregateKey(row)),
    extensions: extensionResult.rows.map((row) =>
      extensionKey(row.extname, row.schema_name)
    ),
    sequences: sequenceResult.rows.map((row) => sequenceKey(row)),
    types: typeResult.rows.map((row) => `${row.name}:${row.type}`),
    views: viewResult.rows.map((row) => `${row.name}:${row.kind}`),
  };
}

function compareSets(
  label: string,
  actual: string[],
  expected: string[],
  problems: string[]
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const item of expectedSet) {
    if (!actualSet.has(item)) {
      problems.push(`${label} faltante: ${item}`);
    }
  }
  for (const item of actualSet) {
    if (!expectedSet.has(item)) {
      problems.push(`${label} inesperado: ${item}`);
    }
  }
}

export function compareSnapshots(actual: SchemaSnapshot, expected: SchemaSnapshot): string[] {
  const problems: string[] = [];

  const actualTables = Object.keys(actual.tables).sort();
  const expectedTables = Object.keys(expected.tables).sort();

  for (const tableName of expectedTables) {
    if (!actual.tables[tableName]) {
      problems.push(`tabla faltante: ${tableName}`);
    }
  }
  for (const tableName of actualTables) {
    if (!expected.tables[tableName]) {
      problems.push(`tabla inesperada: ${tableName}`);
    }
  }

  for (const tableName of expectedTables) {
    const actualTable = actual.tables[tableName];
    const expectedTable = expected.tables[tableName];
    if (!actualTable || !expectedTable) {
      continue;
    }

    const actualColumns = actualTable.columns.map((item) => item.name).join(',');
    const expectedColumns = expectedTable.columns.map((item) => item.name).join(',');
    if (actualColumns !== expectedColumns) {
      problems.push(
        `columnas de ${tableName} no coinciden: esperado [${expectedColumns}], encontrado [${actualColumns}]`
      );
    }

    for (const expectedColumn of expectedTable.columns) {
      const actualColumn = actualTable.columns.find((item) => item.name === expectedColumn.name);
      if (!actualColumn) {
        continue;
      }

      const prefix = `${tableName}.${expectedColumn.name}`;
      if (actualColumn.dataType !== expectedColumn.dataType) {
        problems.push(
          `${prefix}: tipo esperado ${expectedColumn.dataType}, encontrado ${actualColumn.dataType}`
        );
      }
      if (actualColumn.maxLength !== expectedColumn.maxLength) {
        problems.push(
          `${prefix}: longitud esperada ${String(expectedColumn.maxLength)}, ` +
            `encontrada ${String(actualColumn.maxLength)}`
        );
      }
      if (actualColumn.nullable !== expectedColumn.nullable) {
        problems.push(
          `${prefix}: nulabilidad esperada ${String(expectedColumn.nullable)}, ` +
            `encontrada ${String(actualColumn.nullable)}`
        );
      }
      if (actualColumn.default !== expectedColumn.default) {
        problems.push(
          `${prefix}: default esperado ${String(expectedColumn.default)}, ` +
            `encontrado ${String(actualColumn.default)}`
        );
      }
      if (actualColumn.collation !== expectedColumn.collation) {
        problems.push(
          `${prefix}: collation esperada ${String(expectedColumn.collation)}, ` +
            `encontrada ${String(actualColumn.collation)}`
        );
      }
    }

    if (actualTable.primaryKey.join(',') !== expectedTable.primaryKey.join(',')) {
      problems.push(
        `${tableName}: PK esperada [${expectedTable.primaryKey.join(',')}], ` +
          `encontrada [${actualTable.primaryKey.join(',')}]`
      );
    }

    compareSets(
      `constraint de ${tableName}`,
      actualTable.constraints,
      expectedTable.constraints,
      problems
    );

    if (actualTable.rlsEnabled !== expectedTable.rlsEnabled) {
      problems.push(
        `${tableName}: RLS esperado ${String(expectedTable.rlsEnabled)}, ` +
          `encontrado ${String(actualTable.rlsEnabled)}`
      );
    }
    if (actualTable.rlsForced !== expectedTable.rlsForced) {
      problems.push(
        `${tableName}: FORCE RLS esperado ${String(expectedTable.rlsForced)}, ` +
          `encontrado ${String(actualTable.rlsForced)}`
      );
    }
    compareSets(
      `politica de ${tableName}`,
      actualTable.policies,
      expectedTable.policies,
      problems
    );
  }

  compareSets('indice', actual.indexes, expected.indexes, problems);
  compareSets('trigger', actual.triggers, expected.triggers, problems);
  compareSets('funcion', actual.functions, expected.functions, problems);
  compareSets('agregado', actual.aggregates, expected.aggregates, problems);
  compareSets('extension', actual.extensions, expected.extensions, problems);
  compareSets('secuencia', actual.sequences, expected.sequences, problems);
  compareSets('tipo', actual.types, expected.types, problems);
  compareSets('vista o tabla foranea', actual.views, expected.views, problems);

  return problems;
}

import type { PoolClient } from 'pg';

export interface ColumnSnapshot {
  name: string;
  dataType: string;
  maxLength: number | null;
  nullable: boolean;
  default: string | null;
}

export interface ForeignKeySnapshot {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
}

export interface TableSnapshot {
  columns: ColumnSnapshot[];
  primaryKey: string[];
  foreignKeys: ForeignKeySnapshot[];
}

export interface SchemaSnapshot {
  tables: Record<string, TableSnapshot>;
  indexes: string[];
  triggers: string[];
  functions: string[];
  extensions: string[];
}

export const SCHEMA_MIGRATIONS_TABLE = 'schema_migrations';

function column(
  name: string,
  dataType: string,
  nullable: boolean,
  defaultValue: string | null,
  maxLength: number | null = null
): ColumnSnapshot {
  return { name, dataType, maxLength, nullable, default: defaultValue };
}

// Expected schema produced by 001_esquema_inicial.sql. It is intentionally
// explicit: baseline adoption must prove that an existing database really has
// the initial schema before recording the migration as applied.
const EXPECTED_TABLES: Record<string, TableSnapshot> = {
  users: {
    columns: [
      column('id', 'uuid', false, 'gen_random_uuid()'),
      column('email', 'character varying', false, null, 255),
      column('password_hash', 'character varying', false, null, 255),
      column('username', 'character varying', true, null, 100),
      column('avatar_url', 'text', true, null),
      column('created_at', 'timestamp with time zone', true, 'now()'),
      column('updated_at', 'timestamp with time zone', true, 'now()'),
    ],
    primaryKey: ['id'],
    foreignKeys: [],
  },
  songs: {
    columns: [
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
    primaryKey: ['id'],
    foreignKeys: [
      {
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  },
  user_preferences: {
    columns: [
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
    primaryKey: ['user_id'],
    foreignKeys: [
      {
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  },
  playlists: {
    columns: [
      column('id', 'uuid', false, 'gen_random_uuid()'),
      column('user_id', 'uuid', false, null),
      column('name', 'character varying', false, null, 255),
      column('cover_url', 'text', true, null),
      column('created_at', 'timestamp with time zone', true, 'now()'),
    ],
    primaryKey: ['id'],
    foreignKeys: [
      {
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  },
  playlist_songs: {
    columns: [
      column('playlist_id', 'uuid', false, null),
      column('song_id', 'uuid', false, null),
      column('added_at', 'timestamp with time zone', true, 'now()'),
    ],
    primaryKey: ['playlist_id', 'song_id'],
    foreignKeys: [
      {
        columns: ['playlist_id'],
        referencedTable: 'playlists',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
      {
        columns: ['song_id'],
        referencedTable: 'songs',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  },
  favorites: {
    columns: [
      column('user_id', 'uuid', false, null),
      column('song_id', 'uuid', false, null),
      column('created_at', 'timestamp with time zone', true, 'now()'),
    ],
    primaryKey: ['user_id', 'song_id'],
    foreignKeys: [
      {
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
      {
        columns: ['song_id'],
        referencedTable: 'songs',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  },
  revoked_tokens: {
    columns: [
      column('id', 'integer', false, "nextval('revoked_tokens_id_seq')"),
      column('token_jti', 'character varying', false, null, 255),
      column('revoked_at', 'timestamp with time zone', true, 'now()'),
      column('expires_at', 'timestamp with time zone', false, null),
    ],
    primaryKey: ['id'],
    foreignKeys: [],
  },
};

const EXPECTED_INDEXES = [
  'users:users_pkey:primary:unique:id',
  'users:users_email_key:index:unique:email',
  'users:idx_users_email:index:nonunique:email',
  'songs:songs_pkey:primary:unique:id',
  'songs:idx_songs_user_id:index:nonunique:user_id',
  'songs:idx_songs_title:index:nonunique:title',
  'songs:idx_songs_artist:index:nonunique:artist',
  'user_preferences:user_preferences_pkey:primary:unique:user_id',
  'playlists:playlists_pkey:primary:unique:id',
  'playlists:idx_playlists_user_id:index:nonunique:user_id',
  'playlist_songs:playlist_songs_pkey:primary:unique:playlist_id,song_id',
  'favorites:favorites_pkey:primary:unique:user_id,song_id',
  'favorites:idx_favorites_user_id:index:nonunique:user_id',
  'revoked_tokens:revoked_tokens_pkey:primary:unique:id',
  'revoked_tokens:revoked_tokens_token_jti_key:index:unique:token_jti',
  'revoked_tokens:idx_revoked_tokens_jti:index:nonunique:token_jti',
];

const EXPECTED_TRIGGERS = ['users:trigger_create_preferences:AFTER:INSERT:ROW'];
const EXPECTED_FUNCTIONS = ['create_default_preferences:plpgsql:trigger'];
const EXPECTED_EXTENSIONS = ['pgcrypto'];

export function expectedSnapshot(): SchemaSnapshot {
  return {
    tables: EXPECTED_TABLES,
    indexes: [...EXPECTED_INDEXES],
    triggers: [...EXPECTED_TRIGGERS],
    functions: [...EXPECTED_FUNCTIONS],
    extensions: [...EXPECTED_EXTENSIONS],
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

function foreignKeyKey(table: string, foreignKey: ForeignKeySnapshot): string {
  return (
    `${table}:${foreignKey.columns.join(',')}->` +
    `${foreignKey.referencedTable}:${foreignKey.referencedColumns.join(',')}:${foreignKey.onDelete}`
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
  }>(
    `SELECT table_name, column_name, data_type, character_maximum_length,
            is_nullable, column_default
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

  const foreignKeyResult = await client.query<{
    table_name: string;
    constraint_name: string;
    column_name: string;
    referenced_table: string;
    referenced_column: string;
    delete_rule: string;
  }>(
    `SELECT tc.table_name, tc.constraint_name, kcu.column_name,
            ccu.table_name AS referenced_table, ccu.column_name AS referenced_column,
            rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.constraint_schema = tc.constraint_schema
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.constraint_schema
       JOIN information_schema.key_column_usage ccu
         ON ccu.constraint_name = rc.unique_constraint_name
        AND ccu.constraint_schema = rc.unique_constraint_schema
        AND ccu.ordinal_position = kcu.position_in_unique_constraint
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position`
  );

  const indexResult = await client.query<{
    table_name: string;
    index_name: string;
    indisprimary: boolean;
    indisunique: boolean;
    columns: string[];
  }>(
    `SELECT t.relname AS table_name, i.relname AS index_name,
            ix.indisprimary, ix.indisunique,
            array_agg(a.attname::text ORDER BY k.ord) AS columns
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_class i ON i.oid = ix.indexrelid
       CROSS JOIN LATERAL unnest(ix.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE n.nspname = 'public' AND t.relkind = 'r'
      GROUP BY t.relname, i.relname, ix.indisprimary, ix.indisunique
      ORDER BY t.relname, i.relname`
  );

  const triggerResult = await client.query<{
    table_name: string;
    trigger_name: string;
    action_timing: string;
    event_manipulation: string;
    action_orientation: string;
  }>(
    `SELECT event_object_table AS table_name, trigger_name, action_timing,
            event_manipulation, action_orientation
       FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name, event_manipulation`
  );

  const functionResult = await client.query<{
    proname: string;
    lanname: string;
    result: string;
  }>(
    `SELECT p.proname, l.lanname, pg_get_function_result(p.oid) AS result
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = 'public' AND p.proname = 'create_default_preferences'`
  );

  const extensionResult = await client.query<{ extname: string }>(
    'SELECT extname FROM pg_extension ORDER BY extname'
  );

  const tables: Record<string, TableSnapshot> = {};
  for (const tableName of tableNames) {
    tables[tableName] = { columns: [], primaryKey: [], foreignKeys: [] };
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
    });
  }

  for (const row of primaryKeyResult.rows) {
    const table = tables[row.table_name];
    if (table) {
      table.primaryKey.push(row.column_name);
    }
  }

  const foreignKeysByTable = new Map<string, Map<string, ForeignKeySnapshot>>();
  for (const row of foreignKeyResult.rows) {
    const table = tables[row.table_name];
    if (!table) {
      continue;
    }

    let byConstraint = foreignKeysByTable.get(row.table_name);
    if (!byConstraint) {
      byConstraint = new Map<string, ForeignKeySnapshot>();
      foreignKeysByTable.set(row.table_name, byConstraint);
    }

    let foreignKey = byConstraint.get(row.constraint_name);
    if (!foreignKey) {
      foreignKey = {
        columns: [],
        referencedTable: row.referenced_table,
        referencedColumns: [],
        onDelete: row.delete_rule,
      };
      byConstraint.set(row.constraint_name, foreignKey);
    }
    foreignKey.columns.push(row.column_name);
    foreignKey.referencedColumns.push(row.referenced_column);
  }

  for (const [tableName, byConstraint] of foreignKeysByTable) {
    tables[tableName].foreignKeys.push(...byConstraint.values());
  }

  return {
    tables,
    indexes: indexResult.rows
      .filter((row) => tables[row.table_name] !== undefined)
      .map(
        (row) =>
          `${row.table_name}:${row.index_name}:${row.indisprimary ? 'primary' : 'index'}:` +
          `${row.indisunique ? 'unique' : 'nonunique'}:${row.columns.join(',')}`
      ),
    triggers: triggerResult.rows
      .filter((row) => tables[row.table_name] !== undefined)
      .map(
        (row) =>
          `${row.table_name}:${row.trigger_name}:${row.action_timing}:` +
          `${row.event_manipulation}:${row.action_orientation}`
      ),
    functions: functionResult.rows.map((row) => `${row.proname}:${row.lanname}:${row.result}`),
    extensions: extensionResult.rows.map((row) => row.extname),
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
    }

    if (actualTable.primaryKey.join(',') !== expectedTable.primaryKey.join(',')) {
      problems.push(
        `${tableName}: PK esperada [${expectedTable.primaryKey.join(',')}], ` +
          `encontrada [${actualTable.primaryKey.join(',')}]`
      );
    }

    compareSets(
      `FK de ${tableName}`,
      actualTable.foreignKeys.map((foreignKey) => foreignKeyKey(tableName, foreignKey)),
      expectedTable.foreignKeys.map((foreignKey) => foreignKeyKey(tableName, foreignKey)),
      problems
    );
  }

  compareSets('indice', actual.indexes, expected.indexes, problems);
  compareSets('trigger', actual.triggers, expected.triggers, problems);
  compareSets('funcion', actual.functions, expected.functions, problems);

  for (const extension of expected.extensions) {
    if (!actual.extensions.includes(extension)) {
      problems.push(`extension faltante: ${extension}`);
    }
  }

  return problems;
}

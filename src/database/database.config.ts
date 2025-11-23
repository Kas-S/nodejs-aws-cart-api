import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface DbSecret {
  host: string;
  port: number;
  username: string;
  password: string;
  dbname: string;
}

let cachedPassword: string | null = null;

async function getDatabasePassword(): Promise<string> {
  if (cachedPassword) {
    return cachedPassword;
  }

  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable is not set');
  }

  try {
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const command = new GetSecretValueCommand({
      SecretId: secretArn,
    });

    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret string is empty');
    }

    const secret: DbSecret = JSON.parse(response.SecretString);
    cachedPassword = secret.password;

    return secret.password;
  } catch (error) {
    console.error('Error retrieving database password:', error);
    throw new Error(
      `Failed to retrieve database password: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getDatabaseConfig(): Promise<TypeOrmModuleOptions> {
  const password = await getDatabasePassword();

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: password,
    database: process.env.DB_NAME,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production', // Auto-sync only in dev
    logging: process.env.NODE_ENV === 'development',
    ssl: {
      rejectUnauthorized: false,
    },
    extra: {
      // Connection pool settings
      max: 2, // Lambda: keep connections low
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      ssl: {
        rejectUnauthorized: false,
      },
    },
  };
}

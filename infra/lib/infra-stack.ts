import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'NestAppVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // For RDS
        },
      ],
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      'LambdaSecurityGroup',
      {
        vpc,
        description: 'Security group for Lambda function',
        allowAllOutbound: true,
      },
    );

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to PostgreSQL',
    );

    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow connections from Lambda (outside VPC)',
    );

    const dbInstance = new rds.DatabaseInstance(this, 'PostgresInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroups: [dbSecurityGroup],
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      multiAz: false,
      databaseName: 'nestappdb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      publiclyAccessible: true,
    });

    const lambdaFunction = new lambdaNodejs.NodejsFunction(
      this,
      'LambdaFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../../src/main.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment: {
          NODE_ENV: 'production',
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
          DB_HOST: dbInstance.dbInstanceEndpointAddress,
          DB_PORT: dbInstance.dbInstanceEndpointPort,
          DB_NAME: 'nestappdb',
          DB_USERNAME: 'postgres',
        },
        bundling: {
          minify: false,
          sourceMap: true,
          forceDockerBundling: false,
          externalModules: [
            'aws-sdk',
            '@nestjs/microservices',
            '@nestjs/websockets',
            'class-transformer',
            'class-validator',
            'cache-manager',
          ],
        },
      },
    );

    if (dbInstance.secret) {
      dbInstance.secret.grantRead(lambdaFunction);
      lambdaFunction.addEnvironment(
        'DB_SECRET_ARN',
        dbInstance.secret.secretArn,
      );
    }

    const api = new apigateway.RestApi(this, 'NestApi', {
      restApiName: 'Nest Service',
      description: 'This service serves a Nest.js application.',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['*'],
      },
    });

    const getLambdaIntegration = new apigateway.LambdaIntegration(
      lambdaFunction,
      {
        proxy: true,
      },
    );

    api.root.addMethod('ANY', getLambdaIntegration);

    api.root.addProxy({
      defaultIntegration: getLambdaIntegration,
      anyMethod: true,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL Endpoint',
    });

    new cdk.CfnOutput(this, 'DbPort', {
      value: dbInstance.dbInstanceEndpointPort,
      description: 'RDS PostgreSQL Port',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: dbInstance.secret?.secretArn || 'N/A',
      description: 'ARN of the Secrets Manager secret containing DB password',
    });

    new cdk.CfnOutput(this, 'DbName', {
      value: 'nestappdb',
      description: 'Database Name',
    });
  }
}

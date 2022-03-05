import process from 'process';

import dotenv from 'dotenv';

enum Environment {
  // NOTE: We don't actually have a dev environment for an app this simple.
  // Development here really just means (Local) development. AKA, actual
  // development of the app.
  Development = 'DEV',
  Production = 'PROD',
  Testing = 'TEST',
}

// TODO: We should test this guy out.
function nodeEnvToEnvironment(): Environment {
  switch (process.env.NODE_ENV) {
    case 'production':
      return Environment.Production;
    case 'development':
      return Environment.Development;
    case 'testing':
      return Environment.Testing;
    default:
      throw Error(`unrecognized environment string: ${process.env.NODE_ENV}`);
  }
}

export function applyEnvVars() {
  const env = nodeEnvToEnvironment();
  let parseResult;
  switch (env as Environment) {
    case Environment.Development:
      parseResult = dotenv.config({ path: './.env.development' });
      break;
    case Environment.Production:
      parseResult = dotenv.config({ path: './.env.production' });
      break;
    case Environment.Testing:
      parseResult = dotenv.config({ path: './.env.testing' });
      break;
    default:
      throw Error(`unrecognized environment: ${env}`);
  }

  if ('error' in parseResult) {
    throw Error(`failed to load dotenv: ${parseResult.error}`);
  }
}

export default applyEnvVars;

const port = Number(process.env.PORT);
const env = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

// TCP ports must be integers between 0–65535
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be a number between 0 and 65535');
}

if (env !== 'development' && env !== 'test' && env !== 'production') {
  throw new Error(`NODE_ENV:${env}, is not valid`);
}

if (logLevel !== 'debug' && logLevel !== 'info' && logLevel !== 'warn' && logLevel !== 'error') {
  throw new Error(`LOG_LEVEL:${logLevel}, is not valid`);
}



const config = {
  port,
  env,
  logLevel,
};

Object.freeze(config); // to make the config object immutable

export default config;

import config from '../config/index.js';

function logger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (config.logLevel === 'info') {
      console.log(
        `info:${req.method}, ${req.originalUrl}, ${res.statusCode}, ${duration}ms`,
      );
    }
  });
  next();
}

export default logger;

import http from 'http';
import https from 'https';
import { URL } from 'url';

export const checkReachability = async (url: string, timeoutMs = 3000): Promise<boolean> => {
  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = client.request(
        url,
        { method: 'HEAD', timeout: timeoutMs },
        (res) => {
          // Any response in 2xx-4xx range means the server is alive
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        }
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  } catch {
    return false;
  }
};

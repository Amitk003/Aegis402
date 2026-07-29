import http from 'http';
import https from 'https';

export const checkReachability = async (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode ? res.statusCode >= 200 && res.statusCode < 500 : false);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

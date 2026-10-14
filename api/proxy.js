/**
 * ============================================================================
 * Vercel Serverless Function - Google Apps Script Secure Reverse Proxy
 * ============================================================================
 * Endpoint: /api/proxy
 * 
 * FUNGSI:
 * 1. Menjembatani request dari frontend ke Google Apps Script tanpa hambatan CORS.
 * 2. Mengamankan URL Google Apps Script dan Secret API Token di sisi server Vercel
 *    melalui Vercel Environment Variables.
 * 3. Mendukung multi-alias environment variable (APPSCRIPT_URL, APP_SCRIPT_URL, dll).
 */

export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  // Tangani preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Baca environment variables dengan dukungan multi-alias
  const appScriptUrl = (
    process.env.APPSCRIPT_URL || 
    process.env.APP_SCRIPT_URL || 
    process.env.GOOGLE_APPS_SCRIPT_URL || 
    process.env.APPS_SCRIPT_URL || 
    process.env.NEXT_PUBLIC_APPSCRIPT_URL || 
    ''
  ).trim();

  const apiSecretToken = (
    process.env.API_SECRET_TOKEN || 
    process.env.API_TOKEN || 
    process.env.SECRET_TOKEN || 
    process.env.SECRET_KEY || 
    ''
  ).trim();

  // Endpoint Health Check / Diagnostik Vercel Proxy
  const queryAction = req.query?.action || '';
  if (queryAction === 'health') {
    return res.status(200).json({
      success: true,
      proxyStatus: 'ACTIVE',
      hasAppScriptUrl: !!appScriptUrl,
      appScriptHost: appScriptUrl ? (tryGetHostname(appScriptUrl) || 'Valid URL') : 'NOT_CONFIGURED',
      hasSecretToken: !!apiSecretToken,
      tip: !appScriptUrl 
        ? 'Environment variable APPSCRIPT_URL belum terdeteksi. Harap redeploy proyek di dashboard Vercel setelah menambahkan Environment Variable.' 
        : 'Environment Variable Vercel siap digunakan.'
    });
  }

  // Validasi konfigurasi environment
  if (!appScriptUrl) {
    return res.status(500).json({
      success: false,
      code: 'ENV_APPSCRIPT_MISSING',
      message: 'Server Error: Environment variable APPSCRIPT_URL belum aktif di Vercel. PENTING: Jika Anda baru saja menambahkannya di Vercel Settings, Anda WAJIB melakukan Redeploy (di tab Deployments > Redeploy) agar variabel masuk ke sistem.'
    });
  }

  try {
    let targetUrl = appScriptUrl;
    let fetchOptions = {
      method: req.method,
      redirect: 'follow', // Wajib untuk mengikuti 302 redirect dari Google Apps Script
      headers: {
        'Accept': 'application/json'
      }
    };

    if (req.method === 'GET') {
      const urlObj = new URL(appScriptUrl);
      // Teruskan semua query parameter dari client
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          urlObj.searchParams.set(key, value);
        }
      }
      // Sisipkan secret token secara aman dari sisi server Vercel
      if (apiSecretToken) {
        urlObj.searchParams.set('token', apiSecretToken);
      }
      targetUrl = urlObj.toString();
    } else {
      // POST Request
      fetchOptions.headers['Content-Type'] = 'application/json';
      let payload = req.body;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          payload = { raw: payload };
        }
      }
      if (typeof payload === 'object' && payload !== null) {
        if (apiSecretToken) {
          payload.token = apiSecretToken;
        }
      }
      fetchOptions.body = JSON.stringify(payload);
    }

    // Forward request ke Google Apps Script Web App
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const textData = await response.text();
      try {
        const jsonData = JSON.parse(textData);
        return res.status(response.status).json(jsonData);
      } catch (err) {
        return res.status(response.status).json({
          success: response.ok,
          raw: textData
        });
      }
    }
  } catch (error) {
    console.error('[Vercel Proxy Error]:', error);
    return res.status(502).json({
      success: false,
      message: 'Proxy Gateway Error: ' + (error.message || 'Gagal menghubungi Google Apps Script')
    });
  }
}

function tryGetHostname(urlString) {
  try {
    return new URL(urlString).hostname;
  } catch (e) {
    return null;
  }
}

// Google Sheets API 連携ユーティリティ

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];

// Google API クライアントの初期化（Vercel 環境変数から取得）
let gapi = null;
let gapiInitialized = false;

export const initGoogleAPI = async () => {
  if (gapiInitialized) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = async () => {
      try {
        gapi = window.gapi;
        await gapi.load('client:auth2', async () => {
          await gapi.client.init({
            apiKey: process.env.REACT_APP_GOOGLE_API_KEY || '',
            clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
            scope: SCOPES.join(' '),
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiInitialized = true;
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google API'));
    document.body.appendChild(script);
  });
};

// Google 認証
export const authenticateGoogle = async () => {
  try {
    if (!gapiInitialized) await initGoogleAPI();
    const auth2 = gapi.auth2.getAuthInstance();
    if (!auth2.isSignedIn.get()) {
      await auth2.signIn();
    }
    return auth2.currentUser.get().getAuthResponse().id_token;
  } catch (error) {
    console.error('Google authentication failed:', error);
    throw error;
  }
};

// Google Sheets 作成
export const createGoogleSheet = async (sheetName = 'メダル予想アプリ_データ') => {
  try {
    if (!gapiInitialized) await initGoogleAPI();

    const response = await gapi.client.sheets.spreadsheets.create({
      properties: {
        title: `${sheetName}_${new Date().toISOString().split('T')[0]}`,
      },
      sheets: [
        {
          properties: {
            title: 'レース記録',
            sheetId: 0,
          },
        },
      ],
    });

    const spreadsheetId = response.result.spreadsheetId;

    // ヘッダー行を追加
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'レース記録!A1:H1',
      valueInputOption: 'RAW',
      resource: {
        values: [
          ['日付', '馬番', '馬名', '印', '調子', '枠', 'スコア', '着順'],
        ],
      },
    });

    return spreadsheetId;
  } catch (error) {
    console.error('Failed to create Google Sheet:', error);
    throw error;
  }
};

// Google Sheets にデータを保存
export const saveToGoogleSheets = async (spreadsheetId, races) => {
  try {
    if (!gapiInitialized) await initGoogleAPI();

    const rows = races.flatMap((race) =>
      race.horses.map((horse) => {
        const result = race.results.find((r) => r.number === horse.number);
        return [
          race.date,
          horse.number,
          horse.name,
          horse.mark,
          horse.condition === 'up' ? '↑' : horse.condition === 'down' ? '↓' : '→',
          horse.frame,
          horse.predictedScore?.toFixed(2) || '0.00',
          result?.placement || '-',
        ];
      })
    );

    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'レース記録!A2',
      valueInputOption: 'RAW',
      resource: {
        values: rows,
      },
    });

    return spreadsheetId;
  } catch (error) {
    console.error('Failed to save to Google Sheets:', error);
    throw error;
  }
};

// Google Sheets からデータを読み込み
export const loadFromGoogleSheets = async (spreadsheetId) => {
  try {
    if (!gapiInitialized) await initGoogleAPI();

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'レース記録!A2:H',
    });

    const rows = response.result.values || [];
    return rows.map((row) => ({
      date: row[0],
      number: row[1],
      name: row[2],
      mark: row[3],
      condition: row[4] === '↑' ? 'up' : row[4] === '↓' ? 'down' : 'normal',
      frame: parseInt(row[5]),
      score: parseFloat(row[6]),
      placement: row[7] === '-' ? null : parseInt(row[7]),
    }));
  } catch (error) {
    console.error('Failed to load from Google Sheets:', error);
    throw error;
  }
};

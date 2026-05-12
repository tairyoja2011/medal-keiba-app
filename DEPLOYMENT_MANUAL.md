# メダル予想アプリ Vercel デプロイメント マニュアル

## 問題点の整理

### 1. なぜエラーが発生したのか

#### git index lock の問題
- **原因**：Windows と Linux 環境の不一致
- Cowork の bash は Linux 環境、git は Windows で実行するため、ファイルロック解除ができなかった
- **解決方法**：PowerShell（Windows）で git コマンドを実行

#### 環境変数が Vercel に設定されていなかった
- **原因**：`.env.local` ファイルはローカル開発用。Vercel（本番環境）は別途設定が必要
- ローカルで動作しても、Vercel では動作しない
- **結果**：「Error: Forbidden」エラー → Google API 認証失敗

#### GitHub リポジトリ接続の問題
- **原因**：既存の Vercel プロジェクトが古い GitHub リポジトリ情報を保持していた
- Redeploy のたびに「The provided GitHub repository can't be found」エラー
- **解決方法**：新しい Vercel プロジェクトを作成（既存プロジェクトのキャッシュ問題を回避）

---

## デプロイメント手順（今後の標準プロセス）

### ステップ 1：ローカルコードの確認（PowerShell）

```powershell
cd "C:\Users\PC1\Desktop\claude cowork\メダル予想アプリ"

# git ステータス確認
git status

# 変更をステージング
git add .

# コミット（必要な場合）
git commit -m "feature description"

# GitHub にプッシュ
git push origin main
```

**重要**：必ず PowerShell を使用してください（Cowork の bash は避ける）

---

### ステップ 2：Vercel に新しいプロジェクトを作成

#### 2-1. Vercel ダッシュボードを開く
- https://vercel.com/dashboard

#### 2-2. 「+ New Project」をクリック

#### 2-3. GitHub リポジトリをインポート
- 「Import Git Repository」セクション
- `tairyoja2011` アカウントを選択
- `medal-keiba-app` リポジトリを選択
- **Import** ボタンをクリック

#### 2-4. プロジェクト設定
```
Vercel Team: tairyoja2011's projects (Hobby)
Project Name: medal-keiba-app-XXXX（自動生成でOK）
Application Preset: Vite ✓
Root Directory: ./ ✓
```

#### 2-5. Environment Variables を設定（重要！）

「Environment Variables」セクションを展開して、以下の2つを追加：

| Key | Value |
|-----|-------|
| `REACT_APP_GOOGLE_API_KEY` | `AIzaSyDvFV4oUiwXYbsd9YPZ_kohclpcu5bA3vk` |
| `REACT_APP_GOOGLE_CLIENT_ID` | `210696637249-r5qub9v0ih2dh0nhbgirpvukpl3mvrjh.apps.googleusercontent.com` |

**設定時の注意**：
- 両方の変数を設定しないと、Google Sheets 連携機能が「Error: Forbidden」になる
- Environments を「Production and Preview」に設定

#### 2-6. デプロイ実行
- **「Deploy」ボタンをクリック**
- ビルド完了まで待つ（2～3分）
- 完了後、自動的にプロダクション URL が生成されます

---

### ステップ 3：テスト

デプロイ完了後、以下をテストしてください：

#### 3-1. アプリ起動
- Vercel の Production URL にアクセス
- 例：`https://medal-keiba-app-xxxx.vercel.app`

#### 3-2. Google Sheets 連携機能
1. 画面右上の **⚙️ 設定** ボタンをクリック
2. **「🔗 Google Sheet を作成」** ボタンが見える？
3. クリック → Google 認証画面が出る？

#### 3-3. 傾向分析表示
1. 競馬画像をアップロード
2. OCR 認識後、データ確認画面に進む
3. **「📊 馬番ごとの着順確率」** テーブルが表示される？

---

## トラブルシューティング

### 「Error: Forbidden」が表示される
**原因**：環境変数が設定されていない
**解決**：
1. Vercel Settings → Environment Variables を確認
2. 2つの環境変数が設定されているか確認
3. 設定されていなければ追加して、Redeploy

### 「The provided GitHub repository can't be found」エラー
**原因**：既存プロジェクトの GitHub キャッシュ問題
**解決**：
- 既存プロジェクトを削除して、新しいプロジェクトを作成
- **このマニュアルのステップ 2 を実行**

### デプロイが古いコード（May 7）を表示
**原因**：自動デプロイが動作していない、または古いプロジェクトを使用中
**解決**：
1. 新しい Vercel プロジェクトを作成（このマニュアルのステップ 2）
2. GitHub に push したコードが必ず最新であることを確認

### Google Sheets 作成ボタンが見えない
**原因**：以下のいずれか
- 環境変数が設定されていない
- ブラウザキャッシュが古い
**解決**：
1. Vercel の環境変数を確認
2. ブラウザの「F5」リロード、または Ctrl+Shift+Delete でキャッシュクリア

---

## 重要なポイント（次回以降）

### ローカル環境 vs. 本番環境（Vercel）

| 項目 | ローカル | Vercel |
|-----|---------|--------|
| 環境変数ファイル | `.env.local` | Settings → Environment Variables |
| ビルド | `npm run dev` | 自動ビルド |
| デバッグ | ブラウザコンソール | Vercel Logs タブ |

### デプロイの流れ
```
PowerShell で git push
    ↓
GitHub に push 成功
    ↓
Vercel が自動検知（新規プロジェクトなら）
    ↓
自動ビルド開始（2～3分）
    ↓
デプロイ完了
    ↓
Production URL で確認
```

### 環境変数の管理
- **ローカル開発**：`.env.local`（git ignore されている）
- **Vercel 本番環境**：Settings → Environment Variables
- **この2つは別物！** 本番環境で動作させるには、Vercel に環境変数を設定する必要があります

---

## よくある質問

### Q: なぜ PowerShell を使う？
**A**：git は Windows ファイルシステムで動作します。Cowork の bash（Linux 環境）では、ファイルロックの削除などで権限エラーが発生します。

### Q: 何度も新しいプロジェクトを作成してもいい？
**A**：はい。古いプロジェクトのキャッシュ問題を回避できます。ただし、以前のプロダクション URL は変わります。

### Q: Environment Variables は何のため？
**A**：Vercel で実行するときに必要な認証情報です。Google Sheets API を使うには、API キーとクライアント ID が必須です。

---

## チェックリスト

デプロイ前に確認：

- [ ] PowerShell で `git push origin main` 実行済み
- [ ] GitHub にコードが push されているか確認（GitHub.com で repo を見る）
- [ ] Vercel の新規プロジェクト作成画面を開いた
- [ ] `medal-keiba-app` リポジトリを選択した
- [ ] Environment Variables の2つを設定した
- [ ] Deploy ボタンをクリックした
- [ ] ビルド完了（Vercel Logs で「Deployment successful」を確認）
- [ ] Production URL でテスト実行

---

**最後に**：このマニュアルを参考に、次回から自信を持ってデプロイできるようになります！

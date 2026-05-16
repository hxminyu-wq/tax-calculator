# 稅務決策試算系統 — 部署說明

## 架構概覽

```
使用者瀏覽器
    │
    ▼
Vercel (React SPA)
    └── public/latest.json  ← 稅率資料庫（已內含，隨專案一起部署）
```

- **前端**：Vite + React + Tailwind CSS，部署在 Vercel
- **資料**：`public/latest.json` 隨 build 一起打包，網頁啟動時自動 fetch `/latest.json`
- **無後端、無資料庫、無環境變數、無驗證**：完全靜態
- **使用者隱私**：所有輸入均為即時計算，完全不儲存

---

## 部署到 Vercel

### 方法 A：Vercel CLI

```bash
npm i -g vercel
cd tax-calculator
npm install
vercel
```

依提示操作即可，**不需要設定任何環境變數**。

### 方法 B：GitHub + Vercel 自動部署

1. 將此專案推送到 GitHub repo
2. 前往 [vercel.com](https://vercel.com) → New Project → 匯入該 repo
3. Framework Preset 選 **Vite**
4. 直接點 **Deploy**，無需設定任何環境變數

---

## 本機開發

```bash
npm install
npm run dev
```

---

## 更新稅率資料庫

將新的 JSON 覆蓋取代 `public/latest.json`，重新 push 到 GitHub，
Vercel 自動重新部署。

---

## 專案結構

```
tax-calculator/
├── public/
│   └── latest.json      # 稅率資料庫（直接隨專案部署）
├── src/
│   ├── App.jsx          # 主元件（試算邏輯 + UI）
│   ├── main.jsx         # React 進入點
│   └── index.css        # Tailwind 設定
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json          # SPA routing 設定
└── package.json
```

---

## 依賴套件

| 套件 | 用途 |
|---|---|
| `react` / `react-dom` | UI 框架 |
| `lucide-react` | 圖示 |
| `html2canvas` | 一鍵截圖匯出報告 PNG |
| `tailwindcss` | 樣式 |
| `vite` | 打包工具 |

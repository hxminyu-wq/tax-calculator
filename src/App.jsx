import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import {
  Search, DollarSign, CheckCircle2, AlertTriangle,
  RefreshCw, BookOpen, Scale, Building2,
  Camera, PlusCircle, ThumbsUp, AlertCircle, Loader2,
} from 'lucide-react';

// ─────────────────────────────────────────────
// JSON 解析引擎
// ─────────────────────────────────────────────
function processJSONData(rawJson) {
  const rawRecords = [];
  const visited = new Set();
  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) { node.forEach(traverse); }
    else {
      const isRecord =
        node.expanded_review_net_profit_rate !== undefined ||
        node.income_standard !== undefined ||
        node.gross_margin_rate !== undefined ||
        node.expense_rate !== undefined ||
        node.net_profit_rate !== undefined ||
        node.rates !== undefined ||
        node['擴大書審純益率'] !== undefined ||
        node['所得額標準'] !== undefined;
      if (isRecord) rawRecords.push(node);
      Object.values(node).forEach(traverse);
    }
  };
  traverse(rawJson);
  if (rawRecords.length === 0) throw new Error('找不到包含利潤率的數據。');

  const fmt = (val) => {
    const s = String(val).replace(/[\n\r]/g, '').trim();
    if (!s || s === '-' || s === '－' || s === 'null' || s === 'undefined') return '－';
    return s;
  };
  const getRate = (r, ...keys) => {
    if (r.rates && typeof r.rates === 'object') {
      for (const k of keys) {
        if (r.rates[k] != null) return typeof r.rates[k] === 'object' ? r.rates[k].raw : r.rates[k];
      }
    }
    for (const k of keys) {
      if (r[k] != null) return typeof r[k] === 'object' ? r[k].raw : r[k];
    }
    return '－';
  };

  let processed = rawRecords.map((r) => {
    let codeVal = '';
    for (const k of ['code', 'standard_code', 'industry_code', '代號', '標準代號', 'id']) {
      if (r[k] != null) { codeVal = String(r[k]).trim(); break; }
    }
    if (!codeVal) for (const k in r)
      if (typeof r[k] === 'string' && r[k].trim().match(/^\d{4}/)) { codeVal = r[k].trim(); break; }

    let nameVal = '';
    for (const k of ['name', 'industry_name', 'industry_category', '名稱', '小業別', '行業名稱', 'title']) {
      if (r[k] != null) { nameVal = String(r[k]); break; }
    }
    if (!nameVal) for (const k in r)
      if (typeof r[k] === 'string' && r[k].trim() !== codeVal && isNaN(parseInt(r[k], 10)) && r[k].length > 1) {
        nameVal = r[k].trim(); break;
      }

    return {
      code: codeVal || '無代碼',
      name: (nameVal || '未命名行業').replace(/[\n\r]/g, '').trim(),
      expand: fmt(getRate(r, 'expanded_review_net_profit_rate', 'expand', '擴大書審純益率', '擴大書審')),
      income: fmt(getRate(r, 'income_standard', 'income', '所得額標準')),
      margin: fmt(getRate(r, 'gross_margin_rate', 'margin', '毛利率')),
      expense: fmt(getRate(r, 'expense_rate', 'expense', '費用率')),
      net: fmt(getRate(r, 'net_profit_rate', 'net', '淨利率')),
    };
  });
  processed = processed.filter((r) => r.code && r.code.match(/^\d/));
  if (processed.length === 0) throw new Error('提取標準代號失敗。');
  return processed;
}

// ─────────────────────────────────────────────
// 色盤（純 inline style 用）
// ─────────────────────────────────────────────
const C = {
  navy: '#1e3a8a',
  blue: '#1d4ed8',
  indigo: '#4338ca',
  teal: '#0f766e',
  purple: '#7c3aed',
  emerald: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  slate9: '#0f172a',
  slate8: '#1e293b',
  slate7: '#334155',
  slate6: '#475569',
  slate5: '#64748b',
  slate4: '#94a3b8',
  slate3: '#cbd5e1',
  slate2: '#e2e8f0',
  slate1: '#f1f5f9',
  slate0: '#f8fafc',
  white: '#ffffff',
};

// ─────────────────────────────────────────────
// 品牌 Logo（純 inline style，截圖安全）
// ─────────────────────────────────────────────
function BrandLogo({ iconSize = 24, titleSize = 22, subtitleSize = 10 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        backgroundColor: C.navy, borderRadius: 12, padding: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(30,58,138,0.3)',
      }}>
        <Building2 style={{ width: iconSize, height: iconSize, color: C.white }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: titleSize, fontWeight: 900, color: C.navy, letterSpacing: '0.1em', lineHeight: 1 }}>
          源信
        </span>
        <span style={{ fontSize: subtitleSize, fontWeight: 700, color: C.slate4, letterSpacing: '0.2em', textTransform: 'uppercase', lineHeight: 1 }}>
          記帳士事務所
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 截圖報告：全部 inline style，零 Tailwind
// ─────────────────────────────────────────────
function PrintReport({ industry, businessType, operatingMonths, revenueNum, otherIncomeNum, auditedProfitNum,
  auditedMargin, resultAudited, resultA, resultB, resultC, compareData, compareMethod, formatCurrency }) {

  const cardDefs = [
    {
      title: '查帳申報', subtitle: '實際收集合規憑證',
      accent: C.indigo, bg: '#eef2ff', textAccent: C.indigo,
      income: resultAudited.taxableIncome, final: resultAudited.finalValue,
      badge: `淨利 ${auditedMargin}%`, showRevenue: true,
    },
    compareMethod === 'expand' && resultA ? {
      title: 'A. 擴大書審', subtitle: '1,000萬以下',
      rate: industry.expand, accent: C.blue, bg: '#eff6ff', textAccent: C.blue,
      income: resultA.taxableIncome, final: resultA.finalValue,
    } : null,
    (compareMethod === 'expand' || compareMethod === 'income') && resultB ? {
      title: 'B. 所得額標準', subtitle: '1,000萬以上',
      rate: industry.income, accent: C.emerald, bg: '#ecfdf5', textAccent: C.emerald,
      income: resultB.taxableIncome, final: resultB.finalValue,
    } : null,
    resultC ? {
      title: 'C. 同業標準', subtitle: '高風險查核',
      rate: industry.net, accent: C.purple, bg: '#f5f3ff', textAccent: C.purple,
      income: resultC.taxableIncome, final: resultC.finalValue,
    } : null,
  ].filter(Boolean);

  const termLabel = businessType === 'company' ? '營所稅稅額' : '個人營利所得';

  return (
    <div style={{
      width: 900, backgroundColor: C.slate0, fontFamily: "'PingFang TC','Microsoft JhengHei','Noto Sans TC',sans-serif",
      padding: 32, boxSizing: 'border-box',
    }}>
      {/* ── Header card ── */}
      <div style={{
        backgroundColor: C.white, borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20,
      }}>
        <div style={{ backgroundColor: C.navy, height: 6 }} />
        <div style={{ padding: '20px 28px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <BrandLogo iconSize={26} titleSize={24} subtitleSize={10} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>稅務決策試算報告</div>
              <div style={{ fontSize: 11, color: C.slate4, marginTop: 3 }}>AI 稅務試算工具</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.slate2}`, paddingTop: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.slate8, marginBottom: 4 }}>
              {industry.name}
              <span style={{ fontSize: 13, fontWeight: 600, color: C.slate5, marginLeft: 8 }}>({industry.code})</span>
            </div>
            <div style={{ fontSize: 12, color: C.slate5, marginBottom: 16 }}>
              營業期間：{operatingMonths} 個月｜組織型態：{businessType === 'company' ? '公司' : '行號'}
            </div>
            <div style={{ display: 'flex', gap: 28 }}>
              {[
                { label: '本年度營業額', value: formatCurrency(revenueNum), color: C.blue },
                { label: '其他收支',     value: formatCurrency(otherIncomeNum), color: C.teal },
                { label: '查帳稅前盈餘', value: formatCurrency(auditedProfitNum), color: C.indigo },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ borderLeft: `4px solid ${color}`, paddingLeft: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.slate5, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 試算卡片列 ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {cardDefs.map((card, i) => (
          <div key={i} style={{
            flex: 1, backgroundColor: C.white, borderRadius: 18,
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            borderTop: `6px solid ${card.accent}`, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* card header */}
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.slate1}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.slate8 }}>{card.title}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: card.accent, marginTop: 3 }}>{card.subtitle}</div>
              </div>
              {card.rate && <div style={{ fontSize: 22, fontWeight: 900, color: card.accent }}>{card.rate !== '－' ? `${card.rate}%` : '無'}</div>}
            </div>
            {/* card body */}
            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
              {card.showRevenue && (
                <div style={{ backgroundColor: C.slate1, borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.slate5, marginBottom: 3 }}>本年度營業額</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.slate7 }}>{formatCurrency(revenueNum)}</div>
                </div>
              )}
              <div style={{ backgroundColor: C.slate1, borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.slate5, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{card.showRevenue ? '帳載課稅所得額' : '核定所得額'}</span>
                  {card.badge && (
                    <span style={{ backgroundColor: '#e0e7ff', color: C.indigo, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 800 }}>
                      {card.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.slate7 }}>{formatCurrency(card.income)}</div>
              </div>
              <div style={{ backgroundColor: card.bg, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: card.textAccent, marginBottom: 4 }}>{termLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: card.textAccent }}>{formatCurrency(card.final)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 智慧決策區塊 ── */}
      {compareData && (
        <div style={{ backgroundColor: C.slate9, borderRadius: 20, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ backgroundColor: C.slate8, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scale style={{ width: 20, height: 20, color: '#fbbf24' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>智慧決策分析：查帳 vs 選擇標準</span>
          </div>
          <div style={{ padding: '20px 24px 24px' }}>
            {/* VS 對比區 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              {/* 方案一 */}
              <div style={{
                flex: 1, textAlign: 'center', padding: '18px 16px', borderRadius: 16,
                border: `2px solid ${compareData.isAuditedBetter ? '#818cf8' : C.slate7}`,
                backgroundColor: compareData.isAuditedBetter ? 'rgba(99,102,241,0.15)' : 'rgba(30,41,59,0.8)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.slate4, marginBottom: 6 }}>方案一</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>查帳申報</div>
                <div style={{ fontSize: 11, color: '#a5b4fc', marginBottom: 10 }}>(實際收集合規憑證)</div>
                <div style={{ fontSize: 10, color: C.slate4, marginBottom: 4 }}>{termLabel}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: C.white }}>{formatCurrency(resultAudited.finalValue)}</div>
              </div>
              {/* VS badge */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', backgroundColor: C.slate7,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.slate3 }}>VS</span>
              </div>
              {/* 方案二 */}
              <div style={{
                flex: 1, textAlign: 'center', padding: '18px 16px', borderRadius: 16,
                border: `2px solid ${!compareData.isAuditedBetter && compareData.diff !== 0 ? '#fbbf24' : C.slate7}`,
                backgroundColor: !compareData.isAuditedBetter && compareData.diff !== 0 ? 'rgba(251,191,36,0.12)' : 'rgba(30,41,59,0.8)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.slate4, marginBottom: 6 }}>方案二</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>使用【{compareData.standardName}】</div>
                <div style={{ fontSize: 11, color: '#fcd34d', marginBottom: 10 }}>&nbsp;</div>
                <div style={{ fontSize: 10, color: C.slate4, marginBottom: 4 }}>{termLabel}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: C.white }}>{formatCurrency(compareData.standardResult.finalValue)}</div>
              </div>
            </div>

            {/* 建議文字 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', borderRadius: 999, marginBottom: 14,
                border: `1px solid ${compareData.isAuditedBetter ? 'rgba(99,102,241,0.4)' : compareData.diff === 0 ? C.slate6 : 'rgba(251,191,36,0.4)'}`,
                backgroundColor: compareData.isAuditedBetter ? 'rgba(99,102,241,0.15)' : compareData.diff === 0 ? C.slate7 : 'rgba(251,191,36,0.12)',
              }}>
                <ThumbsUp style={{ width: 14, height: 14, color: compareData.isAuditedBetter ? '#a5b4fc' : compareData.diff === 0 ? C.slate3 : '#fcd34d' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: compareData.isAuditedBetter ? '#a5b4fc' : compareData.diff === 0 ? C.slate3 : '#fcd34d' }}>事務所建議</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#cbd5e1', lineHeight: 1.5 }}>
                {compareData.recommendation}
                {compareData.diff !== 0 && (
                  <span style={{ fontSize: 28, fontWeight: 900, color: C.white, margin: '0 8px' }}>
                    {formatCurrency(compareData.absDiff)}
                  </span>
                )}
                {compareData.diff !== 0 && '元'}
              </div>

              {/* 漏報警示 */}
              {compareData.netStandardDiff !== null && compareMethod !== 'net' && !compareData.isAuditedBetter && (
                <div style={{
                  marginTop: 16, backgroundColor: 'rgba(30,41,59,0.6)', border: `1px solid ${C.slate6}`,
                  borderRadius: 14, padding: '14px 18px', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 13, color: '#fcd34d', fontWeight: 600, lineHeight: 1.6 }}>
                    ⚠️ 提醒：如有漏報銷售額或其他情事被抽查帳務，都會改由同業利潤標準計算，將
                    {businessType === 'company' ? '補繳差額' : '調增所得'}{' '}
                    <strong style={{ fontSize: 16, color: '#fbbf24' }}>
                      {formatCurrency(compareData.netStandardDiff > 0 ? compareData.netStandardDiff : 0)}
                    </strong> 元。
                  </div>
                  {compareData.savingsVsAudit !== null && (
                    <div style={{ marginTop: 8, paddingLeft: 20, fontSize: 12, fontWeight: 700, lineHeight: 1.6,
                      color: compareData.savingsVsAudit >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                      💡 {compareData.savingsVsAudit >= 0
                        ? `若日後遭核定，整體${businessType === 'company' ? '稅負' : '營利所得'}仍較原採「查帳申報」${businessType === 'company' ? '節省' : '減少'}了 ${formatCurrency(compareData.savingsVsAudit)} ${businessType === 'company' ? '稅金' : '元'}。`
                        : `注意：若遭核定，最終${businessType === 'company' ? '總繳稅負' : '總營利所得'}將比一開始採「查帳申報」多出 ${formatCurrency(Math.abs(compareData.savingsVsAudit))} ${businessType === 'company' ? '稅金' : '元'}。`
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 警語 ── */}
      <div style={{ backgroundColor: C.white, borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid #fee2e2` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ backgroundColor: '#fef2f2', borderRadius: 14, padding: 10, flexShrink: 0 }}>
            <AlertTriangle style={{ width: 24, height: 24, color: C.red }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#7f1d1d', marginBottom: 12 }}>稅務評估重要警語</div>
            {[
              '查帳申報的所得，一定會覺得哪有賺這麼多，這常常無法完全反映企業的真實盈餘。實務上常見如：無法取得進項發票、員工因債務問題不願申報薪資、或是支付佣金但對方拒絕申報等情形。這些狀況容易造成帳面結算所得偏高，因此我們會建議改採用國稅局設計的三種標準（書審、所得額、同業利潤）來申報，以適度降低稅務風險。',
              '雖然營業額 3,000 萬元以下依法可適用「擴大書審」，但現階段被抽查的機率較高。事務所建議：若營業額超過 1,000 萬元，應優先考慮改用中間標準（所得額標準）計算核稅。此外需特別留意，不論是採用書審或所得額標準，日後若遭國稅局抽查帳務且無法提供完整憑證，皆會被改以最高標準的「同業利潤標準」重新核課並補繳差額。',
              '國稅局查核向來以「實質課稅」為原則，本試算工具之結果僅供初步評估，實際申報仍須依真實帳載憑證狀況而定。',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.red, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: 12, color: C.slate7, lineHeight: 1.7 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 10, color: C.slate4 }}>
        本報告由源信記帳士事務所 AI 稅務試算工具產出，僅供參考，不構成法律或稅務建議。
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────
export default function App() {
  const [industryData, setIndustryData] = useState([]);
  const [loadState, setLoadState]       = useState('loading');

  const [searchTerm, setSearchTerm]             = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [showSuggestions, setShowSuggestions]   = useState(false);
  const searchRef = useRef(null);

  const [revenueInput, setRevenueInput]             = useState('10000000');
  const [otherIncomeInput, setOtherIncomeInput]     = useState('0');
  const [auditedProfitInput, setAuditedProfitInput] = useState('800000');
  const [businessType, setBusinessType]             = useState('company');
  const [operatingMonths, setOperatingMonths]       = useState(12);
  const [compareMethod, setCompareMethod]           = useState('expand');
  const [isExporting, setIsExporting]               = useState(false);

  const printRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/latest.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        setIndustryData(processJSONData(raw));
        setLoadState('ready');
      } catch (e) {
        console.error(e);
        setLoadState('error');
      }
    })();
  }, []);

  const revenueNum       = parseFloat(revenueInput.replace(/,/g, '')) || 0;
  const otherIncomeNum   = parseFloat(otherIncomeInput) || 0;
  const auditedProfitNum = parseFloat(auditedProfitInput.replace(/,/g, '')) || 0;
  const auditedMargin    = revenueNum > 0 ? ((auditedProfitNum / revenueNum) * 100).toFixed(2) : '0.00';

  const formatCurrency = (n) =>
    new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(n);

  const calcTax = (income, months) => {
    if (income <= 0) return 0;
    const ann = (income * 12) / months;
    const annTax = ann <= 120000 ? 0 : ann <= 200000 ? (ann - 120000) * 0.5 : ann * 0.2;
    return Math.round(annTax * (months / 12));
  };

  const calcStandard = (rateStr, revenue, otherIncome, type, months, bType) => {
    if (!rateStr || rateStr === '－' || rateStr === '-') return null;
    const rate = parseFloat(rateStr.replace(/[^\d.]/g, ''));
    if (isNaN(rate)) return null;
    const taxableIncome = type === 'expand'
      ? Math.round((revenue + otherIncome) * (rate / 100))
      : Math.round(revenue * (rate / 100)) + otherIncome;
    const tax = calcTax(taxableIncome, months);
    return { rateStr, rate, taxableIncome, tax, finalValue: bType === 'company' ? tax : Math.max(0, taxableIncome) };
  };

  const auditedTax = calcTax(auditedProfitNum, operatingMonths);
  const resultAudited = {
    taxableIncome: auditedProfitNum, tax: auditedTax,
    finalValue: businessType === 'company' ? auditedTax : Math.max(0, auditedProfitNum),
  };

  const resultA = selectedIndustry ? calcStandard(selectedIndustry.expand, revenueNum, otherIncomeNum, 'expand', operatingMonths, businessType) : null;
  const resultB = selectedIndustry ? calcStandard(selectedIndustry.income, revenueNum, otherIncomeNum, 'income', operatingMonths, businessType) : null;
  const resultC = selectedIndustry ? calcStandard(selectedIndustry.net,    revenueNum, otherIncomeNum, 'net',    operatingMonths, businessType) : null;

  const compareData = useMemo(() => {
    const map     = { expand: resultA, income: resultB, net: resultC };
    const nameMap = { expand: '擴大書審', income: '所得額標準', net: '同業利潤標準' };
    const standardResult = map[compareMethod];
    if (!standardResult) return null;
    const diff = resultAudited.finalValue - standardResult.finalValue;
    const absDiff = Math.abs(diff);
    const term = businessType === 'company' ? '稅金' : '營利所得';
    const standardName = nameMap[compareMethod];
    let recommendation = '', isAuditedBetter = false;
    if (diff > 0)      recommendation = `建議採用【${standardName}】申報，較查帳申報可減少${term}`;
    else if (diff < 0) { isAuditedBetter = true; recommendation = `建議採用【查帳申報】，較${standardName}可減少${term}`; }
    else               recommendation = `兩者${term}完全相同，可依憑證完整度彈性選擇。`;
    const netStandardDiff = resultC ? resultC.finalValue - standardResult.finalValue : null;
    const savingsVsAudit  = resultC ? resultAudited.finalValue - resultC.finalValue  : null;
    return { standardResult, standardName, diff, absDiff, recommendation, isAuditedBetter, netStandardDiff, savingsVsAudit };
  }, [compareMethod, resultA, resultB, resultC, resultAudited, businessType]);

  const filteredIndustries = useMemo(() => {
    if (!searchTerm.trim() || !industryData.length) return [];
    const kw = searchTerm.trim().replace(/傢俱/g, '家具').replace(/台/g, '臺');
    const isClothes = kw.includes('服飾') || kw.includes('服裝');
    return industryData.filter((ind) =>
      ind.name.includes(kw) || ind.code.includes(kw) ||
      (isClothes && (ind.name.includes('服裝') || ind.name.includes('服飾') || ind.name.includes('衣')))
    ).slice(0, 15);
  }, [searchTerm, industryData]);

  const handleSelectIndustry = (ind) => {
    setSelectedIndustry(ind);
    setSearchTerm(`${ind.code} ${ind.name}`);
    setShowSuggestions(false);
    if (ind.expand && ind.expand !== '－')      setCompareMethod('expand');
    else if (ind.income && ind.income !== '－') setCompareMethod('income');
    else if (ind.net    && ind.net    !== '－') setCompareMethod('net');
  };

  // ── 截圖：對 printRef（純 inline style div）進行擷取 ──
  const handleExportImage = useCallback(async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      printRef.current.style.display = 'block';
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 200));
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: C.slate0,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement('a');
      a.download = `稅務試算報告_${selectedIndustry?.name || '未命名'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (err) {
      console.error(err);
      alert('產出圖檔時發生錯誤，請重試！');
    } finally {
      if (printRef.current) printRef.current.style.display = 'none';
      setIsExporting(false);
    }
  }, [selectedIndustry, compareData, resultA, resultB, resultC]);

  // ── 載入畫面 ──
  if (loadState === 'loading') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100 text-center space-y-6">
        <div className="flex justify-center"><BrandLogo /></div>
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
        <p className="text-lg font-bold text-slate-700">正在載入稅率資料庫...</p>
      </div>
    </div>
  );

  if (loadState === 'error') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white p-10 rounded-[2rem] shadow-xl border border-red-100 text-center space-y-6">
        <div className="mx-auto bg-red-50 w-16 h-16 rounded-full flex items-center justify-center border border-red-100">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="text-xl font-extrabold text-red-800 mb-2">資料庫載入失敗</p>
          <p className="text-slate-500 text-sm">請稍後再試</p>
        </div>
        <button onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors">
          <RefreshCw className="w-4 h-4" /> 重新載入
        </button>
      </div>
    </div>
  );

  // ── 主畫面 ──
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 font-sans text-slate-800">

      {/* Off-screen 截圖專用 div（純 inline style，永遠 display:none 除截圖時） */}
      <div ref={printRef} style={{ display: 'none', position: 'fixed', top: 0, left: 0, zIndex: -1 }}>
        {selectedIndustry && (
          <PrintReport
            industry={selectedIndustry}
            businessType={businessType}
            operatingMonths={operatingMonths}
            revenueNum={revenueNum}
            otherIncomeNum={otherIncomeNum}
            auditedProfitNum={auditedProfitNum}
            auditedMargin={auditedMargin}
            resultAudited={resultAudited}
            resultA={resultA}
            resultB={resultB}
            resultC={resultC}
            compareData={compareData}
            compareMethod={compareMethod}
            formatCurrency={formatCurrency}
          />
        )}
      </div>

      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">

        {/* Header */}
        <header className="bg-white rounded-[2rem] shadow-sm border border-slate-100 px-6 py-5 lg:px-8 lg:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                <BrandLogo iconSize={22} titleSize={20} subtitleSize={9} />
              </div>
              <div className="hidden md:block w-px h-10 bg-slate-200" />
              <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">稅務決策試算系統</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  查帳 vs 標準申報分析｜資料庫共 <strong className="text-emerald-600">{industryData.length}</strong> 筆
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full hidden md:block">
              114 年度 同業利潤標準
            </span>
          </div>
        </header>

        {/* 輸入區塊 */}
        <div className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* 1. 行業搜尋 */}
            <div className="flex flex-col gap-3 h-full">
              <h2 className="text-lg font-bold flex items-center text-slate-800">
                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg mr-2.5"><Search className="w-4 h-4" /></span>
                1. 搜尋行業別
              </h2>
              <div className="relative" ref={searchRef}>
                <label className="block text-sm font-medium text-slate-500 mb-2">關鍵字或標準代號</label>
                <input type="text" placeholder="搜尋..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none font-medium transition-all"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {showSuggestions && filteredIndustries.length > 0 && (
                  <ul className="absolute z-30 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-auto py-2">
                    {filteredIndustries.map((ind) => (
                      <li key={ind.code} onClick={() => handleSelectIndustry(ind)}
                        className="px-5 py-3 hover:bg-blue-50 cursor-pointer flex flex-col border-b border-slate-50 last:border-0 transition-colors">
                        <span className="font-bold text-slate-800">{ind.name}</span>
                        <span className="text-xs text-blue-600 font-mono mt-0.5">{ind.code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedIndustry && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-900 font-bold text-sm leading-tight">{selectedIndustry.name}</p>
                    <p className="text-xs text-emerald-700 font-mono">{selectedIndustry.code}</p>
                  </div>
                </div>
              )}
              <div className="mt-auto pt-4 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">組織型態</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl h-[46px]">
                      {[['company', '公司'], ['firm', '行號']].map(([t, label]) => (
                        <button key={t} type="button" onClick={() => setBusinessType(t)}
                          className={`flex-1 text-sm font-bold rounded-lg transition-all ${businessType === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">本年營業期間</label>
                    <div className="relative h-[46px]">
                      <select value={operatingMonths} onChange={(e) => setOperatingMonths(Number(e.target.value))}
                        className="w-full h-full px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-bold text-slate-700 appearance-none text-sm">
                        <option value={12}>12個月(全年)</option>
                        {Array.from({ length: 11 }, (_, i) => 11 - i).map((m) => (
                          <option key={m} value={m}>{m} 個月(比例換算)</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 營業額 */}
            <InputBlock icon={<DollarSign className="w-4 h-4" />} iconBg="bg-sky-100 text-sky-600"
              title="2. 本年度營業額" label="新台幣 (元)"
              value={revenueInput} onChange={(v) => setRevenueInput(v.replace(/\D/g, ''))}
              display={formatCurrency(revenueNum)} displayClass="text-sky-600"
              inputClass="border-slate-200 focus:ring-sky-500/50 focus:border-sky-500" bgClass="bg-slate-50" />

            {/* 3. 其他收支 */}
            <InputBlock icon={<PlusCircle className="w-4 h-4" />} iconBg="bg-teal-100 text-teal-600"
              title="3. 其他收支總計" label="非營業收入與費用 (元)"
              value={otherIncomeInput}
              onChange={(v) => { let s = v.replace(/[^-0-9]/g, ''); s = s.replace(/(?!^)-/g, ''); setOtherIncomeInput(s); }}
              display={formatCurrency(otherIncomeNum)} displayClass="text-teal-700"
              inputClass="border-teal-200 focus:ring-teal-500/50 focus:border-teal-500 bg-teal-50/30" bgClass="bg-teal-50" />

            {/* 4. 查帳稅前盈餘 */}
            <InputBlock icon={<BookOpen className="w-4 h-4" />} iconBg="bg-indigo-100 text-indigo-600"
              title="4. 查帳稅前盈餘" label="帳載結算所得額 (元)"
              value={auditedProfitInput} onChange={(v) => setAuditedProfitInput(v.replace(/\D/g, ''))}
              display={formatCurrency(auditedProfitNum)} displayClass="text-indigo-700"
              inputClass="border-indigo-200 focus:ring-indigo-500/50 focus:border-indigo-500 bg-indigo-50/50 text-indigo-900"
              bgClass="bg-indigo-50" />
          </div>
        </div>

        {/* 結果區塊 */}
        {!selectedIndustry ? (
          <div className="bg-white p-16 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[300px]">
            <div className="bg-slate-50 p-6 rounded-full mb-5"><Search className="w-12 h-12 text-slate-300" /></div>
            <p className="text-xl font-bold text-slate-500">等待輸入...</p>
            <p className="text-sm mt-2 text-slate-400">請先從上方搜尋並選擇行業類別以開始試算</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* 截圖按鈕 */}
            <div className="flex justify-end">
              <button onClick={handleExportImage} disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl shadow flex items-center gap-2 transition-colors disabled:opacity-70">
                {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {isExporting ? '產出圖片中...' : '📸 匯出報告圖檔'}
              </button>
            </div>

            {/* 試算卡片 */}
            <div className={`grid gap-5 md:gap-6 ${
              compareMethod === 'net'    ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' :
              compareMethod === 'income' ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              <ResultCard title="查帳申報" subtitle="實際收集合規憑證" borderColor="border-indigo-500"
                revenue={revenueNum} incomeLabel="帳載課稅所得額"
                incomeBadge={`淨利 ${auditedMargin}%`} incomeBadgeClass="text-indigo-700 bg-indigo-100 border border-indigo-200"
                taxableIncome={resultAudited.taxableIncome} finalValue={resultAudited.finalValue}
                finalBg="bg-indigo-50 border-indigo-100" finalText="text-indigo-900" labelText="text-indigo-700"
                businessType={businessType} fmt={formatCurrency} />
              {compareMethod === 'expand' && (
                <ResultCard title="A. 擴大書審" subtitle="1,000萬以下" rate={selectedIndustry.expand}
                  rateColor="text-blue-600" borderColor="border-blue-400" result={resultA}
                  finalBg="bg-blue-50 border-blue-100" finalText="text-blue-700" labelText="text-blue-700"
                  businessType={businessType} fmt={formatCurrency} />
              )}
              {(compareMethod === 'expand' || compareMethod === 'income') && (
                <ResultCard title="B. 所得額標準" subtitle="1,000萬以上" rate={selectedIndustry.income}
                  rateColor="text-emerald-600" borderColor="border-emerald-400" result={resultB}
                  finalBg="bg-emerald-50 border-emerald-100" finalText="text-emerald-700" labelText="text-emerald-700"
                  businessType={businessType} fmt={formatCurrency} />
              )}
              <ResultCard title="C. 同業標準" subtitle="高風險查核" rate={selectedIndustry.net}
                rateColor="text-purple-600" borderColor="border-purple-400" result={resultC}
                finalBg="bg-purple-50 border-purple-100" finalText="text-purple-700" labelText="text-purple-700"
                businessType={businessType} fmt={formatCurrency} />
            </div>

            {/* 比較戰情室 */}
            <div className="bg-slate-900 rounded-[2rem] shadow-xl overflow-hidden text-white border border-slate-700">
              <div className="bg-slate-800 p-5 border-b border-slate-700 flex items-center gap-3">
                <Scale className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl font-bold">智慧決策分析：查帳 vs 選擇標準</h3>
              </div>
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <p className="text-slate-400 mb-3 text-sm font-medium">請選擇要與「查帳申報」比較的標準方式：</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { val: 'expand', label: 'A. 擴大書審',     color: 'blue',    r: resultA },
                      { val: 'income', label: 'B. 所得額標準',   color: 'emerald', r: resultB },
                      { val: 'net',    label: 'C. 同業利潤標準', color: 'purple',  r: resultC },
                    ].map(({ val, label, color, r }) => (
                      <label key={val} className={`cursor-pointer px-4 py-2 rounded-xl border flex items-center transition-all
                        ${compareMethod === val ? `border-${color}-500 bg-${color}-500/20` : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}
                        ${!r ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input type="radio" className="hidden" name="compare" value={val}
                          disabled={!r} checked={compareMethod === val} onChange={() => setCompareMethod(val)} />
                        <div className={`w-4 h-4 rounded-full border mr-2 flex items-center justify-center
                          ${compareMethod === val ? `border-${color}-400` : 'border-slate-500'}`}>
                          {compareMethod === val && <div className={`w-2 h-2 rounded-full bg-${color}-400`} />}
                        </div>
                        <span className="font-semibold text-slate-100 text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {compareData ? (
                  <div className="bg-slate-800 rounded-2xl p-6 md:p-8">
                    <div className="flex items-center justify-center gap-4 max-w-4xl mx-auto">
                      <CompareBox label="方案一" title="查帳申報" subtitle="(實際收集合規憑證)"
                        value={resultAudited.finalValue} highlighted={compareData.isAuditedBetter}
                        highlightClass="border-indigo-400 bg-indigo-500/20" subtitleClass="text-indigo-300"
                        businessType={businessType} fmt={formatCurrency} />
                      <div className="flex-shrink-0 bg-slate-700 w-9 h-9 rounded-full flex items-center justify-center">
                        <span className="text-slate-300 font-bold text-xs">VS</span>
                      </div>
                      <CompareBox label="方案二" title={`使用【${compareData.standardName}】`}
                        value={compareData.standardResult.finalValue}
                        highlighted={!compareData.isAuditedBetter && compareData.diff !== 0}
                        highlightClass="border-amber-400 bg-amber-500/20" subtitleClass="text-amber-300"
                        businessType={businessType} fmt={formatCurrency} />
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-700 text-center flex flex-col items-center gap-4">
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border
                        ${compareData.diff === 0 ? 'bg-slate-700 text-slate-300 border-slate-600'
                          : compareData.isAuditedBetter ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                        <ThumbsUp className="w-4 h-4" />
                        <span className="font-bold text-sm">事務所建議</span>
                      </div>
                      <p className="text-xl md:text-2xl font-medium text-slate-200">
                        {compareData.recommendation}
                        {compareData.diff !== 0 && <span className="font-black text-white text-3xl mx-2 whitespace-nowrap">{formatCurrency(compareData.absDiff)}</span>}
                        {compareData.diff !== 0 && '元'}
                      </p>
                      {compareData.netStandardDiff !== null && compareMethod !== 'net' && !compareData.isAuditedBetter && (
                        <div className="bg-slate-700/50 border border-slate-600 px-5 py-4 rounded-xl max-w-3xl text-left w-full">
                          <p className="text-sm text-amber-300 font-medium flex items-start gap-2">
                            <span className="flex-shrink-0">⚠️</span>
                            <span>提醒：如有漏報銷售額或其他情事被抽查帳務，都會改由同業利潤標準計算，將
                              {businessType === 'company' ? '補繳差額' : '調增所得'}&nbsp;
                              <strong className="text-amber-400 text-lg whitespace-nowrap">
                                {formatCurrency(compareData.netStandardDiff > 0 ? compareData.netStandardDiff : 0)}
                              </strong> 元。
                            </span>
                          </p>
                          {compareData.savingsVsAudit !== null && (
                            <div className="mt-3 pl-6">
                              {compareData.savingsVsAudit >= 0
                                ? <p className="text-emerald-400 text-sm font-bold">💡 若日後遭核定，整體{businessType === 'company' ? '稅負' : '營利所得'}仍較原採「查帳申報」{businessType === 'company' ? '節省' : '減少'}了&nbsp;<strong className="text-emerald-300 whitespace-nowrap">{formatCurrency(compareData.savingsVsAudit)}</strong>{businessType === 'company' ? '稅金' : '元'}。</p>
                                : <p className="text-red-400 text-sm font-bold">💡 注意：若遭核定，最終{businessType === 'company' ? '總繳稅負' : '總營利所得'}將比一開始採「查帳申報」多出&nbsp;<strong className="text-red-300 whitespace-nowrap">{formatCurrency(Math.abs(compareData.savingsVsAudit))}</strong>{businessType === 'company' ? '稅金' : '元'}。</p>
                              }
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-2xl text-center">
                    <p className="text-slate-400 font-medium">請先選擇上方有效的標準以進行對比分析。</p>
                  </div>
                )}
              </div>
            </div>

            {/* 警語 */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-red-100 shadow-sm flex flex-col md:flex-row items-start gap-5">
              <div className="bg-red-50 p-3 rounded-2xl flex-shrink-0 border border-red-100">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-xl mb-4 text-red-900">稅務評估重要警語</h4>
                <div className="space-y-4 text-slate-700 text-sm md:text-base font-medium">
                  {[
                    '查帳申報的所得，一定會覺得哪有賺這麼多，這常常無法完全反映企業的真實盈餘。實務上常見如：無法取得進項發票、員工因債務問題不願申報薪資、或是支付佣金但對方拒絕申報等情形。這些狀況容易造成帳面結算所得偏高，因此我們會建議改採用國稅局設計的三種標準（書審、所得額、同業利潤）來申報，以適度降低稅務風險。',
                    '雖然營業額 3,000 萬元以下依法可適用「擴大書審」，但現階段被抽查的機率較高。事務所建議：若營業額超過 1,000 萬元，應優先考慮改用中間標準（所得額標準）計算核稅。此外需特別留意，不論是採用書審或所得額標準，日後若遭國稅局抽查帳務且無法提供完整憑證，皆會被改以最高標準的「同業利潤標準」重新核課並補繳差額。',
                    '國稅局查核向來以「實質課稅」為原則，本試算工具之結果僅供初步評估，實際申報仍須依真實帳載憑證狀況而定。',
                  ].map((text, i) => (
                    <p key={i} className="flex items-start gap-2">
                      <span className="font-bold text-red-700 flex-shrink-0">{i + 1}.</span>
                      <span>{text}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子元件：數字輸入欄
// ─────────────────────────────────────────────
function InputBlock({ icon, iconBg, title, label, value, onChange, display, displayClass, inputClass, bgClass }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold flex items-center text-slate-800">
        <span className={`${iconBg} p-1.5 rounded-lg mr-2.5`}>{icon}</span>{title}
      </h2>
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-2">{label}</label>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3 text-xl font-black text-slate-700 bg-white border rounded-xl focus:ring-2 outline-none transition-all ${inputClass}`} />
        <div className={`mt-3 flex justify-between items-center ${bgClass} border border-slate-100 p-2.5 rounded-xl`}>
          <span className="text-sm font-medium text-slate-500">確認：</span>
          <span className={`font-extrabold text-lg ${displayClass}`}>{display}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子元件：試算結果卡
// ─────────────────────────────────────────────
function ResultCard({ title, subtitle, rate, rateColor, borderColor, revenue, incomeLabel, incomeBadge, incomeBadgeClass,
  taxableIncome, finalValue, result, finalBg, finalText, labelText, businessType, fmt }) {
  const income  = result ? result.taxableIncome : taxableIncome;
  const value   = result ? result.finalValue    : finalValue;
  const hasData = result !== undefined ? !!result : true;
  return (
    <div className={`bg-white rounded-[1.5rem] shadow-sm border-t-[6px] ${borderColor} flex flex-col overflow-hidden`}>
      <div className="p-5 border-b border-slate-50 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          {subtitle && <p className={`text-xs font-bold mt-1 ${rateColor || 'text-slate-400'}`}>{subtitle}</p>}
        </div>
        {rate !== undefined && <div className={`text-2xl font-black mt-0.5 ${rateColor}`}>{rate && rate !== '－' ? `${rate}%` : '無'}</div>}
      </div>
      <div className="p-5 flex-grow flex flex-col justify-end">
        {hasData ? (
          <div className="space-y-4">
            {revenue !== undefined && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-1">本年度營業額</p>
                <p className="text-base font-bold text-slate-700">{fmt(revenue)}</p>
              </div>
            )}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center flex-wrap gap-2">
                <span>{incomeLabel || '核定所得額'}</span>
                {incomeBadge && <span className={`px-2.5 py-1 rounded-md text-sm font-extrabold ${incomeBadgeClass}`}>{incomeBadge}</span>}
              </p>
              <p className="text-base font-bold text-slate-700">{fmt(income)}</p>
            </div>
            <div className={`${finalBg} p-4 rounded-xl border`}>
              <p className={`text-xs font-medium mb-1 ${labelText}`}>{businessType === 'company' ? '營所稅稅額' : '個人營利所得'}</p>
              <p className={`text-2xl font-black ${finalText}`}>{fmt(value)}</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm font-medium text-center py-8">無適用資料</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子元件：比較框
// ─────────────────────────────────────────────
function CompareBox({ label, title, subtitle, value, highlighted, highlightClass, subtitleClass, businessType, fmt }) {
  return (
    <div className={`w-[45%] text-center p-4 md:p-6 rounded-2xl border ${highlighted ? highlightClass : 'border-slate-600 bg-slate-800/80'}`}>
      <p className="text-slate-400 text-[10px] md:text-xs font-bold mb-1">{label}</p>
      <h4 className="text-sm md:text-lg font-bold text-white">
        {title}
        {subtitle && <span className={`block text-[10px] md:text-sm font-medium mt-1 ${subtitleClass}`}>{subtitle}</span>}
      </h4>
      <div className="mt-4">
        <p className="text-xs text-slate-400 mb-1">{businessType === 'company' ? '營所稅稅額' : '個人營利所得'}</p>
        <p className="text-xl md:text-3xl font-black text-white">{fmt(value)}</p>
      </div>
    </div>
  );
}

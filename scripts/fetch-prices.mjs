#!/usr/bin/env node
/**
 * 하루 1회(장 마감 후) 실행하는 종가 수집 배치. 결과를 public/prices/latest.json에 쓴다.
 * 클라이언트는 이 파일만 읽는다 — 방문자 수와 무관하게 API 호출량이 일정하다 (명세서 6.2).
 *
 * 사용법:  node scripts/fetch-prices.mjs            (GitHub Actions: .github/workflows/prices.yml)
 *
 * 소스 (2026-09 확인):
 *  - 국내 주식/ETF/지수: 네이버 금융 fchart (fchart.stock.naver.com). 비공식·무인증. 공개 운영 시 약관 확인 필수.
 *    KRX OPEN API 인증키(KRX_API_KEY)가 있으면 그쪽을 우선 쓰도록 fetchKRX를 채울 것 (현재는 자리만).
 *  - 해외 주식/ETF/지수/환율: Yahoo Finance chart 엔드포인트 (query1.finance.yahoo.com). 비공식·무인증.
 *  종가 지연 데이터이며, 화면에는 기준일을 항상 표시한다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(root, 'public', 'prices', 'latest.json');
const HISTORY_DAYS = 800; // 벤치마크 일별 종가 보관 일수 (약 3년)
const UA = 'Mozilla/5.0 (compatible; baseline-prices/1.0)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round4 = (n) => Math.round(n * 10000) / 10000;

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** 네이버 fchart: EUC-KR XML. item data="YYYYMMDD|open|high|low|close|volume" */
async function fetchNaver(symbol, count) {
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${encodeURIComponent(symbol)}&timeframe=day&count=${count}&requestType=0`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = new TextDecoder('euc-kr').decode(buf);
  const name = /name="([^"]*)"/.exec(text)?.[1]?.replace(/&amp;/g, '&') ?? symbol;
  const series = [];
  for (const m of text.matchAll(/<item data="([^"]+)"/g)) {
    const [d, , , , close] = m[1].split('|');
    const c = Number(close);
    if (d?.length === 8 && Number.isFinite(c) && c > 0) {
      series.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, close: c });
    }
  }
  if (!series.length) throw new Error(`no data for ${symbol}`);
  return { name, series };
}

/** KRX OPEN API 자리. 인증키를 받으면 여기서 일별시세를 읽도록 구현하고 fetchKR에서 우선 사용할 것. */
async function fetchKRX(_symbol, _count) {
  throw new Error('KRX OPEN API not implemented');
}

async function fetchKR(symbol, count) {
  if (process.env.KRX_API_KEY) {
    try {
      return await fetchKRX(symbol, count);
    } catch (e) {
      console.warn(`[KRX] ${symbol}: ${e.message} → 네이버로 대체`);
    }
  }
  return fetchNaver(symbol, count);
}

/** Yahoo chart: JSON. timestamp[] + indicators.quote[0].close[] */
async function fetchYahoo(symbol, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const json = JSON.parse(await getText(url));
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`no result for ${symbol}: ${json?.chart?.error?.description ?? ''}`);
  const ts = r.timestamp ?? [];
  const closes = r.indicators?.quote?.[0]?.close ?? [];
  const tz = r.meta?.exchangeTimezoneName ?? 'UTC';
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const series = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
      series.push({ date: fmt.format(new Date(ts[i] * 1000)), close: round4(c) });
    }
  }
  // 같은 날짜가 두 번 오면(장중 스냅샷) 마지막 값만
  const dedup = new Map(series.map((p) => [p.date, p]));
  const out = [...dedup.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!out.length) throw new Error(`no data for ${symbol}`);
  return { name: r.meta?.longName ?? r.meta?.shortName ?? symbol, currency: r.meta?.currency ?? 'USD', series: out };
}

async function main() {
  const cfg = JSON.parse(await readFile(path.join(here, 'tickers.json'), 'utf8'));
  const quotes = {};
  const failures = [];

  for (const q of cfg.quotes) {
    try {
      const d = q.market === 'KR' ? await fetchKR(q.ticker, 3) : await fetchYahoo(q.ticker, '5d');
      const last = d.series[d.series.length - 1];
      quotes[q.ticker.toUpperCase()] = {
        close: last.close,
        date: last.date,
        currency: q.market === 'KR' ? 'KRW' : (d.currency ?? 'USD'),
        name: d.name,
      };
      console.log(`✓ ${q.ticker} ${last.date} ${last.close}`);
    } catch (e) {
      failures.push(`${q.ticker}: ${e.message}`);
      console.warn(`✗ ${q.ticker}: ${e.message}`);
    }
    await sleep(150);
  }

  const benchmarks = {};
  for (const b of cfg.benchmarks) {
    try {
      const d = b.market === 'KR' ? await fetchKR(b.symbol, HISTORY_DAYS) : await fetchYahoo(b.symbol, '3y');
      benchmarks[b.key] = { name: b.name, currency: b.currency, series: d.series.slice(-HISTORY_DAYS) };
      console.log(`✓ benchmark ${b.key}: ${d.series.length}일`);
    } catch (e) {
      failures.push(`benchmark ${b.key}: ${e.message}`);
      console.warn(`✗ benchmark ${b.key}: ${e.message}`);
    }
  }

  let usd_krw = null;
  try {
    const d = await fetchYahoo(cfg.fx.symbol, '5d');
    const last = d.series[d.series.length - 1];
    usd_krw = { rate: last.close, date: last.date };
    console.log(`✓ USD/KRW ${last.date} ${last.close}`);
  } catch (e) {
    failures.push(`fx: ${e.message}`);
    console.warn(`✗ fx: ${e.message}`);
  }

  // 전부 실패했으면 기존 파일을 덮어쓰지 않는다
  if (Object.keys(quotes).length === 0) {
    console.error('시세를 하나도 받지 못했습니다. 기존 캐시를 유지합니다.');
    process.exit(1);
  }

  const snapshot = { generated_at: new Date().toISOString(), quotes, usd_krw, benchmarks, failures };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot));
  console.log(`→ ${path.relative(root, OUT)} (${Object.keys(quotes).length}종목, 실패 ${failures.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

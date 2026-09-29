/**
 * ============================================================
 *  TESTE DE PONTO DE RUPTURA (BREAKPOINT TEST) COM k6
 * ============================================================
 *
 * O QUE É?
 *  Um breakpoint test aumenta a carga de forma gradual até o sistema
 *  degradar ou quebrar. O objetivo NÃO é passar/falhar, e sim descobrir:
 *    - Qual a capacidade máxima segura?
 *    - Onde a latência começa a "explodir"? (KNEE POINT / ponto de joelho)
 *    - Em que carga o sistema realmente quebra? (BREAKPOINT)
 *
 * KNEE POINT vs BREAKPOINT
 *  - Knee point: ponto onde a curva de latência muda de "quase plana"
 *    para "crescimento acelerado". O sistema ainda responde, mas já
 *    está saturando. É o limite PRÁTICO de capacidade.
 *  - Breakpoint: ponto onde há erros em massa / timeouts. É o limite
 *    ABSOLUTO.
 *
 * COMO ESTE SCRIPT FUNCIONA (ponto didático importante)
 *  1. Usamos o modelo ABERTO (constant-arrival-rate): o k6 dispara N
 *     requisições/s independentemente da resposta do servidor. Assim,
 *     se o servidor fica lento, a carga NÃO diminui (num modelo fechado,
 *     com VUs fixos, o teste "se acomodaria" à lentidão e mascararia o
 *     problema).
 *  2. Em vez de uma rampa contínua, fazemos uma ESCADA: cada degrau
 *     mantém uma taxa fixa por alguns segundos. Isso dá uma amostra
 *     estável de latência por nível de carga -> perfeito para plotar
 *     "carga x latência".
 *  3. Cada degrau tem uma tag (step). Com thresholds "vazios" nas
 *     métricas com tag, o k6 gera sub-métricas por degrau que ficam
 *     disponíveis no handleSummary().
 *  4. No fim, calculamos o knee point com o algoritmo Kneedle
 *     (simplificado) e geramos um gráfico HTML (SVG inline).
 *
 * COMO EXECUTAR
 *    k6 run breakpoint-test.js
 *  Depois abra o arquivo gerado: knee-point-report.html
 *
 * ATENÇÃO
 *  test-api.k6.io é uma API pública compartilhada, feita para
 *  aprendizado. Mantenha as taxas baixas/moderadas e não abuse.
 *  Em ambientes seus, aumente MAX_RPS à vontade.
 * ============================================================
 */

import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = 'https://test-api.k6.io';

// ------------------------------------------------------------
// 1) PARÂMETROS DO EXPERIMENTO (mexa aqui para experimentar)
// ------------------------------------------------------------
const START_RPS = 5;          // taxa do primeiro degrau (req/s)
const RPS_INCREMENT = 100;     // quanto aumenta a cada degrau
const STEPS = 10;             // quantidade de degraus
const STEP_DURATION = 30;     // segundos por degrau

// Critérios de "quebra" (breakpoint) - usados só na análise final
const BREAK_P95_MS = 1000;    // p95 acima disso = quebrou
const BREAK_ERROR_RATE = 0.05; // 5% de erros = quebrou

// Lista de taxas: [5, 15, 25, ..., 95]
const rpsLevels = Array.from({ length: STEPS }, (_, i) => START_RPS + i * RPS_INCREMENT);

// ------------------------------------------------------------
// 2) CENÁRIOS: um por degrau, começando um após o outro
// ------------------------------------------------------------
const scenarios = {};
const thresholds = {};

rpsLevels.forEach((rps, i) => {
  const step = String(i + 1);

  scenarios[`step_${step}`] = {
    executor: 'constant-arrival-rate', // modelo ABERTO
    rate: rps,
    timeUnit: '1s',
    duration: `${STEP_DURATION}s`,
    startTime: `${i * STEP_DURATION}s`, // degraus em sequência
    preAllocatedVUs: 20,
    maxVUs: 300, // reserva de VUs: se o servidor lentifica, o k6 precisa de mais VUs
    tags: { step, rps: String(rps) },
  };

  // TRUQUE: thresholds "sempre verdadeiros" apenas para forçar o k6 a
  // criar sub-métricas por degrau (senão não aparecem no handleSummary).
  thresholds[`http_req_duration{step:${step}}`] = ['max>=0'];
  thresholds[`http_req_failed{step:${step}}`] = ['rate>=0'];
  thresholds[`http_reqs{step:${step}}`] = ['count>=0'];
});

export const options = {
  scenarios,
  thresholds,
  // Timeout curto para que requisições travadas virem erro (e não distorçam o teste)
  httpDebug: '',
};

// ------------------------------------------------------------
// 3) O QUE CADA ITERAÇÃO FAZ (a "requisição de negócio")
// ------------------------------------------------------------
export default function () {
  const res = http.get(`${BASE_URL}/public/crocodiles/`, { timeout: '10s' });

  check(res, {
    'status é 200': (r) => r.status === 200,
  });
}

// ------------------------------------------------------------
// 4) ANÁLISE: extrai dados por degrau e detecta o knee point
// ------------------------------------------------------------

/**
 * Algoritmo Kneedle simplificado para curva CONVEXA e CRESCENTE
 * (é o formato típico de latência x carga).
 *  - Normaliza x e y para [0, 1]
 *  - A curva "ideal" sem joelho seria a diagonal (y = x)
 *  - O knee é o ponto onde a curva mais se afasta ABAIXO da diagonal,
 *    ou seja, onde (xNorm - yNorm) é máximo.
 */
function findKnee(xs, ys) {
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  if (maxX === minX || maxY === minY) return -1;

  let best = -1;
  let bestDiff = -Infinity;
  xs.forEach((x, i) => {
    const xn = (x - minX) / (maxX - minX);
    const yn = (ys[i] - minY) / (maxY - minY);
    const diff = xn - yn;
    if (diff > bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}

function collectPoints(data) {
  const points = [];
  rpsLevels.forEach((rps, i) => {
    const step = String(i + 1);
    const dur = data.metrics[`http_req_duration{step:${step}}`];
    const failed = data.metrics[`http_req_failed{step:${step}}`];
    const reqs = data.metrics[`http_reqs{step:${step}}`];
    if (!dur || !failed || !reqs) return;

    points.push({
      step: i + 1,
      targetRps: rps,
      achievedRps: reqs.values.count / STEP_DURATION, // taxa realmente entregue
      p50: dur.values['med'],
      p95: dur.values['p(95)'],
      errorRate: failed.values.rate,
    });
  });
  return points;
}

// ------------------------------------------------------------
// 5) GRÁFICO (SVG inline, sem dependências externas)
// ------------------------------------------------------------
function buildChart(points, kneeIdx, breakIdx) {
  const W = 820, H = 460;
  const m = { top: 40, right: 70, bottom: 60, left: 70 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;

  const xs = points.map((p) => p.targetRps);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const maxY = Math.max(...points.map((p) => p.p95)) * 1.15 || 1;

  const X = (v) => m.left + ((v - minX) / (maxX - minX || 1)) * pw;
  const Y = (v) => m.top + ph - (v / maxY) * ph;
  const YE = (v) => m.top + ph - v * ph; // erro em 0..100%

  const line = (fn) => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.targetRps).toFixed(1)},${fn(p).toFixed(1)}`).join(' ');

  let grid = '';
  for (let i = 0; i <= 5; i++) {
    const yv = (maxY / 5) * i;
    const y = Y(yv);
    grid += `<line x1="${m.left}" x2="${m.left + pw}" y1="${y}" y2="${y}" stroke="#e5e7eb"/>`;
    grid += `<text x="${m.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#374151">${yv.toFixed(0)}</text>`;
    grid += `<text x="${m.left + pw + 8}" y="${y + 4}" font-size="11" fill="#dc2626">${(i * 20)}%</text>`;
  }
  points.forEach((p) => {
    grid += `<text x="${X(p.targetRps)}" y="${m.top + ph + 18}" text-anchor="middle" font-size="11" fill="#374151">${p.targetRps}</text>`;
  });

  const dots = points
    .map((p) => `<circle cx="${X(p.targetRps)}" cy="${Y(p.p95)}" r="4" fill="#2563eb"/>`)
    .join('');

  let kneeMark = '';
  if (kneeIdx >= 0) {
    const k = points[kneeIdx];
    kneeMark = `
      <line x1="${X(k.targetRps)}" x2="${X(k.targetRps)}" y1="${m.top}" y2="${m.top + ph}" stroke="#16a34a" stroke-width="2" stroke-dasharray="6 4"/>
      <circle cx="${X(k.targetRps)}" cy="${Y(k.p95)}" r="8" fill="none" stroke="#16a34a" stroke-width="3"/>
      <text x="${X(k.targetRps) + 8}" y="${m.top + 14}" font-size="12" font-weight="bold" fill="#16a34a">KNEE POINT: ${k.targetRps} req/s</text>`;
  }
  let breakMark = '';
  if (breakIdx >= 0) {
    const b = points[breakIdx];
    breakMark = `
      <line x1="${X(b.targetRps)}" x2="${X(b.targetRps)}" y1="${m.top}" y2="${m.top + ph}" stroke="#dc2626" stroke-width="2" stroke-dasharray="2 4"/>
      <text x="${X(b.targetRps) - 8}" y="${m.top + 30}" text-anchor="end" font-size="12" font-weight="bold" fill="#dc2626">BREAKPOINT: ${b.targetRps} req/s</text>`;
  }

  return `
<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="16" font-weight="bold" fill="#111827">Carga x Latência p95 (Knee Point)</text>
  ${grid}
  <path d="${line((p) => Y(p.p95))}" fill="none" stroke="#2563eb" stroke-width="3"/>
  <path d="${line((p) => YE(p.errorRate))}" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 3"/>
  ${dots}
  ${kneeMark}
  ${breakMark}
  <text x="${m.left + pw / 2}" y="${H - 15}" text-anchor="middle" font-size="12" fill="#374151">Carga aplicada (req/s)</text>
  <text transform="translate(18 ${m.top + ph / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#2563eb">Latência p95 (ms)</text>
  <text transform="translate(${W - 12} ${m.top + ph / 2}) rotate(90)" text-anchor="middle" font-size="12" fill="#dc2626">Taxa de erro (%)</text>
</svg>`;
}

function buildHtml(points, kneeIdx, breakIdx) {
  const rows = points
    .map((p, i) => {
      const cls = i === kneeIdx ? 'knee' : i === breakIdx ? 'break' : '';
      return `<tr class="${cls}">
        <td>${p.step}</td><td>${p.targetRps}</td><td>${p.achievedRps.toFixed(1)}</td>
        <td>${p.p50.toFixed(0)}</td><td>${p.p95.toFixed(0)}</td><td>${(p.errorRate * 100).toFixed(1)}%</td></tr>`;
    })
    .join('');

  const kneeTxt = kneeIdx >= 0
    ? `O <b>knee point</b> foi em <b>${points[kneeIdx].targetRps} req/s</b>: a partir daí a latência cresce de forma acelerada. Esta é a capacidade <i>prática</i> recomendada.`
    : 'Não foi possível detectar o knee point (curva praticamente linear ou plana).';
  const breakTxt = breakIdx >= 0
    ? `O <b>breakpoint</b> (p95 &gt; ${BREAK_P95_MS}ms ou erros &gt; ${BREAK_ERROR_RATE * 100}%) ocorreu em <b>${points[breakIdx].targetRps} req/s</b>.`
    : 'O sistema NÃO atingiu o breakpoint nesta faixa de carga: aumente RPS_INCREMENT/STEPS para ir além.';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Knee Point Report</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#111827}
  table{border-collapse:collapse;width:100%;margin-top:16px}
  th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:right}
  th{background:#f3f4f6} tr.knee{background:#dcfce7} tr.break{background:#fee2e2}
  .box{background:#f9fafb;border-left:4px solid #2563eb;padding:10px 14px;margin:12px 0}
</style></head><body>
<h1>Relatório de Breakpoint Test</h1>
<div class="box">${kneeTxt}<br>${breakTxt}</div>
${buildChart(points, kneeIdx, breakIdx)}
<table>
  <tr><th>Degrau</th><th>Alvo (req/s)</th><th>Entregue (req/s)</th><th>p50 (ms)</th><th>p95 (ms)</th><th>Erros</th></tr>
  ${rows}
</table>
<h3>Como interpretar</h3>
<ul>
  <li><b>Antes do knee:</b> latência estável; o sistema tem folga.</li>
  <li><b>No knee:</b> o sistema começa a saturar (filas, CPU, pool de conexões...).</li>
  <li><b>Depois do knee:</b> pequenas variações de carga causam grandes aumentos de latência.</li>
  <li><b>"Entregue" &lt; "Alvo":</b> o k6 não conseguiu enviar a taxa pedida (sinal de saturação do servidor ou do gerador de carga).</li>
</ul>
</body></html>`;
}

export function handleSummary(data) {
  const points = collectPoints(data);

  if (points.length < 3) {
    return { stdout: 'Poucos dados para calcular o knee point.\n' };
  }

  const kneeIdx = findKnee(
    points.map((p) => p.targetRps),
    points.map((p) => p.p95)
  );
  const breakIdx = points.findIndex(
    (p) => p.p95 > BREAK_P95_MS || p.errorRate > BREAK_ERROR_RATE
  );

  let out = '\n===== RESULTADO DO BREAKPOINT TEST =====\n';
  out += 'Degrau | Alvo rps | Entregue | p95 (ms) | Erros\n';
  points.forEach((p) => {
    out += `${String(p.step).padStart(6)} | ${String(p.targetRps).padStart(8)} | ${p.achievedRps.toFixed(1).padStart(8)} | ${p.p95.toFixed(0).padStart(8)} | ${(p.errorRate * 100).toFixed(1)}%\n`;
  });
  out += kneeIdx >= 0 ? `\nKNEE POINT : ${points[kneeIdx].targetRps} req/s\n` : '\nKNEE POINT : não detectado\n';
  out += breakIdx >= 0 ? `BREAKPOINT : ${points[breakIdx].targetRps} req/s\n` : 'BREAKPOINT : não atingido\n';
  out += 'Gráfico salvo em: knee-point-report.html\n';

  return {
    stdout: out + '\n' + textSummary(data, { indent: ' ', enableColors: true }),
    'knee-point-report.html': buildHtml(points, kneeIdx, breakIdx),
    'breakpoint-data.json': JSON.stringify({ points, knee: points[kneeIdx] || null, breakpoint: points[breakIdx] || null }, null, 2),
  };
}
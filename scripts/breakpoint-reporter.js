/**
 * ============================================================================
 * BREAKPOINT TEST REPORTER - Gerador de Relatório Visual do Knee Point
 * ============================================================================
 * 
 * Este módulo gera um relatório HTML interativo que visualiza:
 * 1. Throughput vs Target Rate (para identificar o breakpoint)
 * 2. Latência vs Target Rate (para identificar o knee point)
 * 3. Marcação visual dos pontos críticos
 * 
 * Como usar:
 *   const { generateBreakpointReport } = require('./breakpoint-reporter.js');
 *   const html = generateBreakpointReport(jsonData);
 *   fs.writeFileSync('report.html', html);
 */

const fs = require('fs');

/**
 * Calcula o Knee Point usando o algoritmo Kneedle simplificado
 * Encontra o ponto de máxima curvatura na curva de latência
 */
function findKneePoint(throughputs, latencies) {
  if (throughputs.length < 3) return { index: 0, throughput: 0, latency: 0 };

  // Normalizar dados para [0, 1]
  const maxT = Math.max(...throughputs);
  const maxL = Math.max(...latencies);
  
  const normalizedT = throughputs.map(t => t / maxT);
  const normalizedL = latencies.map(l => l / maxL);

  // Calcular distância de cada ponto para a linha (0,0) -> (1,1)
  const distances = normalizedT.map((t, i) => {
    const l = normalizedL[i];
    // Distância perpendicular à linha y=x
    return Math.abs(l - t) / Math.sqrt(2);
  });

  // Encontrar o ponto com maior distância (knee point)
  const maxDistance = Math.max(...distances);
  const kneeIndex = distances.indexOf(maxDistance);

  return {
    index: kneeIndex,
    throughput: throughputs[kneeIndex],
    latency: latencies[kneeIndex],
  };
}

/**
 * Encontra o Breakpoint (ponto onde throughput estagna)
 */
function findBreakpoint(throughputs, targetRates) {
  if (throughputs.length < 2) return { index: 0, throughput: 0, targetRate: 0 };

  // Encontrar onde o throughput para de crescer significativamente
  let breakpointIndex = 0;
  let maxThroughput = 0;

  for (let i = 1; i < throughputs.length; i++) {
    const growth = throughputs[i] - throughputs[i - 1];
    const growthRate = growth / throughputs[i - 1];

    // Se o crescimento é menor que 5% e já passamos de 50% do máximo, é o breakpoint
    if (growthRate < 0.05 && throughputs[i] > maxThroughput * 0.5) {
      breakpointIndex = i;
      break;
    }

    if (throughputs[i] > maxThroughput) {
      maxThroughput = throughputs[i];
    }
  }

  return {
    index: breakpointIndex,
    throughput: throughputs[breakpointIndex],
    targetRate: targetRates[breakpointIndex],
  };
}

/**
 * Gera o relatório HTML completo
 */
function generateBreakpointReport(jsonFilePath, outputHtmlPath) {
  // Ler o JSON do k6
  const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
  const lines = jsonData.trim().split('\n');
  
  // Extrair métricas time-series
  const timeSeriesData = [];
  
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'Point' && data.metric === 'http_req_duration') {
        timeSeriesData.push({
          timestamp: data.data.time,
          value: data.data.value,
        });
      }
    } catch (e) {
      // Ignorar linhas inválidas
    }
  }

  // Agrupar dados por intervalos de 5 segundos
  const intervalMs = 5000;
  const groupedData = {};
  
  for (const point of timeSeriesData) {
    const interval = Math.floor(new Date(point.timestamp).getTime() / intervalMs) * intervalMs;
    if (!groupedData[interval]) {
      groupedData[interval] = [];
    }
    groupedData[interval].push(point.value);
  }

  // Calcular médias por intervalo
  const timestamps = Object.keys(groupedData).sort();
  const latencies = timestamps.map(t => {
    const values = groupedData[t];
    return values.reduce((a, b) => a + b, 0) / values.length;
  });

  // Simular throughput (req/s) baseado no número de requisições por intervalo
  const throughputs = timestamps.map(t => {
    return (groupedData[t].length / (intervalMs / 1000)).toFixed(2);
  });

  // Calcular Knee Point e Breakpoint
  const kneePoint = findKneePoint(throughputs.map(Number), latencies);
  const breakpoint = findBreakpoint(throughputs.map(Number), throughputs.map(Number));

  // Gerar HTML
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Breakpoint Test Report - Knee Point Analysis</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #7546c9;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      margin-top: 30px;
    }
    .chart-container {
      position: relative;
      height: 400px;
      margin: 30px 0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .metric-card.knee {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .metric-card.breakpoint {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    .metric-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
    }
    .metric-unit {
      font-size: 16px;
      opacity: 0.8;
    }
    .info-box {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
    }
    tr:hover {
      background: #f9f9f9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Breakpoint Test Report</h1>
    <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Throughput Máximo</div>
        <div class="metric-value">${Math.max(...throughputs.map(Number)).toFixed(0)} <span class="metric-unit">req/s</span></div>
      </div>
      <div class="metric-card knee">
        <div class="metric-label">Knee Point (Latência)</div>
        <div class="metric-value">${kneePoint.latency.toFixed(0)} <span class="metric-unit">ms</span></div>
        <div class="metric-label">em ${kneePoint.throughput.toFixed(0)} req/s</div>
      </div>
      <div class="metric-card breakpoint">
        <div class="metric-label">Breakpoint</div>
        <div class="metric-value">${breakpoint.throughput.toFixed(0)} <span class="metric-unit">req/s</span></div>
      </div>
    </div>

    <div class="info-box">
      <strong>📊 O que é o Knee Point?</strong><br>
      É o ponto onde a latência começa a subir desproporcionalmente em relação ao throughput. 
      Antes dele, o sistema está na "zona saudável". Depois dele, o sistema entra em "sobrecarga".
    </div>

    <h2>📈 Throughput vs Tempo</h2>
    <div class="chart-container">
      <canvas id="throughputChart"></canvas>
    </div>

    <h2>⏱️ Latência vs Throughput (Knee Point)</h2>
    <div class="chart-container">
      <canvas id="kneePointChart"></canvas>
    </div>

    <div class="warning-box">
      <strong>💡 Interpretação:</strong><br>
      • <strong>Knee Point:</strong> ${kneePoint.throughput.toFixed(0)} req/s — A partir daqui, a latência começa a degradar significativamente.<br>
      • <strong>Breakpoint:</strong> ${breakpoint.throughput.toFixed(0)} req/s — O sistema não consegue processar mais requisições além deste ponto.<br>
      • <strong>Margem de segurança recomendada:</strong> Operar abaixo de 70% do Knee Point (${(kneePoint.throughput * 0.7).toFixed(0)} req/s).
    </div>

    <h2>📋 Dados Detalhados</h2>
    <table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Throughput (req/s)</th>
          <th>Latência Média (ms)</th>
          <th>Requisições</th>
        </tr>
      </thead>
      <tbody>
        ${timestamps.map((t, i) => `
          <tr>
            <td>${new Date(Number(t)).toLocaleTimeString('pt-BR')}</td>
            <td>${throughputs[i]}</td>
            <td>${latencies[i].toFixed(2)}</td>
            <td>${groupedData[t].length}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <script>
    // Gráfico de Throughput
    const throughputCtx = document.getElementById('throughputChart').getContext('2d');
    new Chart(throughputCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(timestamps.map(t => new Date(Number(t)).toLocaleTimeString('pt-BR')))},
        datasets: [{
          label: 'Throughput (req/s)',
          data: ${JSON.stringify(throughputs)},
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Requisições por segundo' } },
          x: { title: { display: true, text: 'Tempo' } }
        }
      }
    });

    // Gráfico do Knee Point
    const kneeCtx = document.getElementById('kneePointChart').getContext('2d');
    new Chart(kneeCtx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Latência vs Throughput',
          data: ${JSON.stringify(throughputs.map((t, i) => ({ x: Number(t), y: latencies[i] })))},
          borderColor: '#f5576c',
          backgroundColor: 'rgba(245, 87, 108, 0.6)',
          pointRadius: 6,
        }, {
          label: 'Knee Point',
          data: [{ x: ${kneePoint.throughput}, y: ${kneePoint.latency} }],
          borderColor: '#ff0000',
          backgroundColor: '#ff0000',
          pointRadius: 12,
          pointStyle: 'star',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { mode: 'nearest', intersect: true },
        },
        scales: {
          x: { title: { display: true, text: 'Throughput (req/s)' }, beginAtZero: true },
          y: { title: { display: true, text: 'Latência (ms)' }, beginAtZero: true }
        }
      }
    });
  </script>
</body>
</html>
  `;

  // Salvar HTML
  fs.writeFileSync(outputHtmlPath, html, 'utf8');
  console.log(`✅ Relatório gerado: ${outputHtmlPath}`);
}

// Se executado diretamente via linha de comando
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Uso: node breakpoint-reporter.js <input.json> <output.html>');
    process.exit(1);
  }
  generateBreakpointReport(args[0], args[1]);
}

module.exports = { generateBreakpointReport, findKneePoint, findBreakpoint };
import http from 'k6/http';
import { check, sleep } from 'k6';
import { thresholds } from '../config/thresholds.js';

/**
 * ============================================================================
 * TEORIA: TESTE DE RESISTÊNCIA (SOAK TEST / ENDURANCE TEST)
 * ============================================================================
 * 
 * O que é um Teste de Resistência (Soak Test)?
 * --------------------------------------------
  É um teste de performance que submete o sistema a uma carga NORMAL (similar 
  ao Load Test), mas por um período EXTREMAMENTE LONGO (horas ou até dias).
  
  Diferença chave para o Teste de Carga:
  - Load Test: Carga normal por 5-15 minutos. Foco: "O sistema atende os SLAs?"
  - Soak Test: Carga normal por 1h-24h+. Foco: "O sistema mantém a estabilidade 
    ao longo do tempo?"
  
  Objetivos principais:
  1. Detectar vazamentos de memória (memory leaks): A memória cresce 
     continuamente até o sistema travar (OOM - Out of Memory)?
  2. Identificar vazamento de conexões: Conexões de banco de dados, HTTP 
     clients, ou sockets não estão sendo fechados corretamente?
  3. Encontrar problemas de acumulação: Logs crescendo sem rotação, caches 
     estourando, filas acumulando mensagens não processadas.
  4. Validar estabilidade de longo prazo: O sistema mantém a mesma latência 
     após 8 horas que tinha na primeira hora?
  5. Simular cenários reais: Sistemas de produção rodam 24/7. Um teste de 
     10 minutos não revela problemas que só aparecem após dias de operação.
  
  Cenários reais de uso:
  - APIs de e-commerce que precisam ficar estáveis durante semanas de Black Friday.
  - Sistemas bancários que processam transações 24/7 sem reinicializações.
  - SaaS B2B onde clientes esperam disponibilidade contínua.
  - Microsserviços que não são reiniciados frequentemente (ex: stateful services).
  
  Conceitos aplicados neste arquivo:
  1. Carga constante e moderada: Não queremos estressar o sistema, apenas 
     mantê-lo trabalhando continuamente.
  2. Duração longa: Para fins didáticos, usaremos 10 minutos. Em produção, 
     o ideal é 1h, 4h, 8h ou até 24h.
  3. Monitoramento de degradação gradual: O foco não é um pico de latência, 
     mas sim uma curva ascendente lenta ao longo do tempo.
  4. Thresholds rigorosos: Como a carga é "normal", esperamos que todos os 
     SLAs sejam cumpridos. Se não forem, há um problema de estabilidade.
  
  O que observar durante um Soak Test:
  ┌─────────────────────────────────────────────────────────┐
  │ Hora 1: Latência p(95) = 150ms                          │
  │ Hora 2: Latência p(95) = 155ms                          │
  │ Hora 3: Latência p(95) = 180ms                          │
  │ Hora 4: Latência p(95) = 250ms ← ALERTA!                │
  │ Hora 5: Latência p(95) = 500ms ← VAZAMENTO DETECTADO!   │
  └─────────────────────────────────────────────────────────┘
  
  Se a latência cresce linearmente ao longo do tempo, é um forte indício de 
  vazamento de memória, conexões não liberadas, ou garbage collection 
  sobrecarregado.
 */

export const options = {
  scenarios: {
    soak_scenario: {
      executor: 'constant-vus',
      vus: 20, // Carga moderada e constante (similar ao load test)
      // NOTA DIDÁTICA: Para fins de estudo, usamos 10 minutos.
      // Em produção, o ideal seria '1h', '4h', '8h' ou até '24h'.
      duration: '10m',
    },
  },
  
  // Thresholds rigorosos: como a carga é "normal", esperamos perfeição
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1.00'],
  },
};

const BASE_URL = 'https://test-api.k6.io';

export default function () {
  const res = http.get(`${BASE_URL}/public/crocodiles/`);

  check(res, {
    'status é 200': (r) => r.status === 200,
    'tempo de resposta < 500ms': (r) => r.timings.duration < 500,
    'payload é um array com dados': (r) => {
      try {
        const data = r.json();
        return Array.isArray(data) && data.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  // Think time realista: usuários reais leem, pensam, navegam
  sleep(1);
}

/**
 * ============================================================================
 * IMPORTANTE: Como analisar os resultados de um Soak Test
 * ============================================================================
  
  Ao contrário de outros testes onde olhamos para o resumo final, no Soak Test 
  precisamos analisar a EVOLUÇÃO das métricas ao longo do tempo.
  
  Ferramentas recomendadas:
  1. Grafana + InfluxDB/Prometheus: Visualização em tempo real com dashboards.
  2. k6 Cloud: Gráficos interativos mostrando a tendência temporal.
  3. Exportar para CSV e plotar no Excel: `k6 run --out csv=soak.csv tests/04-soak-test.js`
  
  Sinais de alerta (red flags):
  - Latência crescendo linearmente ao longo do tempo.
  - Taxa de erros aumentando gradualmente (ex: 0% na hora 1, 2% na hora 4).
  - Throughput (req/s) caindo mesmo com VUs constantes.
  - Uso de memória do servidor subindo continuamente (monitorar via APM).
  
  Se você observar esses padrões, investigue:
  - Vazamento de memória no código da aplicação.
  - Connection pool do banco de dados esgotando.
  - Garbage collection (GC) sobrecarregado (ex: Java, Go, Node.js).
  - Logs ou arquivos temporários crescendo sem rotação.
  - Cache não invalidando corretamente e consumindo memória.
 */
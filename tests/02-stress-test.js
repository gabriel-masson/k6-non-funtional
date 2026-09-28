import http from 'k6/http';
import { check, sleep } from 'k6';
import { thresholds } from '../config/thresholds.js';

/**
 * ============================================================================
 * TEORIA: TESTE DE STRESS (STRESS TEST)
 * ============================================================================
 * 
 * O que é um Teste de Stress?
 * ---------------------------
  É o teste que leva o sistema ALÉM dos seus limites operacionais normais,
  aumentando a carga progressivamente até que ele comece a falhar ou degradar.
  O objetivo NÃO é ver o sistema funcionando bem — é descobrir ONDE e COMO
  ele quebra.
  
  Objetivos principais:
  1. Descobrir o ponto de ruptura (breaking point) do sistema.
  2. Identificar gargalos (CPU, memória, banco de dados, rede, locks).
  3. Observar como o sistema se comporta sob carga extrema:
     - Degradação gradual? (bom sinal — graceful degradation)
     - Colapso súbito? (mau sinal — catastrophic failure)
  4. Validar mecanismos de recuperação (o sistema volta ao normal depois?).
  
  Diferença chave para o Teste de Carga:
  - Load Test: Carga NORMAL. Espera-se que tudo funcione perfeitamente.
  - Stress Test: Carga EXTREMA. Espera-se encontrar falhas e limites.
  
  Conceitos aplicados neste arquivo:
  1. abortOnFail: Como o teste pode ser longo e consumir recursos, se o 
     threshold crítico falhar cedo, abortamos para economizar tempo/dinheiro.
  2. Rampas agressivas: Subimos VUs além do esperado para forçar o limite.
  3. Observação de degradação: Métricas como p(95) vão subir — é esperado.
     O importante é ver QUANDO e COMO isso acontece.
  
  Padrão clássico de um Stress Test (fases):
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Aquecimento: carga baixa para estabilizar o sistema  │
  │ 2. Subida: aumento gradual até além do limite esperado  │
  │ 3. Pico: manutenção no extremo para observar falhas     │
  │ 4. Recuperação: redução para ver se o sistema volta     │
  └─────────────────────────────────────────────────────────┘
 */

// Configuração do teste
export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Fase 1: Aquecimento (carga leve)
        { duration: '30s', target: 10 },
        
        // Fase 2: Subida progressiva até além do limite normal
        { duration: '20s', target: 50 },   // Carga "normal alta"
        { duration: '20s', target: 100 },  // Além do esperado
        { duration: '20s', target: 200 },  // Estresse real
        
        // Fase 3: Pico extremo (observar degradação)
        { duration: '20s', target: 200 },  // Mantém no extremo
        
        // Fase 4: Recuperação (ver se o sistema volta ao normal)
        { duration: '10s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  
  // Thresholds com abortOnFail para estresse
  // Se o sistema já estiver colapsando cedo, não faz sentido continuar
  thresholds: {
    http_req_duration: [
      { threshold: 'p(95)<1000', abortOnFail: false }, // Mais brandos que no load test
      { threshold: 'p(99)<2000', abortOnFail: false },
    ],
    http_req_failed: [
      { threshold: 'rate<0.05', abortOnFail: false }, // Aceitamos até 5% de erro no stress
    ],
    checks: [
      { threshold: 'rate>0.90', abortOnFail: false }, // 90% é aceitável no stress
    ],
  },
  
  // No stress test, esperamos que alguns thresholds falhem — é o objetivo!
  // Por isso abortOnFail está como false: queremos VER a degradação, não parar.
};

const BASE_URL = 'https://test-api.k6.io';

export default function () {
  const res = http.get(`${BASE_URL}/public/crocodiles/`);

  check(res, {
    'status é 200': (r) => r.status === 200,
    'tempo de resposta < 2000ms': (r) => r.timings.duration < 2000,
    'payload é um array': (r) => {
      try {
        const data = r.json();
        return Array.isArray(data);
      } catch (e) {
        return false;
      }
    },
  });

  // Think time reduzido no stress test
  // Usuários sob estresse ainda "pensam", mas o foco é aplicar carga máxima
  sleep(0.5);
}
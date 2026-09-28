import http from 'k6/http';
import { check, sleep } from 'k6';
import { thresholds } from '../config/thresholds.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";


/**
 * ============================================================================
 * TEORIA: TESTE DE PICO (SPIKE TEST)
 * ============================================================================
 * 
 * O que é um Teste de Pico (Spike Test)?
 * --------------------------------------
 É um tipo de teste de performance que simula um aumento súbito, extremo e
 repentino na carga do sistema, seguido por uma queda igualmente rápida.
 
 Diferença chave para o Teste de Stress:
 - Stress Test: Aumenta a cargagradualmente* até encontrar o limite de ruptura.
 - Spike Test: A carga sobeinstantaneamente* (ou em poucos segundos) para um 
   volume muito acima do normal, testando a reação imediata do sistema.
 
 Objetivos principais:
 1. Avaliar a elasticidade do sistema: Ele consegue escalar (auto-scaling) 
    rápido o suficiente para absorver o choque?
 2. Observar o comportamento durante o pico: O sistema rejeita requisições 
    de forma elegante (ex: HTTP 429 Too Many Requests) ou colapsa totalmente?
 3. Validar a recuperação: Após o pico passar, o sistema retorna ao estado 
    normal rapidamente ou fica "machucado" (ex: conexões de banco esgotadas, 
    filas entupidas, memória vazada)?
 
 Cenários reais de uso:
 - Black Friday / Cyber Monday (abertura das vendas às 00:00).
 - Lançamento de um produto viral ou ingressos de um show famoso.
 - Uma menção em um programa de TV de grande audiência (Efeito Oprah).
 - Ataques de DDoS (embora o foco aqui seja resiliência, não segurança).
 
 Conceitos aplicados neste arquivo:
 1. Rampa ultra-rápida: Subimos de 0 para um número alto de VUs em apenas 
    alguns segundos (ex: 5s a 10s).
 2. Período de estabilização pós-pico: Mantemos uma carga baixa no final para 
    verificar se o sistema se recupera (métricas voltam ao normal).
 3. Thresholds tolerantes: Durante o pico, é aceitável que alguns requests 
    falhem ou demorem mais. O foco é a recuperação, não a perfeição durante o caos.
 */

export const options = {
  scenarios: {
    spike_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Fase 1: Estado normal (baseline)
        { duration: '10s', target: 5 },
        
        // Fase 2: O PICO (Spike) - Aumento brutal e repentino
        { duration: '5s', target: 500 }, // Sobe de 5 para 100 VUs em apenas 5 segundos!
        
        // Fase 3: Sustentação do pico (observar o caos)
        { duration: '15s', target: 500 },
        
        // Fase 4: Queda abrupta (o pico passou)
        { duration: '5s', target: 5 },
        
        // Fase 5: Recuperação (o sistema volta ao normal?)s
        { duration: '15s', target: 5 },
        
        // Fase 6: Encerramento
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  
  // Thresholds ajustados para um cenário de pico
  thresholds: {
    // Durante o pico, a latência vai subir. O importante é que ela volte a cair na fase de recuperação.
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    
    // Aceitamos uma taxa de erro maior DURANTE o pico, mas o sistema não pode morrer totalmente.
    http_req_failed: ['rate<0.10'], // Até 10% de falha é aceitável no pico
    
    // O sistema deve manter pelo menos 80% dos checks passando no geral.
    checks: ['rate>0.80'],
  },
};

const BASE_URL = 'https://test-api.k6.io';

export default function () {
  const res = http.get(`${BASE_URL}/public/crocodiles/`);

  check(res, {
    'status é 200 ou 429 (Too Many Requests)': (r) => r.status === 200 || r.status === 429,
    'tempo de resposta < 3000ms': (r) => r.timings.duration < 3000,
  });

  // Think time muito curto ou zero durante o pico para simular pânico/urgência do usuário
  sleep(0.2);
}

export function handleSummary(data) {
  return {
    "reports/spike-test-report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
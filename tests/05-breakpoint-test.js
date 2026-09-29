import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

/**
 ============================================================================
 TEORIA: TESTE DE PONTO DE RUPTURA (BREAKPOINT TEST)
 ============================================================================
 
 O que é um Teste de Breakpoint?
 -------------------------------
 É o teste que descobre o LIMITE MÁXIMO ABSOLUTO do sistema — o ponto exato
 onde ele para de funcionar corretamente. Diferente do Stress Test (que
 aumenta VUs e observa degradação), o Breakpoint Test foca em encontrar o
 THROUGHPUT MÁXIMO (requisições por segundo) que o sistema consegue processar
 antes de colapsar.
 
 Diferença fundamental entre Stress e Breakpoint:
 ┌─────────────────────────────────────────────────────────────────────┐
 │ STRESS TEST:                          BREAKPOINT TEST:              │
 │ "Vou aumentar os usuários até o       "Vou aumentar a taxa de       │
 │  sistema degradar e ver como ele      requisições até o sistema     │
 │  se comporta."                        não aguentar mais."           │
 │                                                                     │
 │ Foco: DEGRADAÇÃO                      Foco: LIMITE MÁXIMO           │
 │ Métrica: VUs                          Métrica: Throughput (req/s)   │
 │ Executor: ramping-vus                 Executor: ramping-arrival-rate│
 └─────────────────────────────────────────────────────────────────────┘
 
 Por que usar ramping-arrival-rate?
 ----------------------------------
 O executor ramping-arrival-rate FORÇA o sistema a processar uma taxa
 específica de requisições por segundo. Se o sistema ficar lento, o k6
 automaticamente cria mais VUs para manter a taxa. Isso é fundamental
 para o Breakpoint Test porque:
 
 1. Com ramping-vus: o sistema pode ficar lento, mas os VUs continuam
    enviando requisições "devagar" — você não descobre o limite real.
 2. Com ramping-arrival-rate: você exige 100 req/s, depois 200, depois
    500... até o sistema não conseguir mais. Aí você achou o breakpoint!
 
 Objetivos principais:
 1. Descobrir o throughput máximo (req/s) do sistema.
 2. Identificar o "knee point" (ponto do joelho) — onde a latência começa
    a subir desproporcionalmente em relação ao throughput.
 3. Fornecer dados concretos para decisões de dimensionamento:
    - Quantos pods/instâncias precisamos para X req/s?
    - Qual o limite do banco de dados?
    - Onde está o gargalo principal?
 4. Estabelecer limites de segurança para auto-scaling.
 
 Conceito do "Knee Point" (Ponto do Joelho):
 -------------------------------------------
 É o ponto onde o sistema passa de "saudável" para "sobrecarregado".
 Antes dele: throughput sobe linearmente, latência estável.
 Depois dele: throughput estagna, latência explode.
 
 Gráfico ideal:
 
 Throughput (req/s)
     │                    ╱────── ← Breakpoint (sistema no limite)
     │                 ╱╱
     │              ╱╱   ← Knee Point (início da degradação)
     │           ╱╱
     │        ╱╱
     │     ╱╱   ← Zona saudável (linear)
     │  ╱╱
     │╱
     └─────────────────────────── Carga (target rate)
 
 Latência (p95)
     │                        ╱
     │                      ╱
     │                   ╱╱   ← Explosão da latência
     │                ╱╱
     │             ╱╱
     │          ╱╱
     │  ────────      ← Zona estável
     │
     └─────────────────────────── Carga (target rate)
 
 Conceitos aplicados neste arquivo:
 1. ramping-arrival-rate: Força o throughput a subir progressivamente.
 2. preAllocatedVUs + maxVUs: Reserva VUs iniciais e permite expansão.
 3. Thresholds tolerantes: Esperamos falhas — o objetivo é encontrar o limite.
 4. Duração longa o suficiente: Permite observar a transição saudável → colapso.
 5. handleSummary: Gera relatório HTML para análise visual do breakpoint.
 */

export const options = {
  scenarios: {
    breakpoint_scenario: {
      executor: 'ramping-arrival-rate',
      
      // Começa com 0 req/s e sobe até 500 req/s em 10 minutos
      startRate: 0,
      timeUnit: '1s',
      
      // Reserva inicial de VUs (será expandido automaticamente se necessário)
      preAllocatedVUs: 50,
      
      // Limite máximo de VUs que o k6 pode criar
      // Se atingir esse limite e ainda não encontrar o breakpoint,
      // aumente este valor e rode novamente.
      maxVUs: 500,
      
      stages: [
        // Fase 1: Aquecimento (carga baixa para estabilizar)
        { duration: '30s', target: 10 },
        
        // Fase 2: Zona saudável (throughput sobe linearmente)
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        
        // Fase 3: Aproximação do limite (latência começa a subir)
        { duration: '1m', target: 200 },
        { duration: '1m', target: 300 },
        
        // Fase 4: Perto do breakpoint (sistema sobrecarregado)
        { duration: '1m', target: 400 },
        { duration: '1m', target: 500 },
        
        // Fase 5: Tentativa de ultrapassar o limite (colapso esperado)
        { duration: '1m', target: 600 },
        { duration: '1m', target: 700 },
        
        // Fase 6: Recuperação (ver se o sistema volta ao normal)
        { duration: '30s', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  
  // Thresholds MUITO tolerantes — esperamos que o sistema falhe!
  // O objetivo NÃO é passar nos thresholds, é encontrar o ponto de ruptura.
  thresholds: {
    // Latência vai subir muito — aceitamos até 10 segundos
    http_req_duration: ['p(95)<10000', 'p(99)<15000'],
    
    // Aceitamos até 50% de falhas (o sistema VAI falhar no breakpoint)
    http_req_failed: ['rate<0.50'],
    
    // Aceitamos 50% de checks falhando
    checks: ['rate>0.50'],
    
    // Métrica customizada: queremos saber quantas iterações foram completadas
    // (indica o throughput real alcançado)
    iterations: ['count>0'],
  },
};

const BASE_URL = 'https://test-api.k6.io';

export default function () {
  const res = http.get(`${BASE_URL}/public/crocodiles/`);

  check(res, {
    'status é 200': (r) => r.status === 200,
    'tempo de resposta < 10000ms': (r) => r.timings.duration < 10000,
  });

  // Sem sleep — queremos máxima taxa de requisições
  // O ramping-arrival-rate controla a taxa, não o sleep
}

/**
 * ============================================================================
 * GERAÇÃO DE RELATÓRIO HTML
 * ============================================================================
 * 
 * O relatório HTML é CRUCIAL para o Breakpoint Test porque permite visualizar
 * graficamente o "knee point" e o ponto de ruptura.
 * 
 * Após a execução, abra o arquivo reports/breakpoint-test-report.html no
 * navegador e procure pelos gráficos de:
 * - http_req_duration (latência ao longo do tempo)
 * - http_reqs (throughput ao longo do tempo)
 * - vus (usuários virtuais ao longo do tempo)
 * 
 * O breakpoint é o ponto onde:
 * 1. O throughput para de subir (estagna ou cai)
 * 2. A latência explode (sobe desproporcionalmente)
 * 3. O número de VUs atinge o máximo (maxVUs)
 */
export function handleSummary(data) {
  return {
    "reports/breakpoint-test-report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
/**
 * ============================================================================
 * TEORIA: CENÁRIOS DE EXECUÇÃO (SCENARIOS) EM TESTES NÃO FUNCIONAIS
 * ============================================================================
 *
 * O que são Scenarios no k6?
 * ---------------------------
 * Em testes não funcionais, a forma como a carga é aplicada ao sistema é tão
 * importante quanto a quantidade de carga. Um "cenário" define o padrão de
 * execução dos Usuários Virtuais (VUs) e das iterações ao longo do tempo.
 *
 * Por que modelar cenários é crucial?
 * -----------------------------------
 * Sistemas reais não recebem carga de forma perfeitamente linear e constante.
 * Modelar cenários permite simular comportamentos realistas, como:
 * - Acesso contínuo durante o horário comercial (Carga constante).
 * - Crescimento gradual até o horário de pico (Rampa de subida).
 * - Picos súbitos causados por campanhas de marketing ou falhas em cascata (Spike).
 *
 * Tipos de Executors (Executores) do k6 utilizados aqui:
 * 
 * 1. constant-vus: Mantém um número fixo de VUs executando o máximo de 
 *    iterações possível. Ideal para testes de Soak (resistência).
 * 
 * 2. ramping-vus: Aumenta ou diminui gradualmente o número de VUs. Ideal 
 *    para testes de Load (carga) e Stress (estresse), simulando a chegada 
 *    progressiva de usuários.
 * 
 * 3. ramping-arrival-rate: Foca na *taxa de iterações por segundo* (throughput),
 *    ajustando automaticamente o número de VUs necessários para manter essa taxa.
 *    É o mais realista para simular tráfego de produção, pois o negócio geralmente
 *    pensa em "requisições por segundo", não em "número de usuários".
 * 
 * 4. shared-iterations: Distribui um número total de iterações entre os VUs.
 *    Útil para testes de Breakpoint ou quando se quer um volume exato de dados.
 */

export const scenarios = {
  // 1. Cenário de Carga Constante (Útil para Soak / Resistência)
  constant_load: {
    executor: 'constant-vus',
    vus: 10, // Mantém 10 usuários virtuais ativos
    duration: '30s', // Duração do teste (ajustar conforme necessidade, ex: '1h')
    gracefulRampDown: '10s', // Tempo para finalizar requisições pendentes
  },

  // 2. Cenário de Rampa de Usuários (Útil para Load e Stress)
  ramping_users: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 20 }, // Sobe para 20 VUs em 15s
      { duration: '15s', target: 20 },  // Mantém 20 VUs por 1 minuto
      { duration: '10s', target: 0 },  // Desce para 0 VUs em 15s
    ],
    gracefulRampDown: '10s',
  },

  // 3. Cenário de Taxa de Chegada (Útil para simular tráfego realista / Spike)
  ramping_arrival_rate: {
    executor: 'ramping-arrival-rate',
    startRate: 10, // Começa com 10 iterações por segundo
    timeUnit: '1s',
    preAllocatedVUs: 20, // VUs reservados inicialmente
    maxVUs: 50, // Limite máximo de VUs que o k6 pode alocar dinamicamente
    stages: [
      { duration: '10s', target: 50 }, // Aumenta a taxa para 50 iterações/segundo
      { duration: '15s', target: 50 },  // Mantém a taxa
      { duration: '10s', target: 0 },  // Reduz a taxa para 0
    ],
  },

  // 4. Cenário de Pico Súbito (Spike Test)
  spike_load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 }, // Pico extremamente rápido (100 VUs em 10s)
      { duration: '15s', target: 100 }, // Mantém o pico
      { duration: '10s', target: 0 },   // Queda rápida
    ],
    gracefulRampDown: '5s',
  },
};
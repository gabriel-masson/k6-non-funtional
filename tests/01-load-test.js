import http from 'k6/http';
import { check, sleep } from 'k6';
import { thresholds } from '../config/thresholds.js';
import { scenarios } from '../scenarios/common-scenarios.js';

/**
 * ============================================================================
 * TEORIA: TESTE DE CARGA (LOAD TEST)
 * ============================================================================
 * 
 * O que é um Teste de Carga?
 * --------------------------
 * É o tipo mais fundamental de teste de performance. Ele avalia o comportamento do sistema sob condições de carga *esperadas* ou *normais* de operação.
 * 
 * Objetivo Principal:
 * Verificar se o sistema atende aos requisitos de desempenho (SLAs/SLOs) quando submetido ao volume de usuários e transações previsto para o dia a dia ou para um pico de uso planejado (ex: Black Friday, se esse for o volume esperado).
 * 
 * Diferença chave para o Teste de Stress:
 * - Load Test: A carga está DENTRO dos limites operacionais normais. O sistema DEVE funcionar perfeitamente, sem degradação significativa.
 * - Stress Test: A carga está ALÉM dos limites normais, até o ponto de falha, 
 *   para descobrir o ponto de ruptura e como o sistema se recupera.
 * 
 * Conceitos aplicados neste arquivo:
 * 1. Think Time (sleep): Usuários reais não clicam infinitamente. Eles leem,  pensam e esperam. O `sleep()` simula esse comportamento, evitando que o teste sobrecarregue o servidor de forma irrealista.
 * 2. Checks: Validações funcionais leves (ex: status 200) que rodam junto com  o teste de carga para garantir que, além de rápido, o sistema está correto.
 * 3. Reutilização: Usamos os `scenarios` e `thresholds` centralizados, garantindo  padronização e facilidade de manutenção.
 */

// Configuração do teste
export const options = {
  // Utilizamos o cenário de rampa de usuários (sobe, mantém, desce)
  scenarios: {
    load_test_scenario: scenarios.ramping_users,
  },
  // Aplicamos os SLAs/SLOs definidos no arquivo de configuração
  thresholds: thresholds,
};

const BASE_URL = 'https://test-api.k6.io';

export default function () {
  // 1. Ação do usuário: Buscar uma lista de recursos (ex: crocodilos)
  const res = http.get(`${BASE_URL}/public/crocodiles/`);

  // 2. Validações (Checks)
  // Os checks NÃO interrompem o teste se falharem, mas são registrados nas métricas.
  // O threshold 'checks: rate==1.00' é que vai falhar o teste se houver erro aqui.
  check(res, {
    'status é 200': (r) => r.status === 200,
    'tempo de resposta da requisição < 500ms': (r) => r.timings.duration < 500,
    'payload é um array com dados': (r) => {
      try {
        const data = r.json();
        return Array.isArray(data) && data.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  // 3. Think Time (Tempo de Pensamento)
  // Simula 1 segundo de espera do usuário real antes da próxima iteração.
  // Isso é CRUCIAL para um teste de carga realista. Sem isso, o k6 dispararia
  // requisições na velocidade máxima da rede, o que raramente reflete a realidade.
  sleep(1);
}
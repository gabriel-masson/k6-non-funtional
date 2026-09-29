# 📋 Plano de Testes Não Funcionais

> **Projeto:** [Nome do Projeto]
> **Versão:** 1.0
> **Data:** [DD/MM/AAAA]
> **Autor:** [Nome]
> **Status:** [Draft | Em Revisão | Aprovado]

---

## 1. Objetivo

Descrever a estratégia de testes não funcionais para o sistema [nome],
garantindo que os atributos de qualidade (performance, estabilidade,
escalabilidade e resiliência) atendam aos requisitos de negócio e SLAs
contratuais.

---

## 2. Escopo

### 2.1 O que ESTÁ no escopo

| Componente | Endpoint / Fluxo | Criticidade |
|:---|:---|:---|
| API de Autenticação | `POST /auth/login` | 🔴 Crítico |
| API de Produtos | `GET /products` | 🟡 Alto |
| API de Checkout | `POST /checkout` | 🔴 Crítico |
| API de Busca | `GET /search?q=` | 🟡 Alto |

### 2.2 O que NÃO está no escopo

- Testes de segurança (penetration testing)
- Testes de usabilidade
- Testes funcionais (cobertos por testes unitários/e2e)
- APIs internas de administração

---

## 3. Requisitos Não Funcionais

### 3.1 Requisitos de Performance

| Métrica | Requisito | Origem |
|:---|:---|:---|
| Latência p95 | < 500ms | SLO interno |
| Latência p99 | < 1000ms | SLO interno |
| Taxa de erro | < 0,1% | SLA contratual (99,9%) |
| Throughput mínimo | 500 req/s | Requisito de negócio |
| Tempo de recuperação | < 30s após pico | Requisito de resiliência |

### 3.2 Requisitos de Disponibilidade

| Métrica | Requisito |
|:---|:---|
| Uptime mensal | 99,9% (máx 43min de downtime/mês) |
| RTO (Recovery Time Objective) | < 5 minutos |
| RPO (Recovery Point Objective) | < 1 minuto |

### 3.3 Requisitos de Escalabilidade

| Cenário | Volume Esperado |
|:---|:---|
| Dia normal | 50.000 req/hora |
| Pico (Black Friday) | 500.000 req/hora |
| Usuários simultâneos | 5.000 |

---

## 4. Estratégia de Testes

### 4.1 Matriz de Testes

| Tipo de Teste | Objetivo | Quando | Ferramenta | Duração |
|:---|:---|:---|:---|:---|
| **Load Test** | Validar SLAs sob carga normal | Todo PR (CI) | k6 | ~2 min |
| **Stress Test** | Encontrar gargalos e limites | Semanal (staging) | k6 | ~8 min |
| **Spike Test** | Validar elasticidade | Semanal (staging) | k6 | ~2 min |
| **Soak Test** | Detectar memory leaks | Quinzenal (staging) | k6 | 4h-8h |
| **Breakpoint Test** | Dimensionar infraestrutura | Mensal (staging) | k6 | ~10 min |

### 4.2 Ambiente de Testes

| Aspecto | Configuração |
|:---|:---|
| Infraestrutura | [Ex: Kubernetes, 4 pods, 2GB RAM cada] |
| Banco de dados | [Ex: PostgreSQL 15, 4 vCPUs, 16GB RAM] |
| Rede | [Ex: Mesma região, latência < 5ms] |
| Dados | [Ex: 1M de registros na tabela products] |
| Similaridade com prod | [Ex: 50% da capacidade de produção] |

> ⚠️ **IMPORTANTE:** O ambiente de teste deve ser o mais próximo possível
> de produção. Resultados em ambientes muito diferentes não são confiáveis.

---

## 5. Quality Gates

### 5.1 Gates por Nível de Criticidade

#### 🔴 Nível 1: CRÍTICO (Bloqueia deploy)

| Gate | Threshold | Justificativa |
|:---|:---|:---|
| Latência p95 | < 700ms | 2x o baseline (350ms). Se passar, há regressão grave |
| Taxa de erro HTTP | < 1% | Fluxos críticos não podem falhar massivamente |
| Checks funcionais | 100% | Respostas devem estar corretas |
| Regressão vs baseline | p95 não pode subir > 20% | Detecta degradação incremental |

#### 🟡 Nível 2: IMPORTANTE (Gera alerta, não bloqueia)

| Gate | Threshold | Justificativa |
|:---|:---|:---|
| Latência p95 | < 500ms | SLO interno |
| Latência p99 | < 1000ms | SLO interno |
| Taxa de erro | < 0,1% | SLA contratual |
| Throughput | > 500 req/s | Requisito de negócio |

#### 🟢 Nível 3: INFORMATIVO (Monitoramento)

| Gate | Threshold | Justificativa |
|:---|:---|:---|
| Latência p50 | < 200ms | Experiência ideal do usuário |
| Uso de CPU | < 70% | Margem para picos |
| Uso de memória | < 80% | Evitar OOM |
| Tendência de degradação | < 5% por release | Alerta precoce |

### 5.2 Gates por Tipo de Teste

| Teste | Gate Crítico | Gate Importante |
|:---|:---|:---|
| **Load Test** | p95 < 700ms, erro < 1% | p95 < 500ms, erro < 0,1% |
| **Stress Test** | Sistema não pode crashar (502/504) | Degradação deve ser gradual |
| **Spike Test** | Recuperação em < 60s | Recuperação em < 30s |
| **Soak Test** | Latência não pode crescer > 50% | Latência estável (±10%) |
| **Breakpoint** | Documentar throughput máximo | Knee Point > pico esperado |

---

## 6. Baseline Atual

> Preencher após a primeira execução dos testes.

| Métrica | Valor Atual | Data da Medição |
|:---|:---|:---|
| Latência p50 | _pendente_ | |
| Latência p95 | _pendente_ | |
| Latência p99 | _pendente_ | |
| Taxa de erro | _pendente_ | |
| Throughput máximo | _pendente_ | |
| Knee Point | _pendente_ | |
| Breakpoint | _pendente_ | |

---

## 7. Cronograma de Execução

| Frequência | Testes | Ambiente | Ação em caso de falha |
|:---|:---|:---|:---|
| **Todo PR** | Load Test (quick) | CI (GitHub Actions) | Bloqueia merge |
| **Semanal** | Stress + Spike | Staging | Alerta no Slack, investiga em até 24h |
| **Quinzenal** | Soak Test (4h) | Staging | Alerta, investiga em até 48h |
| **Mensal** | Breakpoint | Staging | Atualiza capacity planning |
| **Pré-release** | Suite completa | Staging | Bloqueia release se gate crítico falhar |

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|:---|:---|:---|:---|
| Ambiente de teste diferente de prod | Alta | Alto | Documentar diferenças, aplicar fator de correção |
| Dados de teste não realistas | Média | Alto | Usar dump anonimizado de produção |
| Falsos positivos nos gates | Média | Médio | Revisar gates trimestralmente, ajustar baselines |
| Testes flaky (intermitentes) | Média | Alto | Adicionar retries, investigar causa raiz |
| Time ignora falhas de performance | Alta | Crítico | Gates bloqueiam deploy automaticamente |

---

## 9. Responsabilidades

| Papel | Responsabilidade |
|:---|:---|
| **Tech Lead** | Aprovar o plano, definir SLAs com negócio |
| **DevOps / SRE** | Manter ambiente de teste, configurar CI/CD |
| **Desenvolvedores** | Escrever e manter scripts de teste, corrigir regressões |
| **QA** | Validar resultados, atualizar baselines |
| **Product Owner** | Definir requisitos de negócio (volumes, SLAs) |

---

## 10. Aprovações

| Nome | Papel | Data | Assinatura |
|:---|:---|:---|:---|
| | Tech Lead | | |
| | DevOps/SRE | | |
| | Product Owner | | |

---

> 📌 **Este é um documento vivo.** Deve ser revisado e atualizado a cada
> trimestre ou quando houver mudanças significativas na arquitetura ou
> nos requisitos de negócio.
# 🧪 Mini Projeto: Testes Não Funcionais com k6

Projeto didático para estudo de **testes não funcionais** utilizando a ferramenta
[k6](https://k6.io/) da Grafana Labs.

## 🎯 Objetivo

Demonstrar, na prática, os principais tipos de testes não funcionais aplicados a
uma API REST, abordando conceitos, métricas e interpretações de resultados.

## 📚 O que são Testes Não Funcionais?

Enquanto os **testes funcionais** verificam *o que* o sistema faz (regras de
negócio, fluxos, comportamentos), os **testes não funcionais** verificam *como*
o sistema se comporta sob determinadas condições. Eles avaliam atributos de
qualidade como:

- **Performance** (tempo de resposta)
- **Escalabilidade** (capacidade de crescer)
- **Estabilidade** (resistência ao longo do tempo)
- **Confiabilidade** (consistência dos resultados)
- **Resiliência** (capacidade de recuperação sob carga extrema)

### 🧭 Tipos de Testes de Performance (subconjunto dos não funcionais)

| Tipo           | O que avalia?                                                                 | Duração típica    |
|----------------|-------------------------------------------------------------------------------|-------------------|
| **Load**       | Comportamento sob carga esperada (normal)                                     | 5–15 min          |
| **Stress**     | Comportamento além do limite, até o sistema falhar                            | 10–30 min         |
| **Spike**      | Reação a picos súbitos e extremos de carga                                    | 5–15 min          |
| **Soak**       | Estabilidade sob carga moderada por longo período (vazamentos, degradação)    | 1h–24h            |
| **Breakpoint** | Descobre o ponto máximo de ruptura do sistema                                 | Variável          |

## 🛠️ Stack

- **k6** — ferramenta de load testing em Go + JavaScript
- **JavaScript (ES6)** — linguagem dos scripts de teste
- **Thresholds** — definição de SLAs/SLOs
- **Scenarios** — modelagem de padrões de carga

## 📂 Estrutura do Projeto

```
k6-non-functional-tests/
├── README.md
├── config/
│   └── thresholds.js
├── scenarios/
│   └── common-scenarios.js
├── tests/
│   ├── 01-load-test.js
│   ├── 02-stress-test.js
│   ├── 03-spike-test.js
│   ├── 04-soak-test.js
│   └── 05-breakpoint-test.js
└── scripts/
    └── run-all.sh
```

## ▶️ Como executar

```bash
# Executar um teste específico
k6 run tests/01-load-test.js

# Executar todos os testes
bash scripts/run-all.sh
```

## 📊 Métricas-chave observadas

- `http_req_duration` — tempo total da requisição
- `http_req_failed` — taxa de falhas
- `vus` — usuários virtuais ativos
- `iterations` — iterações executadas
- `data_received` / `data_sent` — tráfego de rede

---

> 📖 Cada arquivo de teste contém a explicação teórica do tipo de teste
> correspondente. Consulte os comentários no topo de cada script.
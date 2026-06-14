import { supabase } from './config.js';

let rawOrcamentos = [];
let rawItens = [];
let chartInstances = {};

export async function initMetricas() {
    const inputInicio = document.getElementById('metricas-data-inicio');
    const inputFim = document.getElementById('metricas-data-fim');

    // Define datas iniciais padrão no filtro (últimos 30 dias de margem inicial)
    const dtFim = new Date();
    const dtInicio = new Date();
    dtInicio.setDate(dtInicio.getDate() - 30);

    if (inputInicio && inputFim) {
        inputInicio.value = dtInicio.toISOString().split('T')[0];
        inputFim.value = dtFim.toISOString().split('T')[0];

        // Ouvintes para atualizar os gráficos em tempo real ao mudar o filtro de data
        inputInicio.addEventListener('change', processarDashboard);
        inputFim.addEventListener('change', processarDashboard);
    }

    await carregarDadosDoBanco();
}

async function carregarDadosDoBanco() {
    try {
        // 1. Busca as tabelas de forma independente e paralela para evitar problemas de cache de chaves relacionais
        const [resOrcamentos, resClientes, resItens, resProdutos] = await Promise.all([
            supabase.from('orcamento').select('*'),
            supabase.from('cliente').select('clienteid, nome_cliente'),
            supabase.from('item_orcamento').select('*'),
            supabase.from('produto').select('produtoid, ds_produto')
        ]);

        if (resOrcamentos.error) throw new Error(`Erro em 'orcamento': ${resOrcamentos.error.message}`);
        if (resClientes.error) throw new Error(`Erro em 'cliente': ${resClientes.error.message}`);
        if (resItens.error) throw new Error(`Erro em 'item_orcamento': ${resItens.error.message}`);
        if (resProdutos.error) throw new Error(`Erro em 'produto': ${resProdutos.error.message}`);

        // 2. Cria mapas de busca rápida indexados pelo ID
        const mapClientes = new Map((resClientes.data || []).map(c => [c.clienteid, c]));
        const mapProdutos = new Map((resProdutos.data || []).map(p => [p.produtoid, p]));

        // 3. Monta os objetos injetando as dependências de forma segura
        rawOrcamentos = (resOrcamentos.data || []).map(o => ({
            ...o,
            cliente: mapClientes.get(o.clienteid) || { nome_cliente: `Cliente #${o.clienteid}` }
        }));

        rawItens = (resItens.data || []).map(i => ({
            ...i,
            produto: mapProdutos.get(i.produtoid) || { ds_produto: 'Produto Indefinido' }
        }));

        // Ajusta o calendário baseado no histórico real encontrado
        ajustarFiltroDataInicial();
        processarDashboard();

    } catch (error) {
        console.error("Falha na carga do dashboard:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Sincronização',
            text: error.message,
            confirmButtonColor: '#10b981'
        });
    }
}

// Auxiliar Inteligente para converter strings de data sem quebrar com valores NULL ou fuso horário
function converterStringParaData(dataStr, fimDoDia = false) {
    if (!dataStr) return null;
    
    // Remove frações de tempo caso venha um timestamp completo (ex: "2026-05-10T14:20:00")
    const apenasData = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr;
    const partes = apenasData.split('-');
    
    if (partes.length !== 3) {
        const d = new Date(dataStr);
        return isNaN(d.getTime()) ? null : d;
    }

    const ano = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1; // Meses no JS começam em 0
    const dia = parseInt(partes[2], 10);

    const dataResultado = new Date(ano, mes, dia);
    if (fimDoDia) {
        dataResultado.setHours(23, 59, 59, 999);
    } else {
        dataResultado.setHours(0, 0, 0, 0);
    }
    
    return isNaN(dataResultado.getTime()) ? null : dataResultado;
}

function ajustarFiltroDataInicial() {
    if (rawOrcamentos.length === 0) return;
    
    // Extrai e valida as datas de criação descartando registros corrompidos ou nulos
    const timestampsValidos = rawOrcamentos
        .map(o => converterStringParaData(o.dt_orcamento))
        .filter(d => d !== null)
        .map(d => d.getTime());

    if (timestampsValidos.length === 0) return;

    // Descobre com segurança matemática qual o carimbo de data mais antigo
    const menorTimestamp = Math.min(...timestampsValidos);
    const dataMaisAntiga = new Date(menorTimestamp);
    
    const inputInicio = document.getElementById('metricas-data-inicio');
    if (inputInicio) {
        inputInicio.value = dataMaisAntiga.toISOString().split('T')[0];
    }
}

function processarDashboard() {
    const inputInicioVal = document.getElementById('metricas-data-inicio').value;
    const inputFimVal = document.getElementById('metricas-data-fim').value;

    const dataInicio = converterStringParaData(inputInicioVal) || new Date(0);
    const dataFim = converterStringParaData(inputFimVal, true) || new Date();
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Filtra orçamentos pertencentes ao intervalo selecionado
    const orcamentosFiltrados = rawOrcamentos.filter(o => {
        const dataCriacao = converterStringParaData(o.dt_orcamento);
        if (!dataCriacao) return false;
        return dataCriacao >= dataInicio && dataCriacao <= dataFim;
    });

    const idsFiltrados = orcamentosFiltrados.map(o => o.orcamentoid);
    const itensFiltrados = rawItens.filter(i => idsFiltrados.includes(i.orcamentoid));

    const validos = [];
    const expirados = [];

    orcamentosFiltrados.forEach(o => {
        const dataValidade = converterStringParaData(o.dt_validade_orcamento, true);
        const valor = parseFloat(o.vl_total_orcamento || 0);

        // Se não houver data de validade estipulada, assume-se expirado preventivamente
        if (!dataValidade || dataValidade < hoje) {
            expirados.push(valor);
        } else {
            validos.push(valor);
        }
    });

    // Atualiza os Cards com os valores monetários processados
    renderizarCardMetricas(validos, 'total-validos', 'calc-media-val', 'calc-min-val', 'calc-max-val');
    renderizarCardMetricas(expirados, 'total-expirados', 'calc-media-exp', 'calc-min-exp', 'calc-max-exp');

    // Reconstrói as instâncias visuais do Chart.js
    construirGraficoEvolucao(orcamentosFiltrados, hoje);
    construirGraficoProdutos(itensFiltrados);
    construirGraficoClientes(orcamentosFiltrados);
}

function renderizarCardMetricas(valores, idQtd, idMedia, idMin, idMax) {
    document.getElementById(idQtd).innerText = valores.length;
    
    if (valores.length === 0) {
        document.getElementById(idMedia).innerText = "R$ 0,00";
        document.getElementById(idMin).innerText = "R$ 0,00";
        document.getElementById(idMax).innerText = "R$ 0,00";
        return;
    }

    const soma = valores.reduce((acc, v) => acc + v, 0);
    const media = soma / valores.length;
    const min = Math.min(...valores);
    const max = Math.max(...valores);

    const formatar = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    document.getElementById(idMedia).innerText = formatar(media);
    document.getElementById(idMin).innerText = formatar(min);
    document.getElementById(idMax).innerText = formatar(max);
}

function construirGraficoEvolucao(orcamentos, hoje) {
    const agrupado = {};

    orcamentos.forEach(o => {
        const dataCriacao = converterStringParaData(o.dt_orcamento);
        if (!dataCriacao) return;

        const dataFormatada = dataCriacao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!agrupado[dataFormatada]) agrupado[dataFormatada] = { v: 0, e: 0 };
        
        const dataValidade = converterStringParaData(o.dt_validade_orcamento, true);

        if (!dataValidade || dataValidade < hoje) agrupado[dataFormatada].e++;
        else agrupado[dataFormatada].v++;
    });

    const labels = Object.keys(agrupado).sort((a, b) => {
        const [diaA, mesA] = a.split('/').map(Number);
        const [diaB, mesB] = b.split('/').map(Number);
        return mesA === mesB ? diaA - diaB : mesA - mesB;
    });
    
    const dadosValidos = labels.map(l => agrupado[l].v);
    const dadosExpirados = labels.map(l => agrupado[l].e);

    atualizarChart('chart-evolucao', 'line', labels, [
        { label: 'Válidos', data: dadosValidos, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.2 },
        { label: 'Expirados', data: dadosExpirados, borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.2 }
    ]);
}

function construirGraficoProdutos(itens) {
    const contagem = {};
    itens.forEach(i => {
        const nomeProd = i.produto?.ds_produto || 'Produto Indefinido';
        contagem[nomeProd] = (contagem[nomeProd] || 0) + parseInt(i.quantidade || 1);
    });

    const ordenados = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const labels = ordenados.map(o => o[0]);
    const dados = ordenados.map(o => o[1]);

    atualizarChart('chart-produtos', 'bar', labels, [{
        label: 'Unidades Solicitadas', data: dados, backgroundColor: ['#3b82f6', '#60a5fa', '#93c5fd']
    }]);
}

function construirGraficoClientes(orcamentos) {
    const metricasClientes = {};

    orcamentos.forEach(o => {
        const nomeCliente = o.cliente?.nome_cliente || `Cliente #${o.clienteid}`;
        if (!metricasClientes[nomeCliente]) {
            metricasClientes[nomeCliente] = { qtd: 0, somaValores: 0 };
        }
        metricasClientes[nomeCliente].qtd++;
        metricasClientes[nomeCliente].somaValores += parseFloat(o.vl_total_orcamento || 0);
    });

    const listaClientes = Object.entries(metricasClientes).map(([nome, dados]) => ({
        nome,
        qtd: dados.qtd,
        media: dados.somaValores / dados.qtd
    }));

    const topQtd = [...listaClientes].sort((a, b) => b.qtd - a.qtd).slice(0, 3);
    const topValor = [...listaClientes].sort((a, b) => b.media - a.media).slice(0, 3);

    atualizarChart('chart-clientes-qtd', 'bar', topQtd.map(c => c.nome), [{
        label: 'Qtd. de Orçamentos', data: topQtd.map(c => c.qtd), backgroundColor: ['#10b981', '#34d399', '#6ee7b7']
    }], false);

    atualizarChart('chart-clientes-valor', 'bar', topValor.map(c => c.nome), [{
        label: 'Ticket Médio (R$)', data: topValor.map(c => c.media), backgroundColor: ['#f59e0b', '#fbbf24', '#fcd34d']
    }], true);
}

function atualizarChart(canvasId, tipo, labels, datasets, formatarMoeda = false) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) return;

    const ctx = canvasElement.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
        type: tipo,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (formatarMoeda && context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            } else {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (formatarMoeda) {
                                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
                            }
                            return value;
                        }
                    }
                }
            }
        }
    });
}
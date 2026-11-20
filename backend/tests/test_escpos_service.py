"""Cupom ESC/POS: nenhuma linha passa da largura do papel (58mm/80mm), o total
de cada item aparece inteiro e nomes longos quebram de linha em vez de cortar."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.services import escpos_service as es
from app.services.escpos_service import DadosRecibo, ItemRecibo, gerar_recibo

COMANDOS = [
    es.INIT, es.ALIGN_LEFT, es.ALIGN_CENTER, es.ALIGN_RIGHT, es.BOLD_ON, es.BOLD_OFF,
    es.FONT_NORMAL, es.FONT_DOUBLE_H, es.FONT_DOUBLE, es.UNDERLINE_ON,
    es.UNDERLINE_OFF, es.CUT_FULL, es.CUT_PARTIAL,
]


def _texto(buf: bytes) -> list[str]:
    """Remove os comandos ESC/POS e devolve as linhas impressas."""
    for cmd in COMANDOS:
        buf = buf.replace(cmd, b"")
    return buf.decode("cp850").split("\n")


def _dados(itens: list[ItemRecibo]) -> DadosRecibo:
    total = sum((i.total_item for i in itens), Decimal("0"))
    return DadosRecibo(
        numero_venda=1, uuid_venda="00000000-0000-0000-0000-000000000000",
        operador="Maria", caixa_nome="Caixa 1", itens=itens,
        subtotal=total, desconto=Decimal("0"), total=total,
        pagamentos=[{"forma": "dinheiro", "valor": total}], troco=Decimal("0"),
        data_hora=datetime(2026, 11, 20, 8, 30),
    )


def _item(nome="Pão Francês", qtd="2", preco="0.60", total="1.20", unidade="un"):
    return ItemRecibo(nome=nome, quantidade=Decimal(qtd), preco_unit=Decimal(preco),
                      total_item=Decimal(total), unidade=unidade)


@pytest.fixture(autouse=True)
def dados_padaria(monkeypatch):
    """Fixa cabeçalho/rodapé para o teste não depender do backend/.env local."""
    for campo, valor in {
        "padaria_nome": "Padaria Teste", "padaria_cnpj": "00.000.000/0001-00",
        "padaria_endereco": "", "padaria_cidade": "", "padaria_telefone": "",
        "padaria_mensagem_rodape": "Obrigado!",
    }.items():
        monkeypatch.setattr(es.settings, campo, valor)


@pytest.fixture(params=[(80, 42), (58, 32)], ids=["80mm", "58mm"])
def largura(request, monkeypatch):
    papel, cols = request.param
    monkeypatch.setattr(es.settings, "printer_paper_width", papel)
    return cols


def test_nenhuma_linha_passa_da_largura_do_papel(largura):
    itens = [
        _item(),
        _item(nome="Bolo de Chocolate com Cobertura de Brigadeiro Gourmet Grande"),
        _item(nome="Torta Salgada", qtd="10", preco="1000.00", total="10000.00"),
    ]
    linhas = _texto(gerar_recibo(_dados(itens)))
    longas = [linha for linha in linhas if len(linha) > largura]
    assert longas == []


def test_total_do_item_aparece_inteiro_alinhado_a_direita(largura):
    linhas = _texto(gerar_recibo(_dados([_item()])))
    assert "  2 un x R$ 0,60" in linhas[linhas.index("Pão Francês") + 1]
    linha_valores = linhas[linhas.index("Pão Francês") + 1]
    assert linha_valores.endswith("R$ 1,20")
    assert len(linha_valores) == largura


def test_nome_longo_quebra_de_linha_sem_perder_texto(largura):
    nome = "Bolo de Chocolate com Cobertura de Brigadeiro Gourmet Grande"
    texto = "\n".join(_texto(gerar_recibo(_dados([_item(nome=nome)]))))
    for palavra in nome.split():
        assert palavra in texto


def test_valor_alto_em_58mm_joga_total_para_linha_propria(monkeypatch):
    monkeypatch.setattr(es.settings, "printer_paper_width", 58)
    item = _item(nome="Torta Salgada", qtd="10", preco="1000.00", total="10000.00")
    linhas = _texto(gerar_recibo(_dados([item])))
    i = linhas.index("Torta Salgada")
    assert linhas[i + 1] == "  10 un x R$ 1.000,00"
    assert linhas[i + 2] == "R$ 10.000,00"


def test_item_por_peso_mostra_quantidade_com_tres_casas(largura):
    item = _item(nome="Cebola", qtd="0.200", preco="5.90", total="1.18", unidade="kg")
    linhas = _texto(gerar_recibo(_dados([item])))
    linha_valores = linhas[linhas.index("Cebola") + 1]
    assert linha_valores.startswith("  0,200 kg x R$ 5,90")
    assert linha_valores.endswith("R$ 1,18")
    assert len(linha_valores) == largura

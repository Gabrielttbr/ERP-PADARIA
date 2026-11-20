"""Testes do caixa: fechamento (saldo esperado, diferença, ticket médio) e
sangria/suprimento (com validação de saldo insuficiente)."""

from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.schemas.caixa import FechamentoCaixaRequest, SangriaRequest, SuprimentoRequest
from app.schemas.venda import VendaCreate, ItemVendaCreate, PagamentoCreate
from app.services.caixa_service import fechar_caixa, registrar_sangria, registrar_suprimento
from app.services.venda_service import criar_venda
from tests.factories import criar_usuario, criar_sessao, criar_produto


async def _vender(db, sessao_id, usuario_id, produto_id, quantidade, forma, valor):
    payload = VendaCreate(
        sessao_id=sessao_id,
        itens=[ItemVendaCreate(produto_id=produto_id, quantidade=Decimal(quantidade))],
        pagamentos=[PagamentoCreate(forma=forma, valor=Decimal(valor))],
    )
    return await criar_venda(payload, usuario_id, db)


async def test_fechar_caixa_sem_diferenca(db):
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="100.00")
    p = await criar_produto(db, preco_venda="10.00", estoque="100")
    await _vender(db, s.id, u.id, p.id, "5", "dinheiro", "50.00")  # total_vendas = 50

    # saldo esperado = 100 (abertura) + 50 (vendas) = 150; fechou com 150 → 0.
    resumo = await fechar_caixa(s.id, FechamentoCaixaRequest(valor_fechamento=Decimal("150.00")), u.id, db)

    assert resumo.sessao.status == "fechado"
    assert resumo.sessao.diferenca == Decimal("0.00")
    assert resumo.quantidade_vendas == 1
    assert resumo.ticket_medio == Decimal("50.00")
    assert resumo.total_dinheiro == Decimal("50.00")


async def test_fechar_caixa_com_quebra_de_caixa(db):
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="100.00")
    p = await criar_produto(db, preco_venda="10.00", estoque="100")
    await _vender(db, s.id, u.id, p.id, "5", "dinheiro", "50.00")

    # Fechou com 140, esperado 150 → faltam 10 (diferença negativa).
    resumo = await fechar_caixa(s.id, FechamentoCaixaRequest(valor_fechamento=Decimal("140.00")), u.id, db)
    assert resumo.sessao.diferenca == Decimal("-10.00")


async def test_sangria_reduz_saldo(db):
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="200.00")

    await registrar_sangria(s.id, SangriaRequest(valor=Decimal("50.00"), motivo="troco banco"), u.id, db)
    assert s.total_sangrias == Decimal("50.00")


async def test_sangria_maior_que_saldo_falha(db):
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="30.00")

    with pytest.raises(HTTPException) as exc:
        await registrar_sangria(s.id, SangriaRequest(valor=Decimal("100.00"), motivo="x"), u.id, db)
    assert exc.value.status_code == 422


async def test_suprimento_aumenta_saldo(db):
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="0.00")

    await registrar_suprimento(s.id, SuprimentoRequest(valor=Decimal("80.00"), motivo="fundo de troco"), u.id, db)
    assert s.total_suprimentos == Decimal("80.00")
    # Com suprimento no saldo, agora a sangria de 80 passa.
    await registrar_sangria(s.id, SangriaRequest(valor=Decimal("80.00"), motivo="ok"), u.id, db)
    assert s.total_sangrias == Decimal("80.00")


async def test_fechamento_dinheiro_soma_o_que_ficou_na_gaveta(db):
    # Venda de 18,00 paga com 20,00 (troco 2,00) + venda de 30,00 no PIX.
    # "Dinheiro" no fechamento tem que ser 18,00, não os 20,00 entregues.
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="100.00")
    p = await criar_produto(db, preco_venda="9.00", estoque="100")
    await _vender(db, s.id, u.id, p.id, "2", "dinheiro", "20.00")
    await _vender(db, s.id, u.id, p.id, "1", "pix", "9.00")

    resumo = await fechar_caixa(s.id, FechamentoCaixaRequest(valor_fechamento=Decimal("118.00")), u.id, db)

    assert resumo.sessao.diferenca == Decimal("0.00")  # 100 + 18 de dinheiro
    assert resumo.total_dinheiro == Decimal("18.00")
    assert resumo.total_pix == Decimal("9.00")
    # Soma das formas = total vendido na sessão.
    assert resumo.total_dinheiro + resumo.total_pix == resumo.sessao.total_vendas


async def test_esperado_na_gaveta_ignora_pix_e_cartao(db):
    # Dia D do plano de testes: abertura 100, dinheiro 18, PIX 30, débito 22,50,
    # sangria 30, suprimento 50 → gaveta = 100 + 18 − 30 + 50 = 138.
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="100.00")
    p = await criar_produto(db, preco_venda="1.50", estoque="1000")
    await _vender(db, s.id, u.id, p.id, "12", "dinheiro", "20.00")       # 18,00 (troco 2)
    await _vender(db, s.id, u.id, p.id, "20", "pix", "30.00")            # 30,00
    await _vender(db, s.id, u.id, p.id, "15", "cartao_debito", "22.50")  # 22,50
    await registrar_sangria(s.id, SangriaRequest(valor=Decimal("30.00"), motivo="banco"), u.id, db)
    await registrar_suprimento(s.id, SuprimentoRequest(valor=Decimal("50.00"), motivo="troco"), u.id, db)

    resumo = await fechar_caixa(s.id, FechamentoCaixaRequest(valor_fechamento=Decimal("138.00")), u.id, db)

    assert resumo.sessao.total_vendas == Decimal("70.50")
    assert resumo.sessao.diferenca == Decimal("0.00")


async def test_sangria_nao_pode_usar_dinheiro_de_pix(db):
    # Gaveta tem só os 10 de abertura; os 50 do PIX não estão lá.
    u = await criar_usuario(db)
    s = await criar_sessao(db, u.id, valor_abertura="10.00")
    p = await criar_produto(db, preco_venda="10.00", estoque="100")
    await _vender(db, s.id, u.id, p.id, "5", "pix", "50.00")

    with pytest.raises(HTTPException) as exc:
        await registrar_sangria(s.id, SangriaRequest(valor=Decimal("40.00"), motivo="x"), u.id, db)
    assert exc.value.status_code == 422

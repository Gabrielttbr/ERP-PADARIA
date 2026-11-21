"""Produto Diverso (999): toda instalação precisa dele, com qualquer id."""
from datetime import datetime

from sqlalchemy import func, select

from app.models.produto import Categoria, Produto
from app.services.produto_diverso import garantir_produto_diverso


async def test_cria_diverso_e_categoria_em_banco_vazio(db):
    diverso, criado = await garantir_produto_diverso(db)
    assert criado
    assert diverso.codigo_barras == "999" and diverso.ativo
    cat = await db.get(Categoria, diverso.categoria_id)
    assert cat.nome == "Outros"


async def test_idempotente(db):
    primeiro, _ = await garantir_produto_diverso(db)
    segundo, criado = await garantir_produto_diverso(db)
    assert not criado and segundo.id == primeiro.id
    total = (await db.execute(select(func.count()).select_from(Produto))).scalar_one()
    assert total == 1


async def test_reativa_diverso_desativado(db):
    diverso, _ = await garantir_produto_diverso(db)
    diverso.ativo = False
    diverso.deleted_at = datetime.utcnow()  # exclusão lógica, como no DELETE /produtos
    await db.flush()
    diverso, alterado = await garantir_produto_diverso(db)
    assert alterado and diverso.ativo and diverso.deleted_at is None

"""Produto Diverso (código 999): item avulso de preço livre vendido no PDV.

É um produto "do sistema": toda instalação precisa dele para o PDV vender
itens não cadastrados. `garantir_produto_diverso` é idempotente e roda no
`init_db.py` e na inicialização do backend, então o banco do cliente sempre
nasce (e continua) com o Diverso cadastrado e ativo.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.produto import Categoria, Produto

CODIGO_DIVERSO = "999"


async def garantir_produto_diverso(db: AsyncSession) -> tuple[Produto, bool]:
    """Cria o Diverso se não existir (ou reativa, se foi desativado).

    Retorna (produto, alterado). Não faz commit: quem chama decide.
    """
    now = datetime.utcnow()
    diverso = (await db.execute(
        select(Produto).where(Produto.codigo_barras == CODIGO_DIVERSO)
    )).scalar_one_or_none()

    if diverso:
        if diverso.ativo:
            return diverso, False
        diverso.ativo = True
        diverso.updated_at = now
        return diverso, True

    cat_outros = (await db.execute(
        select(Categoria).where(Categoria.nome == "Outros")
    )).scalars().first()
    if not cat_outros:
        cat_outros = Categoria(nome="Outros", descricao="Demais produtos",
                               ativo=True, created_at=now, updated_at=now)
        db.add(cat_outros)
        await db.flush()

    diverso = Produto(
        codigo_barras=CODIGO_DIVERSO, sku=None, nome="DIVERSO",
        categoria_id=cat_outros.id, fornecedor_id=None,
        unidade_medida="un",
        preco_custo=Decimal("0.00"),
        preco_venda=Decimal("0.00"),
        estoque_atual=Decimal("999999.000"),
        estoque_minimo=Decimal("0.000"),
        ativo=True, created_at=now, updated_at=now,
    )
    db.add(diverso)
    await db.flush()
    return diverso, True

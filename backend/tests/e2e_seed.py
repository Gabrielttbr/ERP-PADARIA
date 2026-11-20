"""
Seed determinístico para os testes E2E (Playwright).

Uso (a partir de backend/, com o MESMO DATABASE_URL_OVERRIDE do backend em teste):
    python -m tests.e2e_seed base    # massa de dados da seção 0 do cenarios_testes.md
    python -m tests.e2e_seed dia-d   # base + roteiro do dia D (V1–V4, sangria, suprimento)
    python -m tests.e2e_seed noite   # base + venda de R$ 10,00 ontem às 22:30

Apaga todas as linhas e recria tudo, então cada spec começa de um estado conhecido.
As vendas do dia D passam pelos services reais (mesmas regras do PDV).
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

if not os.environ.get("DATABASE_URL_OVERRIDE"):
    sys.exit("Defina DATABASE_URL_OVERRIDE (ex.: sqlite+aiosqlite:///./e2e_padaria.db) — "
             "este script APAGA todos os dados do banco.")

from sqlalchemy import delete  # noqa: E402

from app.database import AsyncSessionLocal, Base, engine  # noqa: E402
import app.models  # noqa: E402,F401  — registra todos os models
from app.models.caixa import Caixa  # noqa: E402
from app.models.produto import Categoria, Produto  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
from app.schemas.caixa import AberturaCaixaRequest, SangriaRequest, SuprimentoRequest  # noqa: E402
from app.schemas.venda import ItemVendaCreate, PagamentoCreate, VendaCreate  # noqa: E402
from app.services import caixa_service, venda_service  # noqa: E402
from app.utils.security import hash_password  # noqa: E402
from app.utils.tempo import hoje_local  # noqa: E402

SENHA = "Admin@1234"
D = Decimal


async def _limpar(db) -> None:
    for tabela in reversed(Base.metadata.sorted_tables):
        await db.execute(delete(tabela))


async def _base(db) -> dict:
    await _limpar(db)

    admin = Usuario(uuid=str(uuid.uuid4()), nome="Administrador", email="admin@padaria.com",
                    senha_hash=hash_password(SENHA), perfil="admin", ativo=True)
    operador = Usuario(uuid=str(uuid.uuid4()), nome="Operador Caixa", email="caixa@padaria.com",
                       senha_hash=hash_password(SENHA), perfil="caixa", ativo=True)
    db.add_all([admin, operador])

    cats = {nome: Categoria(nome=nome, ativo=True) for nome in ("Pães", "Lanchonete", "Frios", "Outros")}
    db.add_all(cats.values())
    db.add_all([Caixa(nome="Caixa 01", ativo=True), Caixa(nome="Caixa 02", ativo=True)])
    await db.flush()

    def produto(nome, cat, un, custo, venda, estoque, codigo):
        return Produto(nome=nome, categoria_id=cats[cat].id, unidade_medida=un,
                       preco_custo=D(custo), preco_venda=D(venda), estoque_atual=D(estoque),
                       codigo_barras=codigo, ativo=True)

    prods = {
        "pao": produto("Pão Francês", "Pães", "kg", "6.00", "16.00", "20", "1001"),
        "cafe": produto("Café Expresso", "Lanchonete", "un", "1.50", "5.00", "100", "1002"),
        "bolo": produto("Fatia de Bolo", "Lanchonete", "un", "3.00", "8.00", "30", "1003"),
        "mussarela": produto("Mussarela", "Frios", "kg", "32.00", "50.00", "10", "1004"),
        "diverso": produto("Diverso", "Outros", "un", "0.00", "0.00", "0", "999"),
    }
    # O PDV envia o Diverso com produto_id 17 fixo no código (PDVPage.tsx) — ver P10.
    prods["diverso"].id = 17
    db.add_all(prods.values())
    await db.flush()
    return {"admin": admin, "prods": prods}


def _venda(sessao_id, itens, pagamentos, **kw) -> VendaCreate:
    return VendaCreate(
        sessao_id=sessao_id,
        itens=[ItemVendaCreate(produto_id=p.id, quantidade=D(q)) for p, q in itens],
        pagamentos=[PagamentoCreate(forma=f, valor=D(v), nsu=nsu) for f, v, nsu in pagamentos],
        **kw,
    )


async def _abrir_caixa(db, admin, valor="100.00"):
    caixa = (await db.execute(Caixa.__table__.select().where(Caixa.nome == "Caixa 01"))).first()
    return await caixa_service.abrir_caixa(
        AberturaCaixaRequest(caixa_id=caixa.id, valor_abertura=D(valor)), admin.id, db
    )


async def _dia_d(db) -> None:
    ctx = await _base(db)
    admin, p = ctx["admin"], ctx["prods"]
    s = await _abrir_caixa(db, admin)

    # V1: 0,500 kg Pão + 2 Café = 18,00 — dinheiro 20,00 (troco 2,00)
    await venda_service.criar_venda(_venda(s.id, [(p["pao"], "0.500"), (p["cafe"], "2")],
                                           [("dinheiro", "20.00", None)]), admin.id, db)
    # V2: 3 Bolo + 0,250 kg Mussarela = 36,50 − 6,50 = 30,00 — PIX
    await venda_service.criar_venda(_venda(s.id, [(p["bolo"], "3"), (p["mussarela"], "0.250")],
                                           [("pix", "30.00", None)], desconto_valor=D("6.50")), admin.id, db)
    # V3: 1,250 kg Pão + 1 Café = 25,00 − 10% = 22,50 — débito na maquineta 1
    await venda_service.criar_venda(_venda(s.id, [(p["pao"], "1.250"), (p["cafe"], "1")],
                                           [("cartao_debito", "22.50", "1")], desconto_pct=D("10")), admin.id, db)
    # V4: 4 Café = 20,00 — cancelada
    v4 = await venda_service.criar_venda(_venda(s.id, [(p["cafe"], "4")],
                                                [("dinheiro", "20.00", None)]), admin.id, db)
    await venda_service.cancelar_venda(v4.id, "cliente desistiu", admin.id, db)

    await caixa_service.registrar_sangria(s.id, SangriaRequest(valor=D("30.00"), motivo="depósito"), admin.id, db)
    await caixa_service.registrar_suprimento(s.id, SuprimentoRequest(valor=D("50.00"), motivo="troco"), admin.id, db)


async def _noite(db) -> None:
    ctx = await _base(db)
    admin, p = ctx["admin"], ctx["prods"]
    s = await _abrir_caixa(db, admin)
    venda = await venda_service.criar_venda(_venda(s.id, [(p["cafe"], "2")], [("dinheiro", "10.00", None)]),
                                            admin.id, db)
    ontem = hoje_local() - timedelta(days=1)
    venda.created_at = datetime.combine(ontem, datetime.min.time()).replace(hour=22, minute=30)


PERFIS = {"base": _base, "dia-d": _dia_d, "noite": _noite}


async def main(perfil: str) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await PERFIS[perfil](db)
        await db.commit()
    await engine.dispose()
    print(f"seed e2e '{perfil}' OK")


if __name__ == "__main__":
    perfil = sys.argv[1] if len(sys.argv) > 1 else "base"
    if perfil not in PERFIS:
        sys.exit(f"Perfil inválido: {perfil}. Use: {', '.join(PERFIS)}")
    asyncio.run(main(perfil))

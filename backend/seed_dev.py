"""
Script de seed para desenvolvimento (SQLite).
Cria as tabelas e popula com dados iniciais.
Execute: python seed_dev.py
"""
import asyncio
import uuid
from datetime import datetime
from decimal import Decimal

from app.database import engine, Base, AsyncSessionLocal
from app.models import *  # noqa: F401,F403,F405 — carrega metadados de todos os modelos
from app.models.usuario import Usuario  # noqa: F811
from app.models.produto import Produto, Categoria, Fornecedor  # noqa: F811
from app.models.caixa import Caixa  # noqa: F811
from app.utils.security import hash_password


async def criar_tabelas():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("OK Tabelas criadas")


async def seed():
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()

        # Categorias
        cats = [
            Categoria(nome="Mercearia",  descricao="Alimentos e itens secos",  ativo=True, created_at=now, updated_at=now),
            Categoria(nome="Hortifruti", descricao="Frutas, verduras e legumes",ativo=True, created_at=now, updated_at=now),
            Categoria(nome="Limpeza",    descricao="Produtos de limpeza",       ativo=True, created_at=now, updated_at=now),
            Categoria(nome="Bebidas",    descricao="Bebidas frias e quentes",   ativo=True, created_at=now, updated_at=now),
            Categoria(nome="Higiene",    descricao="Higiene e cuidados pessoais",ativo=True, created_at=now, updated_at=now),
            Categoria(nome="Frios",      descricao="Frios e laticínios",        ativo=True, created_at=now, updated_at=now),
            Categoria(nome="Outros",     descricao="Demais produtos",           ativo=True, created_at=now, updated_at=now),
        ]
        for c in cats:
            db.add(c)
        await db.flush()
        print(f"OK {len(cats)} categorias criadas")

        # Fornecedores
        forns = [
            Fornecedor(razao_social="Distribuidora Alimentos & Cia", cnpj="12.345.678/0001-90",
                       telefone="(11) 99999-1111", ativo=True, created_at=now, updated_at=now),
            Fornecedor(razao_social="Bebidas Norte Sul Ltda", cnpj="98.765.432/0001-10",
                       ativo=True, created_at=now, updated_at=now),
            Fornecedor(razao_social="Laticínios do Vale", cnpj="11.222.333/0001-44",
                       ativo=True, created_at=now, updated_at=now),
        ]
        for f in forns:
            db.add(f)
        await db.flush()

        # Usuários
        usuarios_data = [
            ("Administrador", "admin@gironegocios.com",  "admin"),
            ("Operador Caixa","caixa@gironegocios.com",  "caixa"),
            ("Estoquista",    "estoque@gironegocios.com","estoquista"),
        ]
        for nome, email, perfil in usuarios_data:
            db.add(Usuario(
                uuid=str(uuid.uuid4()), nome=nome, email=email,
                senha_hash=hash_password("Admin@1234"),
                perfil=perfil, ativo=True, created_at=now, updated_at=now,
            ))
        await db.flush()
        print("OK 3 usuários criados (senha: Admin@1234)")

        # Caixas
        db.add(Caixa(nome="Caixa 01", descricao="Caixa principal", ativo=True, created_at=now, updated_at=now))
        db.add(Caixa(nome="Caixa 02", descricao="Caixa secundário", ativo=True, created_at=now, updated_at=now))
        await db.flush()

        # Produtos
        produtos_data = [
            ("7891000315507","ARROZ-5KG",    "Arroz Tipo 1 5kg",            1, 1, "un", 18.00, 27.90,  40, 10),
            ("7891000315514","FEIJAO-1KG",   "Feijão Carioca 1kg",          1, 1, "un",  5.50,  8.99,  50, 10),
            ("7891000315521","CAFE-500G",    "Café Torrado 500g",           1, 1, "un", 12.00, 19.90,  25,  5),
            ("7891000315528","BANANA",       "Banana Prata",                2, None,"kg",3.00,  6.99,  20,  5),
            ("7891000315535","TOMATE",       "Tomate",                      2, None,"kg",4.00,  8.49,  15,  5),
            ("7891000315542","DETERGENTE",   "Detergente 500ml",            3, 1, "un",  1.50,  2.99,  60, 12),
            ("7891000315549","SABAO-PO",     "Sabão em Pó 1kg",             3, 1, "un",  8.00, 13.90,  20,  5),
            ("7891000315556","AGUA-500",     "Água Mineral 500ml",          4, 2, "un",  0.80,  2.50,  48, 12),
            ("7891000315563","REFRIGERANTE", "Refrigerante Lata 350ml",     4, 2, "un",  2.50,  5.00,  24,  6),
            ("7891000315570","SUCO-1L",      "Suco de Laranja 1L",          4, 2, "un",  4.50,  8.90,  12,  4),
            ("7891000315577","SABONETE",     "Sabonete 90g",                5, 1, "un",  1.20,  2.79,  30,  6),
            ("7891000315584","CREME-DENTAL", "Creme Dental 90g",            5, 1, "un",  2.80,  5.49,   2,  5),  # estoque baixo para demo
            ("7891000315591","QUEIJO-MUS",   "Queijo Mussarela",            6, 3, "kg", 32.00, 49.90,   8,  2),
            ("7891000315598","MANTEIGA",     "Manteiga com Sal 200g",       6, 3, "un",  5.00,  9.90,  15,  5),
        ]
        for row in produtos_data:
            barcode, sku, nome, cat_id, forn_id, unidade, custo, venda, estoque, minimo = row
            db.add(Produto(
                codigo_barras=barcode, sku=sku, nome=nome,
                categoria_id=cat_id, fornecedor_id=forn_id,
                unidade_medida=unidade,
                preco_custo=Decimal(str(custo)),
                preco_venda=Decimal(str(venda)),
                estoque_atual=Decimal(str(estoque)),
                estoque_minimo=Decimal(str(minimo)),
                ativo=True, created_at=now, updated_at=now,
            ))
        print(f"OK {len(produtos_data)} produtos criados")

        # Produto Diverso (código 999) para itens não cadastrados
        db.add(Produto(
            codigo_barras="999", sku=None, nome="DIVERSO",
            categoria_id=7, fornecedor_id=None,
            unidade_medida="un",
            preco_custo=Decimal("0.00"),
            preco_venda=Decimal("0.00"),
            estoque_atual=Decimal("999999.000"),
            estoque_minimo=Decimal("0.000"),
            ativo=True, created_at=now, updated_at=now,
        ))
        print("OK produto DIVERSO (999) criado")

        await db.commit()
        print("\nDONE Seed concluído! Acesse http://localhost:8000/api/docs")
        print("   Login: admin@gironegocios.com / Admin@1234")


async def main():
    await criar_tabelas()
    await seed()


if __name__ == "__main__":
    asyncio.run(main())

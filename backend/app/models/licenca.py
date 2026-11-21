from datetime import datetime

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.tempo import agora


class Licenca(Base):
    """Chave de acesso desta instalação — tabela singleton (sempre id=1).

    `ultimo_visto` guarda o maior horário já visto pelo sistema: se o relógio
    do computador for atrasado para "esticar" a chave, o sistema continua
    contando a partir dele (ver services/licenca_service.py).
    """

    __tablename__ = "licenca"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chave: Mapped[str | None] = mapped_column(Text, nullable=True)
    instalada_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=agora)
    ativada_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ultimo_visto: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=agora)

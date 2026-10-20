"""Alembic revision."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "replace_with_revision_id"
down_revision: Union[str, Sequence[str], None] = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass

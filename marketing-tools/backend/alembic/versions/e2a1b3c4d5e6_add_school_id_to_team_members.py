"""add school_id column to team_members

Revision ID: e2a1b3c4d5e6
Revises: def066c327c9
Create Date: 2026-07-03 01:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2a1b3c4d5e6'
down_revision: Union[str, None] = 'def066c327c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add school_id column (nullable) to team_members table
    op.add_column('team_members', sa.Column('school_id', sa.Integer(), nullable=True))
    # Note: ForeignKey to schools.id is handled at ORM level.
    # SQLite doesn't enforce FK by default, so we skip ALTER TABLE ADD CONSTRAINT.


def downgrade() -> None:
    # Remove school_id column
    op.drop_column('team_members', 'school_id')

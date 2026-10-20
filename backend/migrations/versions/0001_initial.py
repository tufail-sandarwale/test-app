from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.String(36), primary_key=True), sa.Column("email", sa.String(254), nullable=False), sa.Column("password_hash", sa.String(255), nullable=False))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    for table in ("locations", "routes"):
        op.create_table(table,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(f"ix_{table}_owner_id", table, ["owner_id"])


def downgrade():
    op.drop_table("routes")
    op.drop_table("locations")
    op.drop_table("users")
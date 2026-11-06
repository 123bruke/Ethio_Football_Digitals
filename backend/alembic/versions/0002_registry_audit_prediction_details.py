"""Add model registry, audit events and prediction details.

Revision ID: 0002_registry_audit
Revises: 0001_initial
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_registry_audit"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "details" not in [c["name"] for c in inspector.get_columns("predictions")]:
        op.add_column("predictions", sa.Column("details", sa.JSON(), nullable=True))
    tables = inspector.get_table_names()
    if "model_versions" not in tables:
        op.create_table(
            "model_versions",
            sa.Column("id", sa.String(36), primary_key=True), sa.Column("version", sa.String(80), nullable=False, unique=True),
            sa.Column("task", sa.String(40), nullable=False), sa.Column("stage", sa.String(24), nullable=False),
            sa.Column("feature_set_version", sa.String(40), nullable=False), sa.Column("features", sa.JSON(), nullable=False),
            sa.Column("artifact_path", sa.String(500), nullable=False), sa.Column("artifact_sha256", sa.String(64), nullable=False),
            sa.Column("metrics", sa.JSON(), nullable=False), sa.Column("model_card", sa.JSON(), nullable=False),
            sa.Column("created_by", sa.String(36), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("production_since", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_model_versions_stage", "model_versions", ["stage"])
    if "audit_events" not in tables:
        op.create_table(
            "audit_events",
            sa.Column("id", sa.String(36), primary_key=True), sa.Column("actor_id", sa.String(36), nullable=False),
            sa.Column("action", sa.String(60), nullable=False), sa.Column("target", sa.String(120), nullable=False),
            sa.Column("details", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"])
        op.create_index("ix_audit_events_action", "audit_events", ["action"])
        op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("model_versions")
    op.drop_column("predictions", "details")

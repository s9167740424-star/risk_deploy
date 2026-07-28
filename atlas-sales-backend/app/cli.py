import click
from app.extensions import db
from app.seed import seed_demo_data
from app.content_seed import seed_content

def register_cli(app):
    @app.cli.command("init-db")
    def init_db():
        db.create_all()
        click.echo("Database tables created.")
    @app.cli.command("drop-db")
    @click.confirmation_option(prompt="Удалить все таблицы?")
    def drop_db():
        db.drop_all()
        click.echo("Database tables dropped.")
    @app.cli.command("seed-demo")
    def seed_demo():
        db.drop_all()
        db.create_all()
        seed_demo_data()
        click.echo("Demo data seeded (DB recreated).")
    @app.cli.command("seed-content")
    def seed_content_cmd():
        db.create_all()
        result = seed_content()
        click.echo(
            f"Content seeded: algorithms={result['algorithms']}, "
            f"articles={result['articles']}, documents={result['documents']}, "
            f"document_sources={result['document_sources']}, "
            f"survey_steps={result['survey_steps']}"
        )

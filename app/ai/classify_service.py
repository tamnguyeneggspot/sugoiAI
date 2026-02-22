"""AI classify service (stub). Can (re)classify article category with AI."""
from app.models import Article


def classify_article(article: Article) -> str:
    """
    Optional: classify or re-assign category using AI.
    Returns category name.
    """
    # TODO: integrate classifier model
    return article.category

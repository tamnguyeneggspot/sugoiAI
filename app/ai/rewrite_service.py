"""AI rewrite service (stub). Can use LLM to rewrite/summarize article content."""
from typing import Optional

from app.models import Article


def rewrite_article(article: Article) -> Optional[str]:
    """
    Optional: rewrite or summarize article body with AI.
    Returns rewritten text or None.
    """
    # TODO: integrate OpenAI/other LLM
    return None

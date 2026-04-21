import os


def get_secret(name: str, default=None):
    """Read a secret from environment variables (populated by .env via load_dotenv)."""
    return os.getenv(name, default)

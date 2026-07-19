"""AI service configuration — loaded from environment / .env file."""

from pydantic_settings import BaseSettings


class AISettings(BaseSettings):
    """Configuration for AI model providers.

    Defaults to DeepSeek Chat V2; override via environment variables or .env.
    """

    # Primary LLM provider (DeepSeek)
    llm_api_key: str = "sk-your-deepseek-api-key"
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"  # DeepSeek V2 Chat

    # Fallback / alternative model
    llm_fast_model: str = "deepseek-chat"

    # TokST MCP memory server
    tokst_mcp_command: str = "npx"
    tokst_mcp_args: str = "-y @tokst/mcp-server"

    # System-wide settings
    max_tokens: int = 4096
    temperature: float = 0.7

    class Config:
        env_file = ".env"
        env_prefix = "AI_"


settings = AISettings()

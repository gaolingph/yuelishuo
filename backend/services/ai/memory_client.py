"""TokST MCP memory client — integrates with the TokST memory server for persistent,
cross-session memory for the AI Agent.

This allows the AI to remember user preferences, past conversations,
learning progress insights, and personalized recommendations.

Uses subprocess to call the npx @tokst/mcp-server command.
"""

import json
import subprocess
from typing import Optional


class TokSTMemory:
    """Client for TokST MCP memory server.

    Provides store, search, and recall operations for AI agent memory.
    """

    def __init__(self):
        self.command = "npx"
        self.args = ["-y", "@tokst/mcp-server"]

    def _call_tool(self, tool_name: str, arguments: dict) -> Optional[str]:
        """Call a TokST MCP tool via subprocess and return the result."""
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments,
                },
            }
            result = subprocess.run(
                [self.command, *self.args],
                input=json.dumps(payload, ensure_ascii=False),
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0 and result.stdout:
                return result.stdout.strip()
            return None
        except (subprocess.TimeoutExpired, subprocess.SubprocessError, json.JSONDecodeError):
            return None

    def store(self, content: str, memory_type: str = "fact") -> bool:
        """Store a piece of information into long-term memory.

        Args:
            content: The information to store
            memory_type: One of "fact", "decision", "preference", "task", "architecture", "note"

        Returns:
            True if storage succeeded
        """
        result = self._call_tool("store", {
            "content": content,
            "type": memory_type,
        })
        return result is not None

    def search(self, query: str, limit: int = 5) -> list[dict]:
        """Search memory for relevant information.

        Args:
            query: Search query string
            limit: Max results to return

        Returns:
            List of matching memory entries
        """
        result = self._call_tool("search", {
            "query": query,
            "limit": limit,
        })
        if result:
            try:
                data = json.loads(result)
                if isinstance(data, list):
                    return data
            except json.JSONDecodeError:
                pass
        return []

    def recall(self, key: str) -> Optional[str]:
        """Recall a specific memory by key.

        Args:
            key: The memory key to retrieve

        Returns:
            The stored content, or None if not found
        """
        result = self._call_tool("recall", {
            "key": key,
        })
        if result:
            try:
                data = json.loads(result)
                if isinstance(data, dict):
                    return data.get("content", data.get("value", str(data)))
            except json.JSONDecodeError:
                return result
        return None

    def store_user_preference(self, user_id: int, key: str, value: str) -> bool:
        """Store a user-specific preference.

        Args:
            user_id: The user's database ID
            key: Preference key
            value: Preference value

        Returns:
            True if storage succeeded
        """
        return self.store(
            content=f"user_{user_id}: {key} = {value}",
            memory_type="preference",
        )

    def recall_user_preference(self, user_id: int, key: str) -> Optional[str]:
        """Recall a user-specific preference.

        Args:
            user_id: The user's database ID
            key: Preference key

        Returns:
            The stored value, or None if not found
        """
        results = self.search(f"user_{user_id}: {key}", limit=1)
        if results:
            return str(results[0])
        return None

    def store_conversation_summary(self, user_id: int, summary: str) -> bool:
        """Store a summary of a conversation for long-term context.

        Args:
            user_id: The user's database ID
            summary: Conversation summary text

        Returns:
            True if storage succeeded
        """
        return self.store(
            content=f"conversation_summary_user_{user_id}: {summary}",
            memory_type="note",
        )

    def get_user_history(self, user_id: int, limit: int = 5) -> list[dict]:
        """Get memory history for a specific user.

        Args:
            user_id: The user's database ID
            limit: Max results

        Returns:
            List of memory entries
        """
        return self.search(f"user_{user_id}", limit=limit)


# Singleton
tokst_memory = TokSTMemory()

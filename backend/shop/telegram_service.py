"""
Telegram Bot Service for sending notifications to admins.

This service handles sending order notifications to admin Telegram chats.
"""

import logging
import os
from typing import List

import requests

logger = logging.getLogger(__name__)


class TelegramService:
    """Service for sending messages via Telegram Bot API."""

    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.admin_chat_ids = self._parse_admin_chat_ids()
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None

    def _parse_admin_chat_ids(self) -> List[str]:
        """Parse admin chat IDs from environment variable."""
        chat_ids_str = os.getenv("TELEGRAM_ADMIN_CHAT_IDS", "")
        if not chat_ids_str:
            return []
        # Support comma-separated or space-separated chat IDs
        return [cid.strip() for cid in chat_ids_str.replace(",", " ").split() if cid.strip()]

    def is_configured(self) -> bool:
        """Check if Telegram bot is properly configured."""
        return bool(self.bot_token and self.admin_chat_ids and self.api_url)

    def send_message(self, chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
        """
        Send a message to a specific Telegram chat.

        Args:
            chat_id: Telegram chat ID (can be user ID or channel username)
            text: Message text to send
            parse_mode: Parse mode for formatting (HTML or Markdown)

        Returns:
            True if message was sent successfully, False otherwise
        """
        if not self.api_url:
            logger.warning("Telegram bot token not configured. Skipping message send.")
            return False

        try:
            url = f"{self.api_url}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
            }
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"Telegram message sent successfully to chat_id: {chat_id}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send Telegram message to {chat_id}: {e}")
            return False

    def send_order_notification(self, order) -> bool:
        """
        Send order notification to all admin chat IDs.

        Args:
            order: Order instance with user and items

        Returns:
            True if at least one message was sent successfully
        """
        if not self.is_configured():
            logger.warning(
                "Telegram bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_IDS."
            )
            return False

        # Build notification message
        customer = order.user
        customer_name = customer.fio or customer.username
        if customer.user_type == customer.UserType.LEGAL and customer.company_name:
            customer_name = customer.company_name

        # Format order items
        items_text = "\n".join(
            [f"• {item.product.name_uz} - {item.quantity} kg" for item in order.items.all()]
        )

        message = f"""
🆕 <b>Yangi buyurtma</b>

📋 <b>Buyurtma raqami:</b> {order.order_number}
👤 <b>Mijoz:</b> {customer_name}
📞 <b>Telefon:</b> {customer.phone or 'N/A'}
📅 <b>Sana:</b> {order.created_at.strftime('%Y-%m-%d %H:%M')}

📦 <b>Buyurtma tarkibi:</b>
{items_text}

🔗 <b>Admin panel:</b> http://localhost:5173/admin
        """.strip()

        # Send to all admin chat IDs
        success_count = 0
        for chat_id in self.admin_chat_ids:
            if self.send_message(chat_id, message):
                success_count += 1

        return success_count > 0

    def send_to_admins(self, text: str) -> bool:
        """
        Send a message to all configured admin chat IDs.

        Args:
            text: Message text to send

        Returns:
            True if at least one message was sent successfully
        """
        if not self.is_configured():
            return False

        success_count = 0
        for chat_id in self.admin_chat_ids:
            if self.send_message(chat_id, text):
                success_count += 1

        return success_count > 0


# Global instance
telegram_service = TelegramService()

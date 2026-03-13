from app.integrations.angel_one.websocket import SmartAPIWebSocketManager


def test_normalize_price_handles_integer_paise_values() -> None:
    assert SmartAPIWebSocketManager._normalize_price(190951) == 1909.51
    assert SmartAPIWebSocketManager._normalize_price("190951") == 1909.51


def test_normalize_price_preserves_decimal_rupee_values() -> None:
    assert SmartAPIWebSocketManager._normalize_price(1909.51) == 1909.51
    assert SmartAPIWebSocketManager._normalize_price("1909.51") == 1909.51

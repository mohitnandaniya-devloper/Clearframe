from enum import IntEnum


class SubscriptionMode(IntEnum):
    LTP = 1
    QUOTE = 2
    SNAP_QUOTE = 3
    DEPTH = 4

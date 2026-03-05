"""Dialogue tree traversal logic."""

from __future__ import annotations

from typing import Any

from grimoire.models.dialogue import DialogueChoice, DialogueNode, DialogueTree


class DialogueState:
    """Tracks the current position in a dialogue tree."""

    def __init__(self, tree: DialogueTree, flags: dict[str, Any] | None = None):
        self.tree = tree
        self.current_node_id = tree.root_node
        self.flags = flags or {}
        self.history: list[str] = []  # visited node ids
        self._node_map = {n.id: n for n in tree.nodes}

    @property
    def current_node(self) -> DialogueNode | None:
        return self._node_map.get(self.current_node_id)

    @property
    def is_ended(self) -> bool:
        node = self.current_node
        if node is None:
            return True
        return len(node.choices) == 0

    def get_available_choices(self) -> list[DialogueChoice]:
        """Return choices available at the current node, filtered by conditions."""
        node = self.current_node
        if node is None:
            return []
        return [c for c in node.choices if self._check_condition(c.condition)]

    def select_choice(self, choice_id: str) -> DialogueNode | None:
        """Select a choice and advance to the next node.

        Returns the new current node, or None if the choice/node is invalid.
        """
        choices = self.get_available_choices()
        choice = next((c for c in choices if c.id == choice_id), None)
        if choice is None:
            return None

        self.history.append(self.current_node_id)

        # Apply state changes from current node
        node = self.current_node
        if node and node.state_changes:
            self.flags.update(node.state_changes)

        self.current_node_id = choice.next_node
        new_node = self.current_node

        # Apply state changes from new node if it has them and is a terminal
        if new_node and new_node.state_changes and len(new_node.choices) == 0:
            self.flags.update(new_node.state_changes)

        return new_node

    def _check_condition(self, condition: str | None) -> bool:
        """Evaluate a simple condition string against current flags.

        Supports: 'flag == value', 'flag != value', 'flag == true/false',
        and bare 'flag' (truthy check).
        """
        if condition is None:
            return True

        condition = condition.strip()
        if not condition:
            return True

        # Handle == and !=
        for op in ("!=", "=="):
            if op in condition:
                key, val = [s.strip() for s in condition.split(op, 1)]
                actual = self.flags.get(key)

                # Parse value
                if val.lower() == "true":
                    expected: Any = True
                elif val.lower() == "false":
                    expected = False
                elif val.isdigit():
                    expected = int(val)
                else:
                    try:
                        expected = float(val)
                    except ValueError:
                        expected = val

                if op == "==":
                    return actual == expected
                return actual != expected

        # Bare flag — truthy check
        return bool(self.flags.get(condition))

"""CLI test harness — async, with full LLM + embedding integration."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from grimoire.engine.game_state import PlayerAction
from grimoire.engine.session import GameSession
from grimoire.loader.world_loader import load_world


class CLIHarness:
    """Command-line interface for playing the game with LLM integration."""

    def __init__(self, session: GameSession, world_path: str = ""):
        self.session = session
        self._world_path = world_path
        self._dialogue_char_id: str = ""

    @property
    def gs(self):
        return self.session.game_state

    @property
    def in_dialogue(self) -> bool:
        return bool(self._dialogue_char_id)

    async def run(self) -> None:
        print(f"\n=== {self.session.world_data.name} ===")
        print(f"  {self.session.world_data.description.strip()}")

        llm_status = "connected" if self.session.llm else "off (no LLM)"
        embed_status = "on" if self.session.matcher else "off (no embeddings)"
        print(f"\n  LLM: {llm_status}  |  Embeddings: {embed_status}")
        print(f"\nYou are at: {self.gs.player_location}")
        print("Type 'help' for commands.\n")

        self._cmd_look()

        while True:
            try:
                if self.in_dialogue:
                    prompt = f"[talking to {self._dialogue_char_id}] > "
                else:
                    prompt = "> "
                raw = await asyncio.get_event_loop().run_in_executor(None, lambda: input(prompt).strip())
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye.")
                break

            if not raw:
                continue

            if self.in_dialogue:
                await self._handle_dialogue_input(raw)
            else:
                await self._handle_command(raw)

    async def _handle_command(self, raw: str) -> None:
        parts = raw.split(maxsplit=1)
        cmd = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        if cmd == "help":
            self._cmd_help()
        elif cmd == "look":
            self._cmd_look()
        elif cmd in ("go", "move"):
            await self._cmd_move(arg)
        elif cmd == "talk":
            await self._cmd_talk(arg)
        elif cmd == "wait":
            await self._cmd_wait(arg)
        elif cmd in ("do", "interact"):
            await self._cmd_interact(arg)
        elif cmd == "attack":
            await self._cmd_attack(arg)
        elif cmd == "status":
            self._cmd_status()
        elif cmd == "flags":
            self._cmd_flags()
        elif cmd == "beats":
            self._cmd_beats()
        elif cmd == "tokens":
            self._cmd_tokens()
        elif cmd == "save":
            self._cmd_save(arg)
        elif cmd == "load":
            self._cmd_load(arg)
        elif cmd == "quit":
            print("Goodbye.")
            sys.exit(0)
        else:
            print(f"Unknown command: {cmd}. Type 'help' for commands.")

    async def _handle_dialogue_input(self, raw: str) -> None:
        if raw.lower() in ("quit", "leave", "bye", "exit"):
            print("You step away from the conversation.")
            self.session.end_dialogue(self._dialogue_char_id)
            self._dialogue_char_id = ""
            return

        dlg = self.session.get_active_dialogue(self._dialogue_char_id)
        choices = dlg.get_available_choices() if dlg else []

        # Try numbered selection — translate to choice ID
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(choices):
                raw = choices[idx].id
        except ValueError:
            pass

        # Free text starting with * is always sent as free-text (skip exact match)
        free_text = raw.startswith("*")
        if free_text:
            raw = raw[1:].strip()

        if not free_text:
            # Check exact ID match before hitting the session
            for c in choices:
                if raw == c.id:
                    result = await self.session.dialogue_input(self._dialogue_char_id, raw)
                    self._show_dialogue_result(result)
                    return

        # Send through session (does embedding match + LLM fallback)
        result = await self.session.dialogue_input(self._dialogue_char_id, raw)
        self._show_dialogue_result(result)

    def _show_dialogue_result(self, result) -> None:
        # Show match info for debugging
        if result.matched_choice:
            mc = result.matched_choice
            if mc["similarity"] < 1.0:
                print(f"  (matched: \"{mc['text']}\" — similarity {mc['similarity']})")

        # Show LLM response metadata
        if result.writer_response:
            wr = result.writer_response
            if wr.emotion:
                print(f"  [{wr.emotion}]")
            if wr.action:
                print(f"  *{wr.action}*")

        print(f"\n  {result.speaker.upper()}: {result.text.strip()}")

        if result.is_ended:
            print("\n  [Conversation ends.]")
            self._dialogue_char_id = ""
        elif result.choices:
            print()
            for i, c in enumerate(result.choices, 1):
                print(f"  [{i}] {c['text']}")
            dlg = self.session.get_active_dialogue(self._dialogue_char_id)
            if dlg and dlg.current_node and dlg.current_node.llm_escape:
                print(f"  [*] Type something else...")
            print()

    def _cmd_help(self) -> None:
        print("""
Commands:
  look              — Describe current location
  go <place>        — Move to a connected place
  talk <character>  — Start conversation with an NPC
  do <action>       — Perform an action (LLM-narrated)
  attack <character>— Attack a character (protection enforced)
  wait <hours>      — Wait N hours (advances time)
  status            — Show game state (time, location)
  flags             — Show current world flags
  beats             — Show active story beats
  tokens            — Show LLM token usage
  save [path]       — Save game (default: saves/quicksave.json)
  load [path]       — Load game (default: saves/quicksave.json)
  quit              — Exit the game

In dialogue:
  1, 2, 3...        — Pick a numbered choice
  *<free text>      — Force free-text input (embedding match + LLM)
  leave             — End conversation
""")

    def _cmd_look(self) -> None:
        result = self.gs.process_action(PlayerAction(type="look"))
        print(f"\n{result.narration.strip()}\n")
        if result.scene:
            npcs = result.scene.npcs_present
            if npcs:
                names = [f"{n.name} ({n.occupation})" for n in npcs]
                print(f"  Present: {', '.join(names)}")
            connections = result.scene.place.connections
            if connections:
                print(f"  Exits: {', '.join(connections)}")
            print()

    async def _cmd_move(self, target: str) -> None:
        if not target:
            place = self.gs.get_place(self.gs.player_location)
            if place:
                print(f"Go where? Exits: {', '.join(place.connections)}")
            return

        result = await self.session.process_action(PlayerAction(type="move", target=target))
        print(f"\n{result.narration.strip()}")

        # Show NPC reactions
        for resp in result.npc_responses:
            if "system" in resp:
                print(f"\n  [{resp['system']}]")
            elif "character_id" in resp:
                char = self.gs.get_character(resp["character_id"])
                name = char.name if char else resp["character_id"]
                print(f"\n  {name}: \"{resp['text']}\"")

        if result.scene:
            npcs = result.scene.npcs_present
            if npcs:
                print(f"\n  Present: {', '.join(n.name for n in npcs)}")
            connections = result.scene.place.connections
            if connections:
                print(f"  Exits: {', '.join(connections)}")
        print()

    async def _cmd_talk(self, target: str) -> None:
        if not target:
            print("Talk to whom?")
            return

        # Find character by id or name
        char = self.gs.get_character(target)
        if char is None:
            for c in self.gs.world.characters.values():
                if c.name.lower() == target.lower() or c.name.lower().startswith(target.lower()):
                    char = c
                    break
        if char is None:
            print(f"There's nobody called '{target}' here.")
            return

        result = await self.session.start_dialogue(char.id)
        self._dialogue_char_id = char.id if not result.is_ended else ""

        self._show_dialogue_result(result)

    async def _cmd_wait(self, arg: str) -> None:
        result = await self.session.process_action(
            PlayerAction(type="wait", detail=arg or "1"))
        print(f"\n{result.narration}")
        for resp in result.npc_responses:
            if "system" in resp:
                print(f"  [{resp['system']}]")
        expired = self.session.director.check_deadlines(self.gs.tick)
        for beat in expired:
            print(f"  [Story beat deadline passed: {beat.name}]")
        print(f"  Time: hour {self.gs.time.hour}, day {self.gs.time.day}")
        print()

    async def _cmd_interact(self, detail: str) -> None:
        if not detail:
            print("Do what?")
            return
        result = await self.session.process_action(
            PlayerAction(type="interact", detail=detail))
        print(f"\n{result.narration.strip()}")
        for resp in result.npc_responses:
            if "character_id" in resp:
                char = self.gs.get_character(resp["character_id"])
                name = char.name if char else resp["character_id"]
                print(f"  {name}: \"{resp['text']}\"")
        print()

    async def _cmd_attack(self, target: str) -> None:
        if not target:
            print("Attack whom?")
            return
        # Resolve character name
        char = self.gs.get_character(target)
        if char is None:
            for c in self.gs.world.characters.values():
                if c.name.lower() == target.lower() or c.name.lower().startswith(target.lower()):
                    char = c
                    break
        if char is None:
            print(f"There's nobody called '{target}' here.")
            return

        result = await self.session.process_action(
            PlayerAction(type="attack", target=char.id))
        print(f"\n{result.narration.strip()}")
        for resp in result.npc_responses:
            if "character_id" in resp:
                npc = self.gs.get_character(resp["character_id"])
                name = npc.name if npc else resp["character_id"]
                print(f"  {name}: \"{resp['text']}\"")
        print()

    def _cmd_status(self) -> None:
        gs = self.gs
        print(f"\n  Location: {gs.player_location}")
        print(f"  Tick: {gs.tick}  Hour: {gs.time.hour}  Day: {gs.time.day}")
        print(f"  Events logged: {len(gs.event_log)}")
        print(f"  LLM tokens used: {self.session.tracker.total_tokens}")
        print()

    def _cmd_flags(self) -> None:
        if not self.gs.flags:
            print("  No flags set.")
        else:
            for k, v in self.gs.flags.items():
                print(f"  {k}: {v}")
        print()

    def _cmd_beats(self) -> None:
        active = self.session.director.get_active_beats()
        if not active:
            print("  No active story beats.")
        else:
            for b in active:
                deadline = f" (deadline: {b.deadline})" if b.deadline else ""
                print(f"  [{b.status}] {b.name}: {b.description}{deadline}")
        print()

    def _cmd_save(self, arg: str) -> None:
        save_path = arg or "saves/quicksave.json"
        from grimoire.storage.save_load import save_game
        save_game(self.gs, self._world_path, save_path, director=self.session.director)
        print(f"  Game saved to {save_path}\n")

    def _cmd_load(self, arg: str) -> None:
        save_path = arg or "saves/quicksave.json"
        try:
            from grimoire.storage.save_load import load_game, restore_game_state
            save_data = load_game(save_path)
            restore_game_state(save_data, self.gs, director=self.session.director)
            print(f"  Game loaded from {save_path}")
            print(f"  Tick: {self.gs.tick}  Location: {self.gs.player_location}\n")
        except FileNotFoundError:
            print(f"  No save file found at {save_path}\n")

    def _cmd_tokens(self) -> None:
        tracker = self.session.tracker
        print(f"\n  Total tokens: {tracker.total_tokens}")
        by_job = tracker.summary_by_job()
        if by_job:
            for job, tokens in by_job.items():
                print(f"    {job}: {tokens}")
        else:
            print("    No LLM calls yet.")
        print()


async def async_main():
    world_path = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).parent.parent.parent / "world")
    start = sys.argv[2] if len(sys.argv) > 2 else "rusty_tap"

    world_data = load_world(world_path)

    # Try to set up LLM
    llm = None
    try:
        from grimoire.llm.ollama import OllamaProvider
        llm = OllamaProvider()
        print(f"  Connecting to Ollama at {llm._base_url} ({llm._model})...")
    except Exception as e:
        print(f"  Warning: Could not initialize LLM provider: {e}")
        print("  Running without LLM — authored dialogue only.")

    # Try to set up embeddings
    embedder = None
    try:
        from grimoire.llm.embeddings import LocalEmbeddingProvider
        print("  Loading embedding model (all-MiniLM-L6-v2)...")
        embedder = LocalEmbeddingProvider()
        print("  Embedding model loaded.")
    except Exception as e:
        print(f"  Warning: Could not load embedding model: {e}")
        print("  Running without embeddings — numbered choices only.")

    # Try to set up storage
    db = None
    vector_store = None
    try:
        from grimoire.storage.database import Database
        db = Database()
        await db.connect()
        print("  SQLite storage: connected (in-memory)")
    except Exception as e:
        print(f"  Warning: Could not initialize SQLite: {e}")

    try:
        from grimoire.storage.vector_store import VectorStore
        vector_store = VectorStore(embedder=embedder)
        print("  Vector store: connected (ephemeral)")
    except Exception as e:
        print(f"  Warning: Could not initialize vector store: {e}")

    session = GameSession(
        world_data, llm=llm, embedder=embedder, start_location=start,
        db=db, vector_store=vector_store,
    )
    harness = CLIHarness(session, world_path=world_path)
    await harness.run()

    if db:
        await db.close()
    if llm:
        await llm.close()


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()

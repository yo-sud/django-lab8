"""python -m agent --intent '{...}'   |   python -m agent --ask "pregunta en lenguaje natural"

Environment: QUIZ_URL (default http://127.0.0.1:8000) and QUIZ_TOKEN_AGENTE (the agent's token).
"""
import argparse
import json
import os
import sys

from .gateway import execute
from .llm import ask_model


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m agent", description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--intent", help='JSON, p. ej. \'{"op": "exams_list"}\'')
    group.add_argument("--ask", help="pregunta en lenguaje natural para el modelo local")
    args = parser.parse_args(argv)

    base_url = os.environ.get("QUIZ_URL", "http://127.0.0.1:8000")
    agent_token = os.environ.get("QUIZ_TOKEN_AGENTE")
    if not agent_token:
        print("Falta QUIZ_TOKEN_AGENTE (el token del agente).", file=sys.stderr)
        return 1

    if args.ask is not None:
        try:
            intent = ask_model(args.ask)
        except (RuntimeError, ValueError, OSError) as exc:
            print(f"No se pudo consultar al modelo: {exc}", file=sys.stderr)
            return 1
        print("El modelo propone:", json.dumps(intent, ensure_ascii=False))
    else:
        try:
            intent = json.loads(args.intent)
        except json.JSONDecodeError as exc:
            print(f"--intent no es JSON válido: {exc}", file=sys.stderr)
            return 1

    result = execute(
        intent, base_url=base_url, agent_token=agent_token,
        audit_path="agent_audit.jsonl",
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

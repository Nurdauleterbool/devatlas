#!/usr/bin/env python3
"""Validate the OpenAPI contract, concrete examples and frontend service coverage.

Run from any working directory after installing _docs/requirements-contract.txt:
    python scripts/validate_openapi.py
All references must be local to the contract; validation never fetches a remote ref.
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys
from typing import Any, Iterator
from urllib.parse import unquote

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import OpenAPIV31SpecValidator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


ROOT = Path(__file__).resolve().parents[1]
BASE_URI = "urn:devatlas:openapi"
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
SCHEMA_MAPS = {"properties", "patternProperties", "$defs", "dependentSchemas"}
SCHEMA_LISTS = {"allOf", "anyOf", "oneOf", "prefixItems"}
SCHEMA_SINGLES = {
    "items", "contains", "additionalProperties", "unevaluatedProperties",
    "not", "if", "then", "else", "propertyNames", "unevaluatedItems", "contentSchema",
}


class ContractError(Exception):
    """A malformed contract prevents a trustworthy validation result."""


class UniqueKeyLoader(yaml.SafeLoader):
    """Do not silently discard an earlier YAML path, status, property or example."""

    def construct_mapping(self, node: yaml.MappingNode, deep: bool = False) -> dict:
        self.flatten_mapping(node)
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            try:
                duplicate = key in result
            except TypeError as error:
                raise ContractError(f"YAML line {key_node.start_mark.line + 1}: invalid mapping key") from error
            if duplicate:
                raise ContractError(f"YAML line {key_node.start_mark.line + 1}: duplicate key {key!r}")
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def pointer(parent: str, part: Any) -> str:
    return parent + "/" + str(part).replace("~", "~0").replace("/", "~1")


def walk(value: Any, location: str = "#") -> Iterator[tuple[str, Any]]:
    yield location, value
    if isinstance(value, dict):
        for key, child in value.items():
            yield from walk(child, pointer(location, key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, pointer(location, index))


class ContractValidator:
    def __init__(self, document: dict, service_path: Path) -> None:
        self.document = document
        self.service_path = service_path
        self.errors: list[str] = []
        self.example_count = 0
        self.operation_count = 0
        self.schemas: dict[str, Any] = {}
        self.format_checker = FormatChecker()
        self.registry = Registry().with_resource(
            BASE_URI, Resource.from_contents(document, default_specification=DRAFT202012),
        )

    def error(self, location: str, message: str) -> None:
        self.errors.append(f"{location}: {message}")

    def resolve(self, ref: str) -> tuple[str, Any]:
        if not isinstance(ref, str) or not ref.startswith("#/"):
            raise ContractError(f"reference must be a local JSON pointer, got {ref!r}")
        value: Any = self.document
        try:
            for part in unquote(ref[2:]).split("/"):
                key = part.replace("~1", "/").replace("~0", "~")
                value = value[int(key)] if isinstance(value, list) else value[key]
        except (KeyError, IndexError, ValueError, TypeError) as error:
            raise ContractError(f"unresolved reference {ref}") from error
        return ref, value

    def dereference(self, value: Any, location: str) -> tuple[str, Any]:
        seen = set()
        while isinstance(value, dict) and "$ref" in value:
            ref = value["$ref"]
            if ref in seen:
                raise ContractError(f"{location}: circular Reference Object {ref}")
            seen.add(ref)
            location, value = self.resolve(ref)
        return location, value

    def collect_schema(self, location: str, schema: Any) -> None:
        if location in self.schemas:
            return
        if not isinstance(schema, (dict, bool)):
            self.error(location, "schema must be an object or boolean")
            return
        self.schemas[location] = schema
        if isinstance(schema, bool):
            return
        if "$ref" in schema and not schema["$ref"].startswith("#/components/schemas/"):
            self.error(location, "schema references must use #/components/schemas/")
        for keyword, value in schema.items():
            child_location = pointer(location, keyword)
            if keyword in SCHEMA_MAPS and isinstance(value, dict):
                for name, child in value.items():
                    self.collect_schema(pointer(child_location, name), child)
            elif keyword in SCHEMA_LISTS and isinstance(value, list):
                for index, child in enumerate(value):
                    self.collect_schema(pointer(child_location, index), child)
            elif keyword in SCHEMA_SINGLES and isinstance(value, (dict, bool)):
                self.collect_schema(child_location, value)

    def validate_example(self, schema_location: str, value: Any, location: str) -> None:
        validator = Draft202012Validator(
            {"$ref": BASE_URI + schema_location},
            registry=self.registry,
            format_checker=self.format_checker,
        )
        self.example_count += 1
        try:
            for error in validator.iter_errors(value):
                instance_path = "/".join(str(item) for item in error.absolute_path) or "<root>"
                self.error(location, f"example at {instance_path}: {error.message}")
        except Exception as error:
            self.error(location, f"could not resolve/validate example: {error}")

    def schema_examples(self, schema: Any, location: str) -> list[tuple[str, Any]]:
        """Examples on the full schema count; item/property examples do not."""
        if not isinstance(schema, dict):
            return []
        examples = []
        if "example" in schema:
            examples.append((pointer(location, "example"), schema["example"]))
        if isinstance(schema.get("examples"), list):
            examples.extend(
                (pointer(pointer(location, "examples"), index), value)
                for index, value in enumerate(schema["examples"])
            )
        if "$ref" in schema:
            ref_location, target = self.dereference(schema, location)
            examples.extend(self.schema_examples(target, ref_location))
        return examples

    def object_examples(self, value: dict, location: str) -> list[tuple[str, Any]]:
        examples = []
        if "example" in value:
            examples.append((pointer(location, "example"), value["example"]))
        for name, example in value.get("examples", {}).items():
            example_location = pointer(pointer(location, "examples"), name)
            example_location, example = self.dereference(example, example_location)
            if not isinstance(example, dict) or "value" not in example:
                self.error(example_location, "example needs an inline value for repeatable validation")
                continue
            examples.append((pointer(example_location, "value"), example["value"]))
        return examples

    def validate_document(self) -> None:
        if not str(self.document.get("openapi", "")).startswith("3.1."):
            raise ContractError("expected OpenAPI 3.1.x")
        for location, value in walk(self.document):
            if isinstance(value, dict) and "$ref" in value:
                self.resolve(value["$ref"])
        for error in OpenAPIV31SpecValidator(self.document).iter_errors():
            path = "#/" + "/".join(str(part) for part in error.path)
            self.error(path, f"OpenAPI: {error.message}")
        if self.errors:
            return
        components = self.document.get("components", {}).get("schemas", {})
        for name, schema in components.items():
            self.collect_schema(pointer("#/components/schemas", name), schema)
        for location, value in walk(self.document):
            if isinstance(value, dict) and "schema" in value:
                self.collect_schema(pointer(location, "schema"), value["schema"])
        for location, schema in self.schemas.items():
            try:
                Draft202012Validator.check_schema(schema)
            except Exception as error:
                self.error(location, f"invalid JSON Schema: {error}")
                continue
            # Resolve and validate the schema's own examples, including $ref siblings.
            if isinstance(schema, dict):
                own_schema = {key: value for key, value in schema.items() if key != "$ref"}
                for example_location, example in self.schema_examples(own_schema, location):
                    self.validate_example(location, example, example_location)
        for location, value in walk(self.document):
            if not isinstance(value, dict):
                continue
            # Media Types, Parameters and Headers all use schema + example(s).
            if "schema" in value:
                for example_location, example in self.object_examples(value, location):
                    self.validate_example(pointer(location, "schema"), example, example_location)

    def check_json_content(self, value: dict, location: str, require_examples: bool) -> None:
        for content_type, media in value.get("content", {}).items():
            if content_type != "application/json" and not content_type.endswith("+json"):
                continue
            media_location = pointer(pointer(location, "content"), content_type)
            if "schema" not in media:
                self.error(media_location, "JSON content needs a schema")
                continue
            examples = self.object_examples(media, media_location)
            if not examples:
                examples = self.schema_examples(media["schema"], pointer(media_location, "schema"))
                # A referenced schema's examples must also satisfy inline sibling constraints.
                for example_location, example in examples:
                    self.validate_example(pointer(media_location, "schema"), example, example_location)
            if require_examples and not examples:
                self.error(media_location, "JSON request/success response needs an example")

    def validate_operations(self) -> None:
        service_source = self.service_path.read_text(encoding="utf-8")
        interface = re.search(
            r"export\s+interface\s+DevAtlasService\s*\{(.*?)^\}",
            service_source, re.MULTILINE | re.DOTALL,
        )
        if interface is None:
            raise ContractError(f"DevAtlasService interface not found in {self.service_path}")
        interface_body = re.sub(r"/\*.*?\*/|//[^\n]*", "", interface[1], flags=re.DOTALL)
        methods = re.findall(
            r"^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*:\s*Promise\s*<",
            interface_body, re.MULTILINE,
        )
        if not methods:
            raise ContractError("no Promise-returning DevAtlasService methods found")
        mapped: list[str] = []
        mock_only = self.document.get("x-mock-only-service-methods")
        if mock_only != ["logInDemo"]:
            self.error("#/x-mock-only-service-methods", "must be exactly ['logInDemo']")
        else:
            mapped.extend(mock_only)
        operation_ids: set[str] = set()
        for path, path_item in self.document.get("paths", {}).items():
            path_location, path_item = self.dereference(path_item, pointer("#/paths", path))
            for method, operation in path_item.items():
                if method not in HTTP_METHODS:
                    continue
                self.operation_count += 1
                location = pointer(path_location, method)
                operation_id = operation.get("operationId")
                if not isinstance(operation_id, str) or not operation_id:
                    self.error(location, "operationId is required")
                elif operation_id in operation_ids:
                    self.error(location, f"duplicate operationId {operation_id}")
                else:
                    operation_ids.add(operation_id)
                mapping = operation.get("x-service-methods")
                health_operation = path == "/health" and method == "get"
                if not isinstance(mapping, list) or (not mapping and not health_operation) or not all(isinstance(item, str) for item in mapping):
                    self.error(location, "x-service-methods must be a nonempty array of method names (except GET /health)")
                else:
                    mapped.extend(mapping)
                if re.search(r"(?:^|/)me(?:/|$)", path):
                    security = operation.get("security", self.document.get("security", []))
                    if not security or any("cookieSession" not in alternative for alternative in security):
                        self.error(location, "every /me security alternative must require cookieSession")
                if "requestBody" in operation:
                    request_location, request = self.dereference(operation["requestBody"], pointer(location, "requestBody"))
                    self.check_json_content(request, request_location, require_examples=True)
                responses = operation.get("responses", {})
                if not any(str(status).startswith(("4", "5")) or status == "default" for status in responses):
                    self.error(location, "at least one error response must be documented")
                if not any(str(status).startswith("2") for status in responses):
                    self.error(location, "at least one success response must be documented")
                for status, response in responses.items():
                    response_location, response = self.dereference(response, pointer(pointer(location, "responses"), status))
                    self.check_json_content(response, response_location, require_examples=str(status).startswith("2"))
        counts = Counter(mapped)
        for name in sorted(set(methods) | set(mapped)):
            if name not in methods:
                self.error("service coverage", f"unknown method {name}")
            elif counts[name] != 1:
                self.error("service coverage", f"{name} appears {counts[name]} times; expected exactly once")
        scheme = self.document.get("components", {}).get("securitySchemes", {}).get("cookieSession", {})
        if scheme.get("type") != "apiKey" or scheme.get("in") != "cookie" or not scheme.get("name"):
            self.error("#/components/securitySchemes/cookieSession", "must define a named apiKey cookie")

    def validate_public_quizzes(self) -> None:
        def private_field(name: str) -> bool:
            normalized = re.sub(r"[^a-z]", "", name.lower())
            return any(word in normalized for word in ("correct", "answer", "explanation", "grading")) or normalized in {
                "score", "passed", "feedback", "result", "results",
            }

        for name in ("Quiz", "QuizQuestion", "QuizOption"):
            root = "#/components/schemas/" + name
            _, schema = self.resolve(root)
            pending = [(root, schema)]
            seen_refs = {root}
            while pending:
                schema_location, current = pending.pop()
                for location, value in walk(current, schema_location):
                    if not isinstance(value, dict):
                        continue
                    if "$ref" in value and value["$ref"] not in seen_refs:
                        ref_location, target = self.resolve(value["$ref"])
                        seen_refs.add(ref_location)
                        pending.append((ref_location, target))
                    for field in value.get("properties", {}):
                        if private_field(field):
                            self.error(location, f"public {name} exposes private grading field {field}")
                    if "example" in value or "examples" in value:
                        example_values = [value["example"]] if "example" in value else []
                        if isinstance(value.get("examples"), list):
                            example_values.extend(value["examples"])
                        for example in example_values:
                            for example_location, example_value in walk(example, location):
                                if isinstance(example_value, dict):
                                    for field in example_value:
                                        if private_field(field):
                                            self.error(example_location, f"public {name} example leaks {field}")

    def run(self) -> None:
        self.validate_document()
        if self.errors:
            return
        self.validate_operations()
        self.validate_public_quizzes()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", nargs="?", type=Path, default=ROOT / "_docs/openapi.yml")
    parser.add_argument("--service", type=Path, default=ROOT / "frontend/src/services/DevAtlasService.ts")
    args = parser.parse_args()
    try:
        document = yaml.load(args.document.read_text(encoding="utf-8"), Loader=UniqueKeyLoader)
        if not isinstance(document, dict):
            raise ContractError("OpenAPI document must be a mapping")
        # YAML timestamps, sets and non-finite numbers are not JSON payloads.
        json.dumps(document, allow_nan=False)
        validator = ContractValidator(document, args.service)
        validator.run()
        if validator.errors:
            print(f"Contract validation FAILED ({len(validator.errors)} errors):", file=sys.stderr)
            for error in validator.errors:
                print(f"- {error}", file=sys.stderr)
            return 1
        print(
            f"Contract validation PASSED: {validator.operation_count} operations, "
            f"{len(validator.schemas)} schemas/subschemas, {validator.example_count} examples; "
            "service coverage, references, cookie ownership and public quiz safety verified.",
        )
        return 0
    except Exception as error:
        print(f"Contract validation FAILED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

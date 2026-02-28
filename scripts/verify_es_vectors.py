#!/usr/bin/env python3
"""
Apex Terminal — Elasticsearch Vector Reality Triage Script
Phase 0: Scan live cluster and report vector field presence.
"""
import urllib.request
import json
import sys

BASE = "http://localhost:9200"

def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as r:
            return json.loads(r.read()), None
    except Exception as e:
        return None, str(e)

def main():
    # 1. List all indices
    data, err = get("/_cat/indices?format=json&h=index,docs.count,store.size,status")
    if err:
        print(f"FATAL: Cannot reach ES at {BASE} — {err}")
        sys.exit(1)

    indices = sorted(data, key=lambda x: x.get("index",""))
    print(f"=== CLUSTER INDICES ({len(indices)}) ===")
    for i in indices:
        print(f"  {i['index']:<55} docs={i.get('docs.count','?'):>6}  size={i.get('store.size','?')}")

    # 2. Check for dense_vector in apex-* indices
    apex = [i["index"] for i in indices if i["index"].startswith("apex-")]
    print(f"\n=== APEX INDICES ({len(apex)}) ===")

    vector_found = []
    for idx in apex:
        mapping, err2 = get(f"/{idx}/_mapping")
        if err2 or not mapping:
            print(f"  {idx}: mapping error — {err2}")
            continue
        # Walk mapping to find dense_vector fields
        dv_fields = []
        for index_name, index_data in mapping.items():
            props = index_data.get("mappings", {}).get("properties", {})
            for field, fdef in props.items():
                if fdef.get("type") == "dense_vector":
                    dv_fields.append({
                        "field": field,
                        "dims": fdef.get("dims"),
                        "similarity": fdef.get("similarity"),
                        "index": fdef.get("index"),
                    })
        if dv_fields:
            print(f"  [VECTOR FOUND] {idx}: {dv_fields}")
            vector_found.append((idx, dv_fields))
        else:
            print(f"  [no vector]    {idx}")

    # 3. Check index templates for apex-backtests and apex-workflows
    print("\n=== INDEX TEMPLATES ===")
    tmpl_data, _ = get("/_index_template?format=json")
    if tmpl_data:
        templates = tmpl_data.get("index_templates", [])
        for t in templates:
            name = t["name"]
            if "apex" in name.lower():
                patterns = t.get("index_template", {}).get("index_patterns", [])
                mappings = t.get("index_template", {}).get("template", {}).get("mappings", {})
                props = mappings.get("properties", {})
                dv = [f for f,d in props.items() if isinstance(d, dict) and d.get("type") == "dense_vector"]
                print(f"  {name:<50} patterns={patterns}  dense_vector_fields={dv if dv else 'NONE'}")

    print("\n=== SUMMARY ===")
    if vector_found:
        print(f"  Vector fields found in {len(vector_found)} indices:")
        for idx, fields in vector_found:
            print(f"    {idx}: {fields}")
        return 0
    else:
        print("  NO dense_vector fields found in any apex-* index.")
        print("  REQUIRED ACTION: Apply vector index templates and reindex.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

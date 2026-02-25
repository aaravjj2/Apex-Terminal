import re
c = open('phase1/services/api/routes/elastihack.py', encoding='utf-8', errors='ignore').read()
knn_match = re.search(r'(@router\.(get|post)\("/knn/similar_backtests".*?)(?=@router\.)', c, re.DOTALL)
hybrid_match = re.search(r'(@router\.(get|post)\("/hybrid/search".*?)(?=@router\.)', c, re.DOTALL)
proof_match = re.search(r'(@router\.(get|post)\("/proof/core_usage".*?)(?=@router\.)', c, re.DOTALL)
print(f"kNN: {bool(knn_match)} ({len(knn_match.group(1)) if knn_match else 0}c)")
print(f"hybrid: {bool(hybrid_match)} ({len(hybrid_match.group(1)) if hybrid_match else 0}c)")
print(f"proof: {bool(proof_match)} ({len(proof_match.group(1)) if proof_match else 0}c)")

"""
Enterprise Domain Glossary & Terminology Protection Engine.
Preserves specialized domain terms (Medical, Legal, FinTech, Aerospace/Defense, Engineering)
during real-time cross-language translation to prevent misinterpretation of critical terminology.
"""

import re
from typing import Dict, List, Tuple, Any

INDUSTRY_DOMAINS: List[Dict[str, Any]] = [
    {
        "id": "general",
        "name": "General Business & Operations",
        "description": "Standard conversational and operational corporate terminology",
        "termsCount": 1500,
        "active": True
    },
    {
        "id": "medical",
        "name": "Medical & Clinical Precision",
        "description": "ICD-10 classifications, pharmaceutical dosages, vital diagnostics, and anatomical nomenclature",
        "termsCount": 18450,
        "active": False,
        "sampleTerms": ["myocardial infarction", "contraindication", "pharmacokinetics", "tachycardia", "prophylaxis", "intravenous bolus", "hemostasis"]
    },
    {
        "id": "legal",
        "name": "Legal & Compliance Contracts",
        "description": "Statutory clauses, force majeure, indemnity thresholds, governing jurisdiction, and evidentiary standards",
        "termsCount": 12200,
        "active": False,
        "sampleTerms": ["force majeure", "indemnification", "subrogation", "severability clause", "prima facie", "non-disclosure agreement", "tort liability"]
    },
    {
        "id": "fintech",
        "name": "FinTech, Banking & Trading",
        "description": "Liquidity pools, EBITDA ratios, automated clearing house (ACH), escrow conditions, and algorithmic arbitrage",
        "termsCount": 9800,
        "active": False,
        "sampleTerms": ["EBITDA", "liquidity pool", "escrow settlement", "collateralized debt", "order book depth", "arbitrage spread", "KYC compliance"]
    },
    {
        "id": "defense",
        "name": "Aerospace & Mission Telemetry",
        "description": "Avionics, Mach parameters, radar cross-section, payload trajectories, and inertial navigation systems",
        "termsCount": 8900,
        "active": False,
        "sampleTerms": ["inertial guidance", "payload fairing", "radar cross-section", "avionics bus", "Mach divergence", "attitude control system", "telemetry uplink"]
    },
    {
        "id": "engineering",
        "name": "Software, Cloud & AI Systems",
        "description": "Distributed consensus, tensor weights, idempotent mutations, zero-trust perimeter, and container orchestration",
        "termsCount": 14300,
        "active": False,
        "sampleTerms": ["idempotency key", "Kubernetes pod", "distributed consensus", "gradient descent", "zero-trust architecture", "circuit breaker pattern"]
    }
]

DOMAIN_GLOSSARY_MAP: Dict[str, Dict[str, str]] = {
    "medical": {
        "heart attack": "myocardial infarction",
        "fast heartbeat": "tachycardia",
        "drug prevention": "prophylaxis",
        "blood stoppage": "hemostasis",
        "painkiller": "analgesic",
        "high blood pressure": "hypertension",
        "low blood sugar": "hypoglycemia"
    },
    "legal": {
        "unforeseen event": "force majeure",
        "hold harmless": "indemnification",
        "first look": "prima facie",
        "break clause": "severability clause",
        "good faith": "bona fide",
        "duty of care": "fiduciary obligation"
    },
    "fintech": {
        "operating profit": "EBITDA margin",
        "holding account": "escrow account",
        "identity check": "KYC/AML verification",
        "price difference": "arbitrage spread",
        "clearing house": "automated clearing house (ACH)",
        "borrowed money": "leverage ratio"
    },
    "defense": {
        "flight computer": "avionics flight management system",
        "speed of sound": "Mach 1.0 transition",
        "tracking signal": "telemetry beacon",
        "shielding": "radar cross-section suppression",
        "heading control": "inertial attitude guidance"
    },
    "engineering": {
        "safe retry": "idempotent execution",
        "load cut-off": "circuit breaker pattern",
        "service bundle": "containerized microservice",
        "zero trust": "zero-trust perimeter",
        "shared truth": "distributed consensus"
    }
}

def get_all_domains() -> List[Dict[str, Any]]:
    return INDUSTRY_DOMAINS

def get_domain_terms(domain_id: str) -> Dict[str, str]:
    if not domain_id:
        return {}
    clean_id = str(domain_id).strip().lower()
    return DOMAIN_GLOSSARY_MAP.get(clean_id, {})

def apply_glossary_protection(text: str, domain_id: str) -> Tuple[str, List[str]]:
    """
    Substitutes colloquial or layman terms with protected domain-specific nomenclature
    wrapped in double brackets [[TERM]] so translation engines preserve the exact jargon.
    """
    if not text or not domain_id or domain_id.lower() == "general":
        return (text or "", [])

    term_map = get_domain_terms(domain_id)
    if not term_map:
        return (text, [])

    processed = text
    locked_terms = []
    for plain, domain_term in term_map.items():
        pattern = re.compile(rf"\b{re.escape(plain)}\b", re.IGNORECASE)
        if pattern.search(processed):
            processed = pattern.sub(f"[[{domain_term}]]", processed)
            locked_terms.append(domain_term)

    return (processed, locked_terms)

def restore_glossary_terms(text: str) -> str:
    """
    Unpacks [[TERM]] bracket markers after translation step while preserving capitalization.
    """
    if not text:
        return ""
    return re.sub(r"\[\[(.*?)\]\]", r"\1", text)

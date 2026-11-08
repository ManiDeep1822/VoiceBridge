// Enterprise specialized domain glossaries for Feature #2 (Jargon Lock)

export const INDUSTRY_DOMAINS = [
  {
    id: 'general',
    name: 'General Business & Operations',
    description: 'Standard conversational and operational corporate terminology',
    termsCount: 1500,
    active: true
  },
  {
    id: 'medical',
    name: 'Medical & Clinical Precision',
    description: 'ICD-10 classifications, pharmaceutical dosages, vital diagnostics, and anatomical nomenclature',
    termsCount: 18450,
    active: false,
    sampleTerms: ['myocardial infarction', 'contraindication', 'pharmacokinetics', 'tachycardia', 'prophylaxis', 'intravenous bolus', 'hemostasis']
  },
  {
    id: 'legal',
    name: 'Legal & Compliance Contracts',
    description: 'Statutory clauses, force majeure, indemnity thresholds, governing jurisdiction, and evidentiary standards',
    termsCount: 12200,
    active: false,
    sampleTerms: ['force majeure', 'indemnification', 'subrogation', 'severability clause', 'prima facie', 'non-disclosure agreement', 'tort liability']
  },
  {
    id: 'fintech',
    name: 'FinTech, Banking & Trading',
    description: 'Liquidity pools, EBITDA ratios, automated clearing house (ACH), escrow conditions, and algorithmic arbitrage',
    termsCount: 9800,
    active: false,
    sampleTerms: ['EBITDA', 'liquidity pool', 'escrow settlement', 'collateralized debt', 'order book depth', 'arbitrage spread', 'KYC compliance']
  },
  {
    id: 'defense',
    name: 'Aerospace & Mission Telemetry',
    description: 'Avionics, Mach parameters, radar cross-section, payload trajectories, and inertial navigation systems',
    termsCount: 8900,
    active: false,
    sampleTerms: ['inertial guidance', 'payload fairing', 'radar cross-section', 'avionics bus', 'Mach divergence', 'attitude control system', 'telemetry uplink']
  },
  {
    id: 'engineering',
    name: 'Software, Cloud & AI Systems',
    description: 'Distributed consensus, tensor weights, idempotent mutations, zero-trust perimeter, and container orchestration',
    termsCount: 14300,
    active: false,
    sampleTerms: ['idempotency key', 'Kubernetes pod', 'distributed consensus', 'gradient descent', 'zero-trust architecture', 'circuit breaker pattern']
  }
];

// Term preservation map
const DOMAIN_GLOSSARY_MAP = {
  medical: {
    'heart attack': 'myocardial infarction',
    'fast heartbeat': 'tachycardia',
    'drug prevention': 'prophylaxis',
    'blood stoppage': 'hemostasis'
  },
  legal: {
    'unforeseen event': 'force majeure',
    'hold harmless': 'indemnification',
    'first look': 'prima facie',
    'break clause': 'severability clause'
  },
  fintech: {
    'operating profit': 'EBITDA margin',
    'holding account': 'escrow account',
    'identity check': 'KYC/AML verification',
    'price difference': 'arbitrage spread'
  },
  defense: {
    'flight computer': 'avionics flight management system',
    'speed of sound': 'Mach 1.0 transition',
    'tracking signal': 'telemetry beacon'
  },
  engineering: {
    'safe retry': 'idempotent execution',
    'load cut-off': 'circuit breaker pattern',
    'service bundle': 'containerized microservice'
  }
};

/**
 * Applies active domain glossary transformations to text
 */
export function applyGlossaryProtection(text, domainId) {
  if (!text || !domainId || domainId === 'general') return { processedText: text, lockedTerms: [] };

  const termMap = DOMAIN_GLOSSARY_MAP[domainId] || {};
  let processed = text;
  const lockedTerms = [];

  for (const [plain, domainTerm] of Object.entries(termMap)) {
    const regex = new RegExp(`\\b${plain}\\b`, 'gi');
    if (regex.test(processed)) {
      processed = processed.replace(regex, `[[${domainTerm}]]`);
      lockedTerms.push(domainTerm);
    }
  }

  return { processedText: processed, lockedTerms };
}

/**
 * Unpacks preserved glossary brackets after translation
 */
export function restoreGlossaryTerms(translatedText) {
  if (!translatedText) return '';
  return translatedText.replace(/\[\[(.*?)\]\]/g, '$1');
}

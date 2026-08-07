import { HelpCorpusLoader } from '../src/domains/AIAgentDomain/services/HelpCorpusLoader';
import { PROSPECT_CORPUS_DIR } from '../src/domains/AIAgentDomain/services/ProspectCorpusMatcher';
import { violatesGrounding } from '../src/domains/AIAgentDomain/services/HomepageAiAnswerer';
const corpus = new HelpCorpusLoader(PROSPECT_CORPUS_DIR).getCorpusBlock();
console.log('corpus contains $80:', corpus.includes('$80'), ' $299:', corpus.includes('$299'), ' $599:', corpus.includes('$599'), ' $0:', corpus.includes('$0'));
// Plausible pricing answers a model would write.
const candidates = [
  'There are four plans: Free, Starter AI at $80, Growth AI at $299 and Business AI at $599 a month.',
  'Plans run from $0 to $599 a month, with a 14-day free trial on every paid plan.',
  'Starter AI is $80/month, Growth AI $299/month, Business AI $599/month.',
  'It starts at $80 a month and there is a free plan too.',
];
candidates.forEach(a => console.log(`  ${String(violatesGrounding(a, corpus) ?? 'OK').padEnd(28)} ${a.slice(0,70)}`));

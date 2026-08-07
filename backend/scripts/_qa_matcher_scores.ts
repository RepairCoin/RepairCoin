import { ProspectCorpusMatcher } from '../src/domains/AIAgentDomain/services/ProspectCorpusMatcher';
const m = new ProspectCorpusMatcher();
const legit = ['how much does it cost','is there a free trial','what is fixflow','does this work for a barbershop',
  'can customers book online','do you have a loyalty program','is this crypto','can ai answer my customers',
  'can it write promotions','how do i sign up','i use another booking system why switch','whats the cheapest plan',
  'how do i stop double bookings','how long does setup take','i run a gym is this for me',
  'how do i bring back customers who stopped coming'];
const junk = ['write me a python script','what is the capital of france','tell me a joke','who won the world cup',
  'translate this to spanish','what is the weather','hello','thanks','write an essay about dogs'];
console.log('LEGIT (want high):');
legit.forEach(q => { const r = m.match(q); console.log(`  ${String(r?.score ?? 0).padStart(3)}  ${q}`); });
console.log('\nJUNK (want low / null):');
junk.forEach(q => { const r = m.match(q); console.log(`  ${String(r?.score ?? 0).padStart(3)}  ${q}  ${r?.article.filename ?? '(none)'}`); });

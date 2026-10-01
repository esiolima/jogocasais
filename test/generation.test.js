const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildQuestions, valid, similar } = require('../questions/service');
const rules = require('../questions/rules');
const themes = require('../themes.json'), family = require('../familia.json'), quiz = require('../quiz.json');
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function check(list, mode) {
  assert(list.length > 0); assert(list.every(q => valid(q, mode)));
  const families = list.filter(q => q.family).map(q => q.family); assert.equal(new Set(families).size,families.length);
  for (let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++) assert(!similar(list[i].text,list[j].text), `${list[i].text} / ${list[j].text}`);
}
test('500 seeded rooms: valid questions, no exact/near duplicates or repeated generated families', () => {
  for(let seed=1;seed<=500;seed++) {
    const mode = ['dupla','grupo','duelo'][seed%3];
    const context = { mode, themeId:'aleatorio', relationshipType:'casal', tensionMode:seed%4===0 };
    const catalog = mode==='duelo'?quiz:mode==='grupo'?(context.tensionMode?family.tension:family.questions.concat(family.tension)).map(text=>({text})):themes.flatMap(t=>(context.tensionMode?t.tension:t.questions.concat(t.tension)).map(text=>({text,themeId:t.id})));
    const count = mode==='duelo'?33:100;
    const list=buildQuestions({context,catalog,count,random:rng(seed)});
    check(list,mode); assert(list.length<=count); assert(list.some(q=>q.source==='rules')); assert(list.some(q=>q.source!=='rules'));
    if(!context.tensionMode) assert.equal(list.length,count);
  }
});
test('all theme/tension/relationship combinations are bounded and coherent', () => {
  for(const t of themes) for(const tensionMode of [true,false]) for(const relationshipType of ['casal','amigos','irmaos','pais_filhos','outro']) {
    const context={mode:'dupla',themeId:t.id,tensionMode,relationshipType};
    const candidates=rules.candidates(context);
    assert(candidates.every(q=>q.themeId===t.id && valid(q,'dupla')));
    if(tensionMode) assert(candidates.every(q=>q.tension));
    if(t.id==='tema3' && relationshipType!=='casal') assert.equal(candidates.length,0);
  }
});
test('provider errors, empty and invalid candidates fall back to original catalog', () => {
  for(const provider of [{candidates(){throw Error('unavailable');}},{candidates:()=>[]},{candidates:()=>[{text:'undefined?'}]},{candidates:()=>Promise.resolve([])}]) {
    const list=buildQuestions({context:{mode:'duelo'},catalog:quiz,count:10,provider,random:rng(4)});
    assert.equal(list.length,10);assert(list.every(q=>quiz.includes(q)));check(list,'duelo');
  }
});
test('known paraphrases are rejected and multiple-choice options must be distinct', () => {
  assert(similar('Quem é mais organizado?','Quem é mais organizado dentro de casa?'));
  assert(similar('Quem teria mais dificuldade de admitir que está errado?','Quem tem mais dificuldade de admitir que está errado?'));
  assert(!valid({text:'Qual sua opção favorita?',options:['A','A','B','C']},'duelo'));
});

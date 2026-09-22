const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const effectLabel = { profit: 'Profit', cash: 'Cash', assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity' };
const fmt = (value) => value === null || value === undefined ? '—' : (value < 0 ? `(${euro.format(Math.abs(value))})` : euro.format(value));
let decisions = [];
let activeFilter = 'all';
let evidenceIndex = {};
const unresolvedDecisionIds = new Set(['D046', 'D047', 'D048', 'D058', 'D072', 'D075', 'D078', 'D084', 'D091']);

function chipClass(confidence) { return confidence === 'low' ? 'warn' : confidence === 'high' ? 'good' : 'material'; }
function evidenceText(id) { return evidenceIndex[id] ? `${id} · ${evidenceIndex[id].file.replace(/\.(pdf|xlsx|csv)$/i, '')}` : id; }

function decisionCard(d) {
  const isMaterial = d.reviewTier === 'material_judgment';
  const audit = isMaterial ? `
    <div class="review-trail">
      <article class="trail-step first"><span>1 · Agent 1</span><h3>First proposal</h3><p>${d.aiProposal}</p></article>
      <article class="trail-step challenge"><span>2 · Agent 2</span><h3>Independent challenge</h3><p>${d.independentChallenge}</p></article>
      <article class="trail-step certified"><span>3 · Approved</span><h3>Student reasoning</h3><p>${d.studentReasoning}</p></article>
    </div>
    <div class="detail-block effect-block"><h3>Statement effect</h3><p class="effect-caption">${d.effectBasis || 'Impact of this classification compared with the treatment it replaces. It does not add a second amount to the final statements.'}</p><div class="effect">${Object.entries(d.statementEffect).map(([key, value]) => `<span class="effect-${key}">${effectLabel[key]}<b>${fmt(value)}</b></span>`).join('')}</div></div>` : '';
  return `<details class="decision ${d.changedFromAI ? 'decision-changed' : ''}" data-tier="${d.reviewTier}" data-unresolved="${unresolvedDecisionIds.has(d.id)}"><summary><span class="decision-id">${d.id}</span><span class="decision-question">${d.question}</span><span class="decision-meta"><span class="chip ${isMaterial ? 'material' : 'good'}">${isMaterial ? 'Material' : 'Operational'}</span>${d.changedFromAI ? '<span class="chip changed">Student override</span>' : ''}${unresolvedDecisionIds.has(d.id) ? '<span class="chip unresolved">Unresolved</span>' : ''}<span class="chip ${chipClass(d.confidence)}">${d.confidence}</span></span></summary><div class="decision-body"><div class="decision-answer"><strong>Certified answer</strong><br>${d.answer}</div><div class="detail-block"><h3>Evidence</h3><div class="evidence-list">${d.evidence.map(item => `<span title="${evidenceIndex[item]?.reliability || ''}">${evidenceText(item)}</span>`).join('')}</div></div><div class="detail-block"><h3>Review status</h3><p>${d.changedFromAI ? 'Agent 2 challenged part of Agent 1’s approach; the student-certified position records the approved refinement.' : 'Both AI analyses supported the evidence-backed approved position.'}</p></div>${audit}</div></details>`;
}

function render() {
  const visible = decisions.filter(d => activeFilter === 'all' || (activeFilter === 'changed' ? d.changedFromAI : activeFilter === 'low' ? d.confidence === 'low' : activeFilter === 'unresolved' ? unresolvedDecisionIds.has(d.id) : d.reviewTier === activeFilter));
  document.querySelector('#decision-list').innerHTML = visible.length ? visible.map(decisionCard).join('') : '<div class="empty">No decisions match this filter.</div>';
}

async function start() {
  const response = await fetch('/submission.json?v=owner-opex-trace-1');
  if (!response.ok) throw new Error('Submission data unavailable.');
  const data = await response.json();
  decisions = data.decisions;
  evidenceIndex = Object.fromEntries(data.evidence.map(item => [item.id, item]));
  document.querySelector('#total-decisions').textContent = decisions.length;
  document.querySelector('#material-decisions').textContent = decisions.filter(d => d.reviewTier === 'material_judgment').length;
  document.querySelector('#changed-decisions').textContent = decisions.filter(d => d.changedFromAI).length;
  document.querySelector('#low-decisions').textContent = decisions.filter(d => d.confidence === 'low').length;
  document.querySelector('#unresolved-decisions').textContent = decisions.filter(d => unresolvedDecisionIds.has(d.id)).length;
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
  document.querySelector('[data-action="expand-material"]').addEventListener('click', () => {
    activeFilter = 'material_judgment';
    document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item.dataset.filter === activeFilter));
    render();
    document.querySelectorAll('details.decision').forEach(item => { item.open = true; });
  });
  document.querySelector('[data-action="collapse"]').addEventListener('click', () => {
    document.querySelectorAll('details.decision').forEach(item => { item.open = false; });
  });
  render();
}

start().catch(error => { document.querySelector('#decision-list').innerHTML = `<div class="empty">${error.message}</div>`; });

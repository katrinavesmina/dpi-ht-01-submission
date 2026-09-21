const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const money = (value) => value < 0 ? `(${euro.format(Math.abs(value))})` : euro.format(value);

async function loadSubmission() {
  const response = await fetch('/submission.json?v=case-evidence-2');
  if (!response.ok) throw new Error('The approved submission data could not be loaded.');
  return response.json();
}

function rows(entries) {
  return entries.map(entry => {
    const [label, value, style = false] = entry;
    if (style === 'section') return `<tr class="section-row"><th colspan="2">${label}</th></tr>`;
    return `<tr class="${style ? 'total' : ''}"><td>${label}</td><td>${money(value)}</td></tr>`;
  }).join('');
}

const statementLabels = { profit: 'Profit', assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity' };
const impactDots = { profit: 'profit-dot', assets: 'asset-dot', liabilities: 'liability-dot', equity: 'equity-dot' };

function signedMoney(value) {
  if (!value) return '€0';
  return value < 0 ? `−${euro.format(Math.abs(value))}` : `+${euro.format(value)}`;
}

function renderImpact(data) {
  const byId = Object.fromEntries(data.decisions.map(decision => [decision.id, decision]));
  const cards = [
    { ids: ['D041'], label: 'Revenue timing', note: '€90k September deposits stay as contract liabilities until delivery.' },
    { ids: ['D042'], label: 'Bank borrowing', note: '€50k is debt, not income.' },
    { ids: ['D046', 'D047'], label: 'Owner spending', note: '€110k is an owner distribution, not a business expense.' },
    { ids: ['D057'], label: 'R-17 receivable', note: '€18k loss reduces the receivable to its expected recoverable amount.' },
    { ids: ['D058'], label: 'Damaged inventory', note: '€22k write-down; the separate €2k disposal quote is disclosed, not accrued.' },
    { ids: ['D059'], label: 'Legal claim', note: '€25k best-estimate provision records the probable obligation.' },
  ];
  document.querySelector('#impact-grid').innerHTML = cards.map(card => {
    const effects = card.ids.map(id => byId[id].statementEffect).reduce((total, effect) => Object.fromEntries(Object.keys(statementLabels).map(key => [key, (total[key] || 0) + (effect[key] || 0)])), {});
    const tags = Object.entries(effects).filter(([, value]) => value !== 0).map(([key, value]) => `<span class="impact-effect"><i class="impact-dot ${impactDots[key]}"></i>${statementLabels[key]} <b>${signedMoney(value)}</b></span>`).join('') || '<span class="impact-effect neutral">Presentation only</span>';
    return `<article class="impact-card"><div class="impact-card-top"><span>${card.ids.join(' + ')}</span><h3>${card.label}</h3></div><p>${card.note}</p><div class="impact-effects">${tags}</div></article>`;
  }).join('');
}

function scheduleCard(title, rowsHtml, note = '') {
  return `<article class="schedule-card"><h3>${title}</h3><div class="schedule-rows">${rowsHtml}</div>${note ? `<p>${note}</p>` : ''}</article>`;
}

function scheduleRows(entries) {
  return entries.map(([label, value]) => `<div><span>${label}</span><b>${money(value)}</b></div>`).join('');
}

function renderSchedules(data) {
  const s = data.schedules;
  document.querySelector('#schedule-grid').innerHTML = [
    scheduleCard('Revenue & receivables', scheduleRows([['Delivered revenue', s.revenueAndReceivables.deliveredRevenue], ['Gross receivables', s.revenueAndReceivables.closingReceivablesGross], ['R-17 loss allowance', -s.revenueAndReceivables.r17Allowance], ['Net receivables', s.revenueAndReceivables.closingReceivablesNet], ['Contract liabilities', s.revenueAndReceivables.contractLiabilities]])),
    scheduleCard('Inventory & materials', scheduleRows([['Opening inventory', s.inventoryAndCOGS.openingInventory], ['Purchases', s.inventoryAndCOGS.purchases], ['Materials consumed', -s.inventoryAndCOGS.physicalMaterialsConsumed], ['Damaged-stock write-down', -s.inventoryAndCOGS.damagedInventoryWriteDown], ['Closing inventory, net', s.inventoryAndCOGS.closingInventoryNet]]), '€9,000 consumption difference and €2,000 disposal quote remain disclosed.'),
    scheduleCard('Payroll', scheduleRows([['Payroll expense', s.payroll.expense], ['Cash paid', -s.payroll.cashPaid], ['Closing payroll payable', s.payroll.closingPayable], ['Direct event payroll', s.payroll.serviceDirectPayroll]])),
    scheduleCard('PPE & depreciation', scheduleRows([['Closing cost', s.ppeAndDepreciation.closingCost], ['Closing accumulated depreciation', -s.ppeAndDepreciation.closingAccumulatedDepreciation], ['Closing PPE, net', s.ppeAndDepreciation.closingNetPPE]])),
    scheduleCard('Debt & interest', scheduleRows([['Opening loan', s.debtAndInterest.openingLoan], ['New borrowing', s.debtAndInterest.newBorrowing], ['Principal repaid', -s.debtAndInterest.principalRepaid], ['Closing loan', s.debtAndInterest.closingLoan], ['Interest payable', s.debtAndInterest.interestPayable]])),
    scheduleCard('Equity', scheduleRows([['Inferred opening equity', s.equity.openingEquityInferred], ['Profit before tax', s.equity.profitBeforeTax], ['Owner distributions', -s.equity.ownerDistributions], ['Closing equity', s.equity.closingEquity]]), 'Opening trade payables of €45,000 are inferred from the roll-forward and require corroboration.'),
  ].join('');
}

function renderEvidence(data) {
  document.querySelector('#evidence-inventory').innerHTML = data.evidence.map(item => `<div class="evidence-record"><b>${item.id}</b><span>${item.file}</span><small>${item.reliability}</small></div>`).join('');
}

function renderUncertainties(data) {
  document.querySelector('#uncertainty-list').innerHTML = data.uncertainties.map(item => `<article><div><b>${item.issue}</b><span>${item.amount ? money(item.amount) : 'No amount'}</span></div><p>${item.treatment}</p></article>`).join('');
}

function showSite(data) {
  const pnl = data.statements.profitAndLoss;
  const bs = data.statements.balanceSheet;
  const cf = data.statements.cashFlow;
  document.querySelector('[data-profit]').textContent = money(pnl.profitBeforeTax);
  document.querySelector('[data-cash]').textContent = money(cf.closingCash);
  document.querySelector('[data-equity]').textContent = money(bs.equity);
  document.querySelector('[data-decisions]').textContent = data.decisions.length;
  document.querySelector('#pnl-table').innerHTML = rows([
    ['Revenue', pnl.revenue], ['Physical materials consumed', pnl.physicalMaterialsConsumed], ['Event-delivery payroll', pnl.eventDeliveryPayroll], ['Inventory write-down', pnl.inventoryWriteDown], ['Gross profit', pnl.grossProfit, true], ['Sales and partnership payroll', pnl.salesPayroll], ['Office and finance payroll', pnl.officePayroll], ['Other operating expenses', pnl.otherOperatingExpenses], ['Depreciation', pnl.depreciation], ['Expected credit loss', pnl.expectedCreditLoss], ['Legal provision', pnl.legalProvision], ['Operating profit', pnl.operatingProfit, true], ['Interest expense', pnl.interestExpense], ['Profit before tax', pnl.profitBeforeTax, true],
  ]);
  const totalLiabilities = bs.tradePayables + bs.payrollAccrual + bs.interestPayable + bs.contractLiabilities + bs.bankLoan + bs.legalProvision;
  document.querySelector('#balance-table').innerHTML = rows([
    ['Assets', null, 'section'], ['Cash', bs.cash], ['Trade receivables, net', bs.receivablesNet], ['Inventory, net', bs.inventoryNet], ['PPE, net', bs.ppeNet], ['Total assets', bs.totalAssets, true],
    ['Liabilities', null, 'section'], ['Trade payables', bs.tradePayables], ['Payroll accrual', bs.payrollAccrual], ['Interest payable', bs.interestPayable], ['Contract liabilities', bs.contractLiabilities], ['Bank loan', bs.bankLoan], ['Legal provision', bs.legalProvision], ['Total liabilities', totalLiabilities, true],
    ['Equity', null, 'section'], ['Closing equity', bs.equity], ['Total liabilities and equity', totalLiabilities + bs.equity, true],
  ]);
  document.querySelector('#cashflow-table').innerHTML = rows([
    ['Customer receipts', cf.customerReceipts], ['Supplier payments', cf.supplierPayments], ['Payroll, operating and interest payments', cf.payrollOperatingAndInterestPayments], ['Net cash from operations', cf.netCashFromOperations, true], ['PPE purchases', cf.ppePurchases], ['Net cash used in investing', cf.netCashUsedInInvesting, true], ['Loan advance less principal repaid', cf.loanAdvanceLessPrincipalRepaid], ['Owner distributions', cf.ownerDistributions], ['Net cash used in financing', cf.netCashUsedInFinancing, true], ['Net decrease in cash', cf.netDecreaseInCash], ['Opening cash', cf.openingCash], ['Closing cash', cf.closingCash, true],
  ]);
  document.querySelector('#reconcile-list').innerHTML = data.reconciliations.slice(0, 5).map(item => `<div class="reconcile"><strong>${item.name} <span class="chip good">Tied</span></strong><span>${item.calculation}</span></div>`).join('');
  document.querySelector('#action-list').innerHTML = data.boardRecommendation.immediateActions.slice(0, 5).map(item => `<li>${item}</li>`).join('');
  renderImpact(data);
  renderSchedules(data);
  renderEvidence(data);
  renderUncertainties(data);
}

loadSubmission().then(showSite).catch(error => {
  document.querySelector('#app').innerHTML = `<div class="empty"><strong>Data unavailable.</strong><br>${error.message}</div>`;
});

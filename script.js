const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(Number.isFinite(value) ? value : 0);
const numberValue = (id) => Number($(id).value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function calculateEMI(principal, annualRate, years) {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRate / 1200;
  const emi = monthlyRate === 0 ? principal / months : principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  return {emi, total: emi * months, interest: emi * months - principal};
}

function handleEMI(event) {
  if (event) event.preventDefault();
  const principal = numberValue('loanAmount');
  const rate = numberValue('interestRate');
  const years = numberValue('tenure');
  if (principal <= 0 || rate < 0 || years <= 0) return;
  const result = calculateEMI(principal, rate, years);
  $('monthlyEmi').textContent = money(result.emi);
  $('principalValue').textContent = money(principal);
  $('interestValue').textContent = money(result.interest);
  $('totalPayment').textContent = money(result.total);
  $('previewEmi').textContent = money(result.emi);
}

function handleEligibility(event) {
  if (event) event.preventDefault();
  const income = numberValue('income');
  const expenses = numberValue('expenses');
  const existingEmi = numberValue('existingEmi');
  const years = numberValue('eligibilityTenure');
  const rate = numberValue('eligibilityRate');
  if (income <= 0 || expenses < 0 || existingEmi < 0 || years <= 0 || rate < 0) return;
  // A conservative illustrative affordability assumption, not a lender's eligibility model.
  const maxDebtPayment = income * 0.40;
  const affordableEmi = Math.max(0, Math.min(income - expenses - existingEmi, maxDebtPayment - existingEmi));
  const monthlyRate = rate / 1200;
  const months = years * 12;
  const loan = affordableEmi <= 0 ? 0 : monthlyRate === 0 ? affordableEmi * months : affordableEmi * (Math.pow(1 + monthlyRate, months) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, months));
  const dti = income ? (existingEmi / income) * 100 : 0;
  const eligibilityPercent = clamp(Math.round((affordableEmi / Math.max(income * .4, 1)) * 100), 0, 100);
  $('eligibleAmount').textContent = money(loan);
  $('suggestedEmi').textContent = money(affordableEmi);
  $('dti').textContent = `${dti.toFixed(1)}%`;
  $('eligibilityMessage').textContent = affordableEmi > 0 ? `Your estimated payment capacity is ${eligibilityPercent}% of the assumed EMI budget. Actual lender criteria may differ.` : 'Your current inputs leave little estimated room for an additional EMI. Review expenses or existing obligations.';
  $('previewEligibility').textContent = `${eligibilityPercent}%`;
  $('previewRing').style.background = `radial-gradient(closest-side,#242832 87%,transparent 90% 100%),conic-gradient(from -15deg,#20c7e8 0 ${eligibilityPercent}%,#38434d ${eligibilityPercent}% 100%)`;
  $('previewInsight').textContent = dti < 20 ? 'Your entered existing EMI-to-income ratio is relatively low. Compare offers and keep an emergency buffer.' : dti < 35 ? 'Review your debt-to-income ratio and compare repayment options before taking on another EMI.' : 'Your current EMI commitments may be high relative to income. Consider reducing existing debt before borrowing more.';
}

function handleCredit(event) {
  if (event) event.preventDefault();
  const score = numberValue('creditScore');
  if (score < 300 || score > 900) return;
  let band, description;
  if (score >= 750) { band = 'Very strong'; description = 'This entered score is in a high range in many common scoring interpretations.'; }
  else if (score >= 700) { band = 'Good'; description = 'This entered score is in a generally good range.'; }
  else if (score >= 650) { band = 'Fair'; description = 'This entered score may benefit from consistent credit habits.'; }
  else { band = 'Needs attention'; description = 'Consider reviewing your credit report and building consistent repayment habits.'; }
  const missed = Number($('missedPayments').value);
  const utilization = $('utilization').value;
  const history = $('history').value;
  const recommendations = [];
  if (missed > 0) recommendations.push('Set reminders or autopay where suitable to avoid missed payments.');
  else recommendations.push('Continue paying all bills and loan installments on time.');
  if (utilization === 'high') recommendations.push('If possible, lower revolving credit utilization and avoid maxing out cards.');
  else if (utilization === 'medium') recommendations.push('Keeping revolving credit utilization modest may help your overall profile.');
  else recommendations.push('Maintain your low credit utilization while keeping accounts in good standing.');
  if (history === 'short') recommendations.push('Build a consistent history over time and avoid applying for many accounts at once.');
  else recommendations.push('Check your credit report periodically for errors and unfamiliar activity.');
  $('creditBand').textContent = band;
  $('creditBandText').textContent = description;
  $('creditRecommendations').innerHTML = recommendations.map(item => `<li>${item}</li>`).join('');
  $('previewScore').textContent = score;
}

const financialTips = {
  budget: 'Track spending for one month, separate needs from wants, and set a realistic savings amount before discretionary spending.',
  loan: 'Compare the annual percentage rate, processing fees, total repayment, prepayment rules, and monthly EMI—not just the advertised rate.',
  credit: 'Pay bills on time, keep credit utilization modest, review your credit report for errors, and avoid unnecessary credit applications.',
  saving: 'Start with a small automatic transfer after payday and work toward an emergency fund that can cover several months of essential expenses.'
};

$('emiForm').addEventListener('submit', handleEMI);
$('eligibilityForm').addEventListener('submit', handleEligibility);
$('creditForm').addEventListener('submit', handleCredit);
$('getTip').addEventListener('click', () => {
  const tip = financialTips[$('tipGoal').value];
  $('tipOutput').innerHTML = `<span class="sparkle">✦</span><p>${tip}</p>`;
});
$('menuToggle').addEventListener('click', () => {
  const isOpen = $('navLinks').classList.toggle('open');
  $('menuToggle').setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => {
  $('navLinks').classList.remove('open');
  $('menuToggle').setAttribute('aria-expanded', 'false');
  document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('active'));
  link.classList.add('active');
}));
document.querySelectorAll('input, select').forEach(field => field.addEventListener('input', () => {
  // The calculators update when their respective form is submitted.
}));
$('year').textContent = new Date().getFullYear();

// Populate the results with working demo calculations on first load.
handleEMI();
handleEligibility();
handleCredit();

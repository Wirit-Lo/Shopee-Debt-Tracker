const STORAGE_KEY = "shopeeDebtTracker.items";

const form = document.querySelector("#debtForm");
const debtIdInput = document.querySelector("#debtId");
const nameInput = document.querySelector("#name");
const startDateInput = document.querySelector("#startDate");
const principalInput = document.querySelector("#principal");
const monthsInput = document.querySelector("#months");
const interestRateInput = document.querySelector("#interestRate");
const paidInstallmentsInput = document.querySelector("#paidInstallments");
const resetButton = document.querySelector("#resetButton");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importFileInput = document.querySelector("#importFile");
const clearAllButton = document.querySelector("#clearAllButton");
const debtList = document.querySelector("#debtList");
const emptyState = document.querySelector("#emptyState");
const cardTemplate = document.querySelector("#debtCardTemplate");

const totalDebtEl = document.querySelector("#totalDebt");
const totalPaidEl = document.querySelector("#totalPaid");
const totalRemainingEl = document.querySelector("#totalRemaining");
const nextMonthDueEl = document.querySelector("#nextMonthDue");
const itemCountEl = document.querySelector("#itemCount");

let debts = loadDebts();

function loadDebts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDebts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
}

function money(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function numberWithCommas(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

function parseAmount(value) {
  return Number(String(value).replace(/,/g, "")) || 0;
}

function thaiDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addMonths(dateString, monthsToAdd) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.getDate();
  const result = new Date(date);
  result.setMonth(result.getMonth() + monthsToAdd);

  if (result.getDate() !== day) {
    result.setDate(0);
  }

  return result;
}

function calculateDebt(debt) {
  const principal = Number(debt.principal) || 0;
  const months = Math.max(Number(debt.months) || 1, 1);
  const interestRate = Number(debt.interestRate) || 0;
  const paidInstallments = clamp(Number(debt.paidInstallments) || 0, 0, months);
  const totalInterest = principal * (interestRate / 100) * months;
  const totalDebt = principal + totalInterest;
  const monthlyPayment = totalDebt / months;
  const paidAmount = monthlyPayment * paidInstallments;
  const remainingAmount = Math.max(totalDebt - paidAmount, 0);
  const nextDueDate = paidInstallments >= months ? null : addMonths(debt.startDate, paidInstallments + 1);

  return {
    principal,
    months,
    interestRate,
    paidInstallments,
    totalInterest,
    totalDebt,
    monthlyPayment,
    paidAmount,
    remainingAmount,
    nextDueDate,
    progress: months ? (paidInstallments / months) * 100 : 0
  };
}

function buildSchedule(debt) {
  const calc = calculateDebt(debt);
  return Array.from({ length: calc.months }, (_, index) => {
    const installment = index + 1;
    const paid = installment <= calc.paidInstallments;
    const dueDate = addMonths(debt.startDate, installment);
    const remainingAfterPayment = Math.max(calc.totalDebt - calc.monthlyPayment * installment, 0);

    return {
      installment,
      paid,
      dueDate,
      amount: calc.monthlyPayment,
      remainingAfterPayment
    };
  });
}

function getFormDebt() {
  const months = Math.max(parseInt(monthsInput.value, 10) || 1, 1);
  return {
    id: debtIdInput.value || createId(),
    name: nameInput.value.trim(),
    startDate: startDateInput.value,
    principal: parseAmount(principalInput.value),
    months,
    interestRate: Number(interestRateInput.value) || 0,
    paidInstallments: clamp(parseInt(paidInstallmentsInput.value, 10) || 0, 0, months)
  };
}

function resetForm() {
  form.reset();
  debtIdInput.value = "";
  startDateInput.valueAsDate = new Date();
  resetButton.textContent = "เริ่มใหม่";
  form.querySelector(".primary-button").textContent = "บันทึกรายการ";
}

function renderSummary() {
  const totals = debts.reduce(
    (sum, debt) => {
      const calc = calculateDebt(debt);
      sum.debt += calc.totalDebt;
      sum.paid += calc.paidAmount;
      sum.remaining += calc.remainingAmount;
      if (calc.remainingAmount > 0) {
        sum.next += calc.monthlyPayment;
      }
      return sum;
    },
    { debt: 0, paid: 0, remaining: 0, next: 0 }
  );

  totalDebtEl.textContent = money(totals.debt);
  totalPaidEl.textContent = money(totals.paid);
  totalRemainingEl.textContent = money(totals.remaining);
  nextMonthDueEl.textContent = money(totals.next);
  itemCountEl.textContent = `${debts.length} รายการ`;
}

function renderList() {
  debtList.innerHTML = "";
  emptyState.classList.toggle("is-visible", debts.length === 0);

  debts.forEach((debt) => {
    const calc = calculateDebt(debt);
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const isDone = calc.remainingAmount <= 0;

    card.querySelector("h3").textContent = debt.name;
    card.querySelector(".meta").textContent =
      `กดเงิน ${thaiDate(new Date(`${debt.startDate}T00:00:00`))} · เงินต้น ${money(calc.principal)} · ดอก ${calc.interestRate}%/เดือน · ${calc.paidInstallments}/${calc.months} งวด`;
    card.querySelector(".status-pill").textContent = isDone ? "จ่ายครบแล้ว" : `เหลือ ${calc.months - calc.paidInstallments} งวด`;
    card.querySelector(".status-pill").classList.toggle("done", isDone);
    card.querySelector('[data-field="monthlyPayment"]').textContent = money(calc.monthlyPayment);
    card.querySelector('[data-field="paidAmount"]').textContent = money(calc.paidAmount);
    card.querySelector('[data-field="remainingAmount"]').textContent = money(calc.remainingAmount);
    card.querySelector('[data-field="nextDueDate"]').textContent = isDone ? "-" : thaiDate(calc.nextDueDate);
    card.querySelector(".progress-bar").style.width = `${calc.progress}%`;

    const scheduleList = card.querySelector(".schedule-list");
    buildSchedule(debt).forEach((row) => {
      const item = document.createElement("div");
      item.className = `schedule-row${row.paid ? " is-paid" : ""}`;
      item.innerHTML = `
        <span>งวด ${row.installment}</span>
        <span>${thaiDate(row.dueDate)}</span>
        <strong>${money(row.amount)}</strong>
        <small>${row.paid ? "จ่ายแล้ว" : `หลังจ่ายเหลือ ${money(row.remainingAfterPayment)}`}</small>
      `;
      scheduleList.appendChild(item);
    });

    card.querySelector(".decrease").addEventListener("click", () => updatePaidInstallments(debt.id, -1));
    card.querySelector(".increase").addEventListener("click", () => updatePaidInstallments(debt.id, 1));
    card.querySelector(".edit").addEventListener("click", () => editDebt(debt.id));
    card.querySelector(".delete").addEventListener("click", () => deleteDebt(debt.id));

    debtList.appendChild(card);
  });
}

function render() {
  renderSummary();
  renderList();
}

function updatePaidInstallments(id, change) {
  debts = debts.map((debt) => {
    if (debt.id !== id) return debt;
    const nextPaid = clamp((Number(debt.paidInstallments) || 0) + change, 0, Number(debt.months) || 1);
    return { ...debt, paidInstallments: nextPaid };
  });
  saveDebts();
  render();
}

function editDebt(id) {
  const debt = debts.find((item) => item.id === id);
  if (!debt) return;

  debtIdInput.value = debt.id;
  nameInput.value = debt.name;
  startDateInput.value = debt.startDate;
  principalInput.value = numberWithCommas(debt.principal);
  monthsInput.value = debt.months;
  interestRateInput.value = debt.interestRate;
  paidInstallmentsInput.value = debt.paidInstallments;
  resetButton.textContent = "ยกเลิกแก้ไข";
  form.querySelector(".primary-button").textContent = "อัปเดตรายการ";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteDebt(id) {
  const debt = debts.find((item) => item.id === id);
  if (!debt || !confirm(`ลบรายการ "${debt.name}" ใช่ไหม?`)) return;
  debts = debts.filter((item) => item.id !== id);
  saveDebts();
  render();
}

function downloadBackup() {
  const backup = {
    app: "shopee-debt-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    debts
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `shopee-debt-tracker-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeImportedDebts(value) {
  const items = Array.isArray(value) ? value : value?.debts;
  if (!Array.isArray(items)) return null;

  return items
    .map((item) => {
      const months = Math.max(parseInt(item.months, 10) || 1, 1);
      const principal = Number(item.principal) || 0;
      return {
        id: item.id || createId(),
        name: String(item.name || "").trim(),
        startDate: String(item.startDate || ""),
        principal,
        months,
        interestRate: Number(item.interestRate) || 0,
        paidInstallments: clamp(parseInt(item.paidInstallments, 10) || 0, 0, months)
      };
    })
    .filter((item) => item.name && item.startDate && item.principal > 0);
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const importedDebts = normalizeImportedDebts(JSON.parse(reader.result));
      if (!importedDebts || importedDebts.length === 0) {
        alert("ไฟล์นี้ไม่มีข้อมูลรายการที่นำเข้าได้ครับ");
        return;
      }

      debts = importedDebts;
      saveDebts();
      resetForm();
      render();
      alert(`นำเข้าข้อมูลแล้ว ${debts.length} รายการ`);
    } catch {
      alert("อ่านไฟล์ไม่สำเร็จ ลองเลือกไฟล์ JSON ที่สำรองจากเว็บนี้อีกครั้งครับ");
    } finally {
      importFileInput.value = "";
    }
  });

  reader.readAsText(file);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const debt = getFormDebt();

  if (!debt.name || !debt.startDate || debt.principal <= 0) {
    alert("กรอกชื่อ วันที่ และยอดเงินให้ครบก่อนนะครับ");
    return;
  }

  const existingIndex = debts.findIndex((item) => item.id === debt.id);
  if (existingIndex >= 0) {
    debts[existingIndex] = debt;
  } else {
    debts.unshift(debt);
  }

  saveDebts();
  resetForm();
  render();
});

resetButton.addEventListener("click", resetForm);

principalInput.addEventListener("focus", () => {
  principalInput.value = String(parseAmount(principalInput.value) || "");
});

principalInput.addEventListener("blur", () => {
  const amount = parseAmount(principalInput.value);
  principalInput.value = amount ? numberWithCommas(amount) : "";
});

exportButton.addEventListener("click", downloadBackup);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => importBackup(importFileInput.files[0]));

clearAllButton.addEventListener("click", () => {
  if (debts.length === 0) return;
  if (!confirm("ล้างข้อมูลทั้งหมดใช่ไหม?")) return;
  debts = [];
  saveDebts();
  resetForm();
  render();
});

resetForm();
render();

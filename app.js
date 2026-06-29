const STORAGE_KEY = "shopeeDebtTracker.items";
const API_BASE = "/api";

const form = document.querySelector("#debtForm");
const debtIdInput = document.querySelector("#debtId");
const nameInput = document.querySelector("#name");
const startDateInput = document.querySelector("#startDate");
const principalInput = document.querySelector("#principal");
const monthsInput = document.querySelector("#months");
const interestRateInput = document.querySelector("#interestRate");
const billingDayInput = document.querySelector("#billingDay");
const paidInstallmentsInput = document.querySelector("#paidInstallments");
const resetButton = document.querySelector("#resetButton");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importFileInput = document.querySelector("#importFile");
const clearAllButton = document.querySelector("#clearAllButton");
const debtList = document.querySelector("#debtList");
const emptyState = document.querySelector("#emptyState");
const cardTemplate = document.querySelector("#debtCardTemplate");
const storageStatus = document.querySelector("#storageStatus");

const totalDebtEl = document.querySelector("#totalDebt");
const totalPaidEl = document.querySelector("#totalPaid");
const totalRemainingEl = document.querySelector("#totalRemaining");
const nextMonthDueEl = document.querySelector("#nextMonthDue");
const itemCountEl = document.querySelector("#itemCount");

let debts = [];
let onlineStorage = false;

function loadLocalDebts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalDebts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function setStorageStatus(isOnline) {
  onlineStorage = isOnline;
  storageStatus.textContent = isOnline ? "ข้อมูลกลาง" : "เก็บบนเครื่องนี้";
  storageStatus.classList.toggle("is-offline", !isOnline);
}

async function loadDebts() {
  try {
    debts = await apiRequest("/debts");
    setStorageStatus(true);
  } catch {
    debts = loadLocalDebts();
    setStorageStatus(false);
  }

  render();
}

async function persistDebt(debt) {
  if (onlineStorage) {
    await apiRequest(`/debts/${encodeURIComponent(debt.id)}`, {
      method: "PUT",
      body: JSON.stringify(debt)
    });
    return;
  }

  saveLocalDebts();
}

async function persistAllDebts() {
  if (onlineStorage) {
    await apiRequest("/debts/import", {
      method: "POST",
      body: JSON.stringify({ debts })
    });
    return;
  }

  saveLocalDebts();
}

async function removeDebt(id) {
  if (onlineStorage) {
    await apiRequest(`/debts/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }

  saveLocalDebts();
}

async function clearDebts() {
  if (onlineStorage) {
    await apiRequest("/debts", { method: "DELETE" });
    return;
  }

  saveLocalDebts();
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

function monthEnd(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dateWithDay(year, monthIndex, day) {
  return new Date(year, monthIndex, Math.min(day, monthEnd(year, monthIndex)));
}

function addMonths(dateString, monthsToAdd) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.getDate();
  const targetMonth = date.getMonth() + monthsToAdd;
  return dateWithDay(date.getFullYear(), targetMonth, day);
}

function getDueDate(dateString, installment, billingDay) {
  if (!billingDay) return addMonths(dateString, installment);

  const startDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) return null;

  let firstDue = dateWithDay(startDate.getFullYear(), startDate.getMonth(), billingDay);
  if (firstDue <= startDate) {
    firstDue = dateWithDay(startDate.getFullYear(), startDate.getMonth() + 1, billingDay);
  }

  return dateWithDay(firstDue.getFullYear(), firstDue.getMonth() + installment - 1, billingDay);
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
  const billingDay = Number(debt.billingDay) || null;
  const nextDueDate = paidInstallments >= months
    ? null
    : getDueDate(debt.startDate, paidInstallments + 1, billingDay);

  return {
    principal,
    months,
    interestRate,
    paidInstallments,
    billingDay,
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
    const dueDate = getDueDate(debt.startDate, installment, calc.billingDay);
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
  const billingDay = parseInt(billingDayInput.value, 10);

  return {
    id: debtIdInput.value || createId(),
    name: nameInput.value.trim(),
    startDate: startDateInput.value,
    principal: parseAmount(principalInput.value),
    months,
    interestRate: parseAmount(interestRateInput.value),
    billingDay: Number.isFinite(billingDay) ? clamp(billingDay, 1, 31) : null,
    paidInstallments: clamp(parseInt(paidInstallmentsInput.value, 10) || 0, 0, months),
    createdAt: debtIdInput.value
      ? debts.find((item) => item.id === debtIdInput.value)?.createdAt || new Date().toISOString()
      : new Date().toISOString()
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
    const billText = calc.billingDay ? ` · ชำระทุกวันที่ ${calc.billingDay}` : "";

    card.querySelector("h3").textContent = debt.name;
    card.querySelector(".meta").textContent =
      `กดเงิน ${thaiDate(new Date(`${debt.startDate}T00:00:00`))} · เงินต้น ${money(calc.principal)} · ดอก ${calc.interestRate}%/เดือน · ${calc.paidInstallments}/${calc.months} งวด${billText}`;
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

async function updatePaidInstallments(id, change) {
  const debt = debts.find((item) => item.id === id);
  if (!debt) return;

  const nextPaid = clamp((Number(debt.paidInstallments) || 0) + change, 0, Number(debt.months) || 1);
  const updatedDebt = { ...debt, paidInstallments: nextPaid };
  debts = debts.map((item) => (item.id === id ? updatedDebt : item));
  render();

  try {
    await persistDebt(updatedDebt);
  } catch {
    alert("บันทึกข้อมูลกลางไม่สำเร็จ ลองรีเฟรชแล้วทำใหม่อีกครั้งครับ");
    await loadDebts();
  }
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
  billingDayInput.value = debt.billingDay || "";
  paidInstallmentsInput.value = debt.paidInstallments;
  resetButton.textContent = "ยกเลิกแก้ไข";
  form.querySelector(".primary-button").textContent = "อัปเดตรายการ";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteDebt(id) {
  const debt = debts.find((item) => item.id === id);
  if (!debt || !confirm(`ลบรายการ "${debt.name}" ใช่ไหม?`)) return;

  const previousDebts = debts;
  debts = debts.filter((item) => item.id !== id);
  render();

  try {
    await removeDebt(id);
  } catch {
    debts = previousDebts;
    render();
    alert("ลบข้อมูลกลางไม่สำเร็จ ลองใหม่อีกครั้งครับ");
  }
}

function downloadBackup() {
  const backup = {
    app: "shopee-debt-tracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    storage: onlineStorage ? "database" : "local",
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
      const billingDay = parseInt(item.billingDay, 10);
      return {
        id: item.id || createId(),
        name: String(item.name || "").trim(),
        startDate: String(item.startDate || ""),
        principal,
        months,
        interestRate: Number(item.interestRate) || 0,
        billingDay: Number.isFinite(billingDay) ? clamp(billingDay, 1, 31) : null,
        paidInstallments: clamp(parseInt(item.paidInstallments, 10) || 0, 0, months),
        createdAt: item.createdAt || new Date().toISOString()
      };
    })
    .filter((item) => item.name && item.startDate && item.principal > 0);
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.addEventListener("load", async () => {
    try {
      const importedDebts = normalizeImportedDebts(JSON.parse(reader.result));
      if (!importedDebts || importedDebts.length === 0) {
        alert("ไฟล์นี้ไม่มีข้อมูลรายการที่นำเข้าได้ครับ");
        return;
      }

      debts = importedDebts;
      await persistAllDebts();
      resetForm();
      render();
      alert(`นำเข้าข้อมูลแล้ว ${debts.length} รายการ`);
    } catch {
      alert("อ่านหรือบันทึกไฟล์ไม่สำเร็จ ลองเลือกไฟล์ JSON ที่สำรองจากเว็บนี้อีกครั้งครับ");
      await loadDebts();
    } finally {
      importFileInput.value = "";
    }
  });

  reader.readAsText(file);
}

function filterDecimalInput(input, allowComma = false) {
  const pattern = allowComma ? /[^0-9,.]/g : /[^0-9.]/g;
  const clean = input.value.replace(pattern, "");
  const parts = clean.split(".");
  input.value = parts.length > 1 ? `${parts.shift()}.${parts.join("")}` : clean;
}

function filterIntegerInput(input) {
  input.value = input.value.replace(/[^0-9]/g, "");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const debt = getFormDebt();

  if (!debt.name || !debt.startDate || debt.principal <= 0) {
    alert("กรอกชื่อ วันที่ และยอดเงินให้ครบก่อนนะครับ");
    return;
  }

  const previousDebts = debts;
  const existingIndex = debts.findIndex((item) => item.id === debt.id);
  if (existingIndex >= 0) {
    debts = debts.map((item) => (item.id === debt.id ? debt : item));
  } else {
    debts = [debt, ...debts];
  }

  resetForm();
  render();

  try {
    await persistDebt(debt);
  } catch {
    debts = previousDebts;
    render();
    alert("บันทึกข้อมูลกลางไม่สำเร็จ ลองใหม่อีกครั้งครับ");
  }
});

resetButton.addEventListener("click", resetForm);

principalInput.addEventListener("input", () => filterDecimalInput(principalInput, true));
interestRateInput.addEventListener("input", () => filterDecimalInput(interestRateInput));
monthsInput.addEventListener("input", () => filterIntegerInput(monthsInput));
billingDayInput.addEventListener("input", () => filterIntegerInput(billingDayInput));
paidInstallmentsInput.addEventListener("input", () => filterIntegerInput(paidInstallmentsInput));

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

clearAllButton.addEventListener("click", async () => {
  if (debts.length === 0) return;
  if (!confirm("ล้างข้อมูลทั้งหมดใช่ไหม?")) return;

  const previousDebts = debts;
  debts = [];
  resetForm();
  render();

  try {
    await clearDebts();
  } catch {
    debts = previousDebts;
    render();
    alert("ล้างข้อมูลกลางไม่สำเร็จ ลองใหม่อีกครั้งครับ");
  }
});

resetForm();
loadDebts();

const ANSWERS = [
  { value: 0, label: "[0] без ответа" },
  { value: 1, label: "[1] делает это недавно" },
  { value: 2, label: "[2] делает это давно" },
  { value: 3, label: "[3] никогда" },
];

const state = {
  ref: null,
  db: { children: [], tests: [], nextChildId: 1, nextTestId: 1 },
  selectedChildId: null,
  selectedTestId: null,
  childFilter: "",
  editingChildId: null,
  run: null,
};

const el = {
  childList: document.getElementById("childList"),
  searchInput: document.getElementById("searchInput"),
  newChildBtn: document.getElementById("newChildBtn"),
  exportBtn: document.getElementById("exportBtn"),
  emptyState: document.getElementById("emptyState"),
  childDetail: document.getElementById("childDetail"),
  childName: document.getElementById("childName"),
  childMeta: document.getElementById("childMeta"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiHigh: document.getElementById("kpiHigh"),
  kpiMid: document.getElementById("kpiMid"),
  kpiGood: document.getElementById("kpiGood"),
  testHistory: document.getElementById("testHistory"),
  algoPanel: document.getElementById("algoPanel"),
  algoBadge: document.getElementById("algoBadge"),
  algoTop: document.getElementById("algoTop"),
  algoDomainTable: document.getElementById("algoDomainTable"),
  algoContradictions: document.getElementById("algoContradictions"),
  algoRecommendations: document.getElementById("algoRecommendations"),
  algoAnswers: document.getElementById("algoAnswers"),
  editChildBtn: document.getElementById("editChildBtn"),
  startKidBtn: document.getElementById("startKidBtn"),
  startCdiBtn: document.getElementById("startCdiBtn"),
  childDialog: document.getElementById("childDialog"),
  childDialogTitle: document.getElementById("childDialogTitle"),
  childForm: document.getElementById("childForm"),
  testDialog: document.getElementById("testDialog"),
  closeTestBtn: document.getElementById("closeTestBtn"),
  testTitle: document.getElementById("testTitle"),
  testMeta: document.getElementById("testMeta"),
  progressBar: document.getElementById("progressBar"),
  questionText: document.getElementById("questionText"),
  answerGrid: document.getElementById("answerGrid"),
  prevQBtn: document.getElementById("prevQBtn"),
  nextQBtn: document.getElementById("nextQBtn"),
  finishBtn: document.getElementById("finishBtn"),
  jumpInput: document.getElementById("jumpInput"),
  answerHint: document.getElementById("answerHint"),
};

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return r.json();
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function monthsBetween(birthDate, targetDate) {
  const b = new Date(birthDate);
  const t = new Date(targetDate);
  if (Number.isNaN(+b) || Number.isNaN(+t)) return 0;
  let years = t.getFullYear() - b.getFullYear();
  let months = t.getMonth() - b.getMonth();
  let days = t.getDate() - b.getDate();
  let total = years * 12 + months;
  if (days < 0) {
    days += 30;
    total -= 1;
  }
  total += days / 30;
  return round1(total);
}

function achieved(answer) {
  return answer === 1 || answer === 2;
}

function nearestAgeByPoints(rows, field, points, factualAge, fallbackDelta = 0) {
  const list = rows
    .map((x) => ({ age: Number(x.Age), v: Number(x[field]) }))
    .filter((x) => Number.isFinite(x.age) && Number.isFinite(x.v))
    .sort((a, b) => a.age - b.age);

  const same = list.filter((x) => x.v === points);
  if (same.length) {
    return same.reduce((best, cur) =>
      Math.abs(cur.age - factualAge) < Math.abs(best.age - factualAge) ? cur : best
    ).age;
  }

  const below = list.filter((x) => x.v < points).at(-1);
  const above = list.find((x) => x.v > points);
  if (below && above) {
    return Math.abs(below.age - factualAge) <= Math.abs(above.age - factualAge)
      ? below.age
      : above.age;
  }
  if (below) return below.age + fallbackDelta;
  if (above) return above.age;
  return 0;
}

function sigmaFromKID(points, factualAge, kidFullRows) {
  const sorted = [...kidFullRows].sort((a, b) => Number(a.Age) - Number(b.Age));
  let row = sorted.find((r) => Number(r.Age) === factualAge);
  if (!row) {
    row = sorted.filter((r) => Number(r.Age) < factualAge).at(-1) || sorted[0];
  }
  if (!row) return 0;

  const p85 = Number(row.p85);
  const p96 = Number(row.p96);
  const p98 = Number(row.p98);

  if (Number.isFinite(p85) && points >= p85) return 0;
  if (Number.isFinite(p96) && Number.isFinite(p85) && points >= p96) {
    return 96 - Math.floor(((points - p96) * 9) / (p85 - p96));
  }
  if (Number.isFinite(p98) && points >= p98) return 96;
  return 98;
}

function cdiLevel(points, p85, p96) {
  if (points >= p85) return 0;
  if (points >= p96) return 96 - Math.floor(((points - p96) * 11) / (p85 - p96));
  return 96;
}

function dbSave() {
  localStorage.setItem("rcdi_modern_db_v1", JSON.stringify(state.db));
}

function getChildById(id) {
  return state.db.children.find((x) => x.id === id);
}

function getTestsByChild(id) {
  return state.db.tests
    .filter((x) => x.childId === id)
    .sort((a, b) => (a.testDate < b.testDate ? 1 : -1));
}

function getTestById(id) {
  return state.db.tests.find((x) => x.id === id);
}

function renderChildren() {
  const q = state.childFilter.trim().toLowerCase();
  const items = state.db.children
    .filter((c) => (`${c.surname} ${c.name}`).toLowerCase().includes(q))
    .sort((a, b) => (`${a.surname} ${a.name}`).localeCompare(`${b.surname} ${b.name}`, "ru"));

  el.childList.innerHTML = "";
  for (const c of items) {
    const li = document.createElement("li");
    if (c.id === state.selectedChildId) li.classList.add("active");
    const fullName = `${c.surname || ""} ${c.name || ""}`.trim() || "Без имени";
    li.innerHTML = `<div class="list-title">${fullName}</div><div class="list-meta">${c.birthDate || "-"} | ${c.sex || "-"}</div>`;
    li.onclick = () => {
      state.selectedChildId = c.id;
      renderChildren();
      renderChildDetail();
    };
    el.childList.appendChild(li);
  }
}

function testSummary(t) {
  if (t.scale === "KID") {
    return `Полная шкала: ${t.result.totalAge} мес, sigma ${t.result.sigma}`;
  }
  return `Домены: ${t.result.domainAges.map((x) => x.age).join(" / ")} мес`;
}

function riskGrade(test) {
  const lagValues = (test.result.domainAges || []).map((d) => Number(d.lag ?? (test.factualAge - d.age))).filter(Number.isFinite);
  const maxLag = lagValues.length ? Math.max(...lagValues) : 0;
  const contradictionCount = (test.contradictions || []).length;
  const naCount = Number(test.naCount || 0);

  if (test.scale === "KID") {
    const sigma = Number(test.result.sigma || 0);
    if (sigma >= 96 || maxLag >= 6) return "Высокий риск";
    if (sigma >= 85 || maxLag >= 3 || contradictionCount > 6) return "Умеренный риск";
    if (naCount > 3) return "Нужно перепроверить";
    return "Норма / близко к норме";
  }

  const maxLevel = Math.max(0, ...((test.result.domainAges || []).map((d) => Number(d.level || 0))));
  if (maxLevel >= 96 || maxLag >= 8) return "Высокий риск";
  if (maxLevel >= 85 || maxLag >= 4 || contradictionCount > 6) return "Умеренный риск";
  if (naCount > 3) return "Нужно перепроверить";
  return "Норма / близко к норме";
}

function riskClass(grade) {
  if (grade === "Высокий риск") return "risk-danger";
  if (grade === "Умеренный риск" || grade === "Нужно перепроверить") return "risk-warning";
  return "risk-good";
}

function recommendationsForTest(test) {
  const rec = [];
  const grade = riskGrade(test);
  const lagValues = (test.result.domainAges || []).map((d) => Number(d.lag ?? (test.factualAge - d.age))).filter(Number.isFinite);
  const maxLag = lagValues.length ? Math.max(...lagValues) : 0;

  if (grade === "Высокий риск") {
    rec.push("Нужна очная консультация профильного специалиста и план раннего вмешательства.");
    rec.push("Повторить оценку через 1-2 месяца для контроля динамики.");
  } else if (grade === "Умеренный риск") {
    rec.push("Рекомендуется развивающая программа дома и у специалиста.");
    rec.push("Повторный тест через 2-3 месяца.");
  } else if (grade === "Нужно перепроверить") {
    rec.push("Слишком много пропусков или неоднозначностей, лучше перепройти тест.");
  } else {
    rec.push("Динамика близка к возрастной норме. Поддерживайте регулярные развивающие занятия.");
    rec.push("Контрольный тест планово через 4-6 месяцев.");
  }

  if (maxLag >= 4) rec.push("Сфокусировать занятия на доменах с наибольшим отставанием.");
  if ((test.contradictions || []).length > 6) rec.push("Уточнить противоречивые ответы у информатора.");
  if ((test.naCount || 0) > 3) rec.push("Сократить число пустых ответов при следующем тестировании.");
  return rec;
}

function renderAlgoPanel(test) {
  if (!test) {
    el.algoPanel.classList.add("hidden");
    return;
  }
  el.algoPanel.classList.remove("hidden");
  const grade = riskGrade(test);
  el.algoBadge.textContent = `${test.scale} | ${grade}`;
  el.algoBadge.className = `badge ${riskClass(grade)}`;

  const gap = test.result.domainAges
    .map((d) => Number(d.lag ?? (test.factualAge - d.age)))
    .filter(Number.isFinite);
  const avgGap = gap.length ? round1(gap.reduce((a, b) => a + b, 0) / gap.length) : 0;
  const maxGap = gap.length ? round1(Math.max(...gap)) : 0;

  const topItems = [
    `Факт. возраст: ${test.factualAge} мес`,
    `Без ответов: ${test.naCount}`,
    `Противоречий: ${(test.contradictions || []).length}`,
    `Средний разрыв: ${avgGap} мес`,
    `Макс. разрыв: ${maxGap} мес`,
  ];
  if (test.scale === "KID") topItems.push(`Sigma: ${Number(test.result.sigma || 0)}`);
  el.algoTop.innerHTML = topItems.map((x) => `<span class="chip">${x}</span>`).join("");

  const rows = test.result.domainAges || [];
  const hasLevel = rows.some((d) => typeof d.level !== "undefined");
  const head = hasLevel
    ? "<tr><th>Домен</th><th>Баллы</th><th>Возраст домена</th><th>Разрыв</th><th>Уровень</th></tr>"
    : "<tr><th>Домен</th><th>Баллы</th><th>Возраст домена</th><th>Разрыв</th></tr>";
  const body = rows
    .map((d) => {
      const lag = Number(d.lag ?? (test.factualAge - d.age));
      if (hasLevel) {
        return `<tr><td>${d.name}</td><td>${d.points ?? "-"}</td><td>${d.age} мес</td><td>${round1(lag)} мес</td><td>${d.level ?? "-"}</td></tr>`;
      }
      return `<tr><td>${d.name}</td><td>${d.points ?? "-"}</td><td>${d.age} мес</td><td>${round1(lag)} мес</td></tr>`;
    })
    .join("");
  el.algoDomainTable.innerHTML = `<table class="table-tight"><thead>${head}</thead><tbody>${body}</tbody></table>`;

  const ctr = test.contradictions || [];
  el.algoContradictions.innerHTML = ctr.length
    ? ctr.map((p) => `<span class="pair">${p[0]}-${p[1]}</span>`).join(" ")
    : "Противоречий не найдено.";

  const rec = recommendationsForTest(test);
  el.algoRecommendations.innerHTML = rec.map((x) => `<div>• ${x}</div>`).join("");
  el.algoAnswers.textContent = test.answers || "";
}

function renderChildDetail() {
  const c = getChildById(state.selectedChildId);
  if (!c) {
    el.emptyState.classList.remove("hidden");
    el.childDetail.classList.add("hidden");
    return;
  }

  el.emptyState.classList.add("hidden");
  el.childDetail.classList.remove("hidden");
  const fullName = `${c.surname || ""} ${c.name || ""}`.trim() || "Без имени";
  el.childName.textContent = fullName;
  el.childMeta.textContent = `Дата рождения: ${c.birthDate || "-"} | Пол: ${c.sex || "-"} | Регион: ${c.region || "-"} | Информатор: ${c.informer || "-"}`;

  const tests = getTestsByChild(c.id);
  const high = tests.filter((t) => riskGrade(t) === "Высокий риск").length;
  const mid = tests.filter((t) => {
    const g = riskGrade(t);
    return g === "Умеренный риск" || g === "Нужно перепроверить";
  }).length;
  const good = tests.filter((t) => riskGrade(t) === "Норма / близко к норме").length;
  el.kpiTotal.textContent = String(tests.length);
  el.kpiHigh.textContent = String(high);
  el.kpiMid.textContent = String(mid);
  el.kpiGood.textContent = String(good);

  el.testHistory.innerHTML = tests.length
    ? tests
        .map(
          (t) => {
            const grade = riskGrade(t);
            const tagClass = riskClass(grade);
            return `<tr data-test-id="${t.id}" class="history-row${t.id === state.selectedTestId ? " active-row" : ""}"><td>${t.testDate}</td><td>${t.scale}</td><td>${t.factualAge} мес</td><td>${testSummary(t)} <span class="mini-badge ${tagClass}">${grade}</span></td><td>${t.naCount}</td><td>${t.contradictions.length}</td></tr>`;
          }
        )
        .join("")
    : `<tr><td colspan="6">Пока нет тестов</td></tr>`;

  const rows = el.testHistory.querySelectorAll("tr[data-test-id]");
  rows.forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedTestId = Number(row.dataset.testId);
      renderChildDetail();
    });
  });

  if (!tests.length) {
    state.selectedTestId = null;
    renderAlgoPanel(null);
    return;
  }
  const selected = tests.find((t) => t.id === state.selectedTestId) || tests[0];
  state.selectedTestId = selected.id;
  renderAlgoPanel(selected);
}

function openChildDialog(editingChild = null) {
  state.editingChildId = editingChild?.id ?? null;
  el.childDialogTitle.textContent = editingChild ? "Изменить ребенка" : "Новый ребенок";
  el.childForm.surname.value = editingChild?.surname ?? "";
  el.childForm.name.value = editingChild?.name ?? "";
  el.childForm.birthDate.value = editingChild?.birthDate ?? "";
  el.childForm.regDate.value = editingChild?.regDate ?? new Date().toISOString().slice(0, 10);
  el.childForm.sex.value = editingChild?.sex ?? "мужской";
  el.childForm.phone.value = editingChild?.phone ?? "";
  el.childForm.address.value = editingChild?.address ?? "";
  el.childForm.region.value = editingChild?.region ?? "";
  el.childForm.informer.value = editingChild?.informer ?? "";
  el.childDialog.showModal();
}

function saveChildFromForm() {
  const form = new FormData(el.childForm);
  const child = {
    id: state.editingChildId ?? state.db.nextChildId++,
    surname: String(form.get("surname") || "").trim(),
    name: String(form.get("name") || "").trim(),
    birthDate: String(form.get("birthDate") || ""),
    regDate: String(form.get("regDate") || ""),
    sex: String(form.get("sex") || ""),
    phone: String(form.get("phone") || "").trim(),
    address: String(form.get("address") || "").trim(),
    region: String(form.get("region") || "").trim(),
    informer: String(form.get("informer") || "").trim(),
  };

  if (child.birthDate && child.regDate && child.birthDate > child.regDate) {
    alert("Дата регистрации не может быть раньше даты рождения.");
    return;
  }

  const idx = state.db.children.findIndex((x) => x.id === child.id);
  if (idx >= 0) state.db.children[idx] = child;
  else state.db.children.push(child);

  state.selectedChildId = child.id;
  state.selectedTestId = null;
  dbSave();
  el.childDialog.close();
  renderChildren();
  renderChildDetail();
}

function contradictionsByPairs(answers, contrRows) {
  const pairs = [];
  for (let i = 0; i + 1 < contrRows.length; i += 2) {
    const q1 = Number(contrRows[i].Num);
    const q2 = Number(contrRows[i + 1].Num);
    if (answers[q1] === 3 && (answers[q2] === 1 || answers[q2] === 2)) {
      pairs.push([q1, q2]);
    }
  }
  return pairs;
}

function scoreKID(run) {
  const answers = run.answers;
  const dms = state.ref.KIDdms;
  const grouped = new Map();
  for (const row of dms) {
    const key = row.Domain;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(Number(row.ID));
  }

  const domainNames = [...grouped.keys()];
  const domainPoints = domainNames.map((name) => {
    const pts = grouped.get(name).reduce((n, q) => n + (achieved(answers[q]) ? 1 : 0), 0);
    return { name, points: pts };
  });

  const factualAge = monthsBetween(run.child.birthDate, run.testDate);
  const ageTables = [
    state.ref.KID_1Cogn,
    state.ref.KID_2Mot,
    state.ref.KID_3Lang,
    state.ref.KID_4Self,
    state.ref.KID_5Soc,
  ];

  const domainAges = domainPoints.map((d, idx) => ({
    name: d.name,
    points: d.points,
    age: round1(nearestAgeByPoints(ageTables[idx], "p50", d.points, factualAge)),
    lag: round1(factualAge - round1(nearestAgeByPoints(ageTables[idx], "p50", d.points, factualAge))),
  }));

  const totalPoints = answers.slice(1).reduce((n, a) => n + (achieved(a) ? 1 : 0), 0);
  const totalAge = round1(nearestAgeByPoints(state.ref.KID_Full, "p50", totalPoints, factualAge));
  const sigma = sigmaFromKID(totalPoints, factualAge, state.ref.KID_Full);

  return { domainAges, totalAge, totalPoints, sigma };
}

function scoreCDI(run) {
  const answers = run.answers;
  const dms = state.ref.CDIdms;
  const grouped = new Map();
  for (const row of dms) {
    const key = row.Domain;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(Number(row.ID));
  }

  const domainNames = [...grouped.keys()];
  const domainPoints = domainNames.map((name) => {
    const pts = grouped.get(name).reduce((n, q) => n + (achieved(answers[q]) ? 1 : 0), 0);
    return { name, points: pts };
  });

  const factualAge = monthsBetween(run.child.birthDate, run.testDate);
  const sexSuffix = run.child.sex === "мужской" ? "B" : "G";
  const prefixes = ["SO", "SE", "GR", "FI", "EX", "LA"];

  const domainAges = domainPoints.map((d, idx) => {
    const nField = `${prefixes[idx]}${sexSuffix}N`;
    const wField = `${prefixes[idx]}${sexSuffix}W`;
    const lField = `${prefixes[idx]}${sexSuffix}L`;

    const age = round1(nearestAgeByPoints(state.ref.CDI_, nField, d.points, factualAge, 0.1));
    const row = [...state.ref.CDI_]
      .sort((a, b) => Number(a.Age) - Number(b.Age))
      .filter((r) => Number(r.Age) <= factualAge)
      .at(-1) || state.ref.CDI_[0];

    const p85 = Number(row[wField]);
    const p96 = Number(row[lField]);
    const level = cdiLevel(d.points, p85, p96);

    return { name: d.name, points: d.points, age, lag: round1(factualAge - age), level };
  });

  return { domainAges };
}

function startTest(scale) {
  const child = getChildById(state.selectedChildId);
  if (!child) return;

  const isCDI = scale === "CDI";
  const questions = isCDI ? state.ref.CDIqs : state.ref.KIDqs;

  state.run = {
    scale,
    child,
    questions,
    index: 1,
    answers: Array(questions.length + 1).fill(0),
    testDate: new Date().toISOString().slice(0, 10),
  };

  el.testTitle.textContent = `Тест ${scale}: ${child.surname} ${child.name}`;
  el.testMeta.textContent = `Дата теста: ${state.run.testDate}`;
  el.testDialog.showModal();
  renderQuestion();
}

function renderQuestion() {
  const run = state.run;
  if (!run) return;
  const total = run.questions.length;
  const q = run.questions[run.index - 1];

  const qText = (q.Text ?? q.Question ?? "").trim();
  el.questionText.textContent = `${run.index}. ${qText}`;
  el.progressBar.style.width = `${(run.index / total) * 100}%`;
  el.jumpInput.max = String(total);
  el.jumpInput.value = String(run.index);
  el.prevQBtn.disabled = run.index <= 1;
  el.nextQBtn.disabled = run.index >= total;

  el.answerGrid.innerHTML = "";
  for (const a of ANSWERS) {
    const d = document.createElement("button");
    d.type = "button";
    d.className = `answer${run.answers[run.index] === a.value ? " active" : ""}`;
    d.textContent = a.label;
    d.onclick = () => {
      run.answers[run.index] = a.value;
      renderQuestion();
    };
    el.answerGrid.appendChild(d);
  }

  el.answerHint.textContent = `Вопрос ${run.index} из ${total}. Текущий ответ: ${ANSWERS[run.answers[run.index]].label}`;
}

function finishTest() {
  const run = state.run;
  if (!run) return;

  const naCount = run.answers.slice(1).filter((x) => x === 0).length;
  const contrRows = run.scale === "CDI" ? state.ref.CDIcontr : state.ref.KIDcontr;
  const contradictions = contradictionsByPairs(run.answers, contrRows);
  const factualAge = monthsBetween(run.child.birthDate, run.testDate);

  const result = run.scale === "CDI" ? scoreCDI(run) : scoreKID(run);

  const record = {
    id: state.db.nextTestId++,
    childId: run.child.id,
    scale: run.scale,
    testDate: run.testDate,
    factualAge,
    answers: run.answers.slice(1).join(""),
    naCount,
    contradictions,
    result,
    informer: run.child.informer || "",
  };

  state.db.tests.push(record);
  dbSave();

  const domainLine = result.domainAges.map((d) => `${d.name}: ${d.age} мес`).join("\n");
  const extra = run.scale === "KID" ? `\nПолная шкала: ${result.totalAge} мес\nSigma: ${result.sigma}` : "";
  alert(`Тест сохранен.\n\n${domainLine}${extra}\n\nБез ответов: ${naCount}\nПротиворечий: ${contradictions.length}`);

  state.run = null;
  el.testDialog.close();
  state.selectedTestId = record.id;
  renderChildDetail();
}

function attachEvents() {
  el.searchInput.addEventListener("input", (e) => {
    state.childFilter = e.target.value;
    renderChildren();
  });

  el.newChildBtn.onclick = () => openChildDialog();
  el.editChildBtn.onclick = () => {
    const c = getChildById(state.selectedChildId);
    if (c) openChildDialog(c);
  };
  el.startKidBtn.onclick = () => startTest("KID");
  el.startCdiBtn.onclick = () => startTest("CDI");

  el.childForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveChildFromForm();
  });

  el.exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(state.db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rcdi-modern-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  el.closeTestBtn.onclick = () => {
    state.run = null;
    el.testDialog.close();
  };

  el.prevQBtn.onclick = () => {
    if (state.run && state.run.index > 1) {
      state.run.index -= 1;
      renderQuestion();
    }
  };

  el.nextQBtn.onclick = () => {
    if (state.run && state.run.index < state.run.questions.length) {
      state.run.index += 1;
      renderQuestion();
    }
  };

  el.jumpInput.addEventListener("change", (e) => {
    if (!state.run) return;
    const n = Number(e.target.value);
    if (Number.isInteger(n) && n >= 1 && n <= state.run.questions.length) {
      state.run.index = n;
      renderQuestion();
    }
  });

  el.finishBtn.onclick = finishTest;

  document.addEventListener("keydown", (e) => {
    if (!state.run) return;
    if (e.key >= "0" && e.key <= "3") {
      state.run.answers[state.run.index] = Number(e.key);
      renderQuestion();
    }
    if (e.key === "PageUp" && state.run.index > 1) {
      state.run.index -= 1;
      renderQuestion();
    }
    if (e.key === "PageDown" && state.run.index < state.run.questions.length) {
      state.run.index += 1;
      renderQuestion();
    }
  });
}

function maxId(items) {
  let m = 0;
  for (const i of items) {
    const id = Number(i.id);
    if (Number.isFinite(id) && id > m) m = id;
  }
  return m;
}

function migrateFromLegacy(kids, infos, kidRes, cdiRes) {
  const infoById = new Map(infos.map((x) => [Number(x.ID), x]));
  const children = kids.map((k) => {
    const i = infoById.get(Number(k.ID)) || {};
    return {
      id: Number(k.ID),
      surname: (k.Surname || "").trim(),
      name: (k.Name || "").trim(),
      birthDate: k.BirthDate || "",
      regDate: k.RegDate || "",
      sex: (k.Sex || "").trim(),
      phone: (k.Phone || "").trim(),
      address: (k.Address || "").trim(),
      region: String(k.Region || ""),
      informer: (i.Informer || "").trim(),
    };
  });

  const tests = [];
  for (const r of kidRes) {
    tests.push({
      id: tests.length + 1,
      childId: Number(r.Kid_ID),
      scale: "KID",
      testDate: r.TestDate || "",
      factualAge: Number(r.Fac_Age) || 0,
      answers: String(r.Data || ""),
      naCount: Number(r.NA) || 0,
      contradictions: [],
      result: {
        domainAges: [
          { name: "Когнитивная", age: Number(r.Cognitive) || 0 },
          { name: "Движения", age: Number(r.Motion) || 0 },
          { name: "Язык", age: Number(r.Lang) || 0 },
          { name: "Самообслуживание", age: Number(r.SelfHelp) || 0 },
          { name: "Социальная", age: Number(r.Social) || 0 },
        ],
        totalAge: Number(r.Total) || 0,
        sigma: Number(r.Sigma) || 0,
      },
      informer: r.Informer || "",
    });
  }

  for (const r of cdiRes) {
    tests.push({
      id: tests.length + 1,
      childId: Number(r.Kid_ID),
      scale: "CDI",
      testDate: r.TestDate || "",
      factualAge: Number(r.Fac_Age) || 0,
      answers: String(r.Data || ""),
      naCount: Number(r.NA) || 0,
      contradictions: [],
      result: {
        domainAges: [
          { name: "Социальная", age: Number(r.Social) || 0 },
          { name: "Самообслуживание", age: Number(r.SelfHelp) || 0 },
          { name: "Крупные движения", age: Number(r.GrossMot) || 0 },
          { name: "Тонкие движения", age: Number(r.FineMot) || 0 },
          { name: "Развитие речи", age: Number(r.ExpLang) || 0 },
          { name: "Понимание языка", age: Number(r.LangComp) || 0 },
        ],
      },
      informer: r.Informer || "",
    });
  }

  return {
    children,
    tests,
    nextChildId: maxId(children) + 1,
    nextTestId: maxId(tests) + 1,
  };
}

async function bootstrap() {
  const [
    KIDqs,
    CDIqs,
    KIDdms,
    CDIdms,
    KIDcontr,
    CDIcontr,
    KID_1Cogn,
    KID_2Mot,
    KID_3Lang,
    KID_4Self,
    KID_5Soc,
    KID_Full,
    CDI_,
    tb_Kids,
    tb_Info,
    KIDres,
    CDIres,
  ] = await Promise.all([
    loadJson("./data/KIDqs.json"),
    loadJson("./data/CDIqs.json"),
    loadJson("./data/KIDdms.json"),
    loadJson("./data/CDIdms.json"),
    loadJson("./data/KIDcontr.json"),
    loadJson("./data/CDIcontr.json"),
    loadJson("./data/KID_1Cogn.json"),
    loadJson("./data/KID_2Mot.json"),
    loadJson("./data/KID_3Lang.json"),
    loadJson("./data/KID_4Self.json"),
    loadJson("./data/KID_5Soc.json"),
    loadJson("./data/KID_Full.json"),
    loadJson("./data/CDI_.json"),
    loadJson("./data/tb_Kids.json"),
    loadJson("./data/tb_Info.json"),
    loadJson("./data/KIDres.json"),
    loadJson("./data/CDIres.json"),
  ]);

  state.ref = {
    KIDqs: toArray(KIDqs),
    CDIqs: toArray(CDIqs),
    KIDdms: toArray(KIDdms),
    CDIdms: toArray(CDIdms),
    KIDcontr: toArray(KIDcontr),
    CDIcontr: toArray(CDIcontr),
    KID_1Cogn: toArray(KID_1Cogn),
    KID_2Mot: toArray(KID_2Mot),
    KID_3Lang: toArray(KID_3Lang),
    KID_4Self: toArray(KID_4Self),
    KID_5Soc: toArray(KID_5Soc),
    KID_Full: toArray(KID_Full),
    CDI_: toArray(CDI_),
  };

  const saved = localStorage.getItem("rcdi_modern_db_v1");
  if (saved) {
    state.db = JSON.parse(saved);
  } else {
    state.db = migrateFromLegacy(toArray(tb_Kids), toArray(tb_Info), toArray(KIDres), toArray(CDIres));
    dbSave();
  }

  attachEvents();
  renderChildren();
  renderChildDetail();
}

bootstrap().catch((e) => {
  console.error(e);
  alert("Инициализация не удалась. Запустите через локальный сервер, например: python -m http.server 4173");
});

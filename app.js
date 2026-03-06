const ANSWERS = [
  { value: 0, label: "[0] javobsiz" },
  { value: 1, label: "[1] yaqinda qila boshlagan" },
  { value: 2, label: "[2] anchadan beri qila oladi" },
  { value: 3, label: "[3] hech qachon" },
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
  resultSnapshot: document.getElementById("resultSnapshot"),
  snapshotBody: document.getElementById("snapshotBody"),
  testHistory: document.getElementById("testHistory"),
  algoPanel: document.getElementById("algoPanel"),
  algoBadge: document.getElementById("algoBadge"),
  algoTop: document.getElementById("algoTop"),
  algoSteps: document.getElementById("algoSteps"),
  algoDomainTable: document.getElementById("algoDomainTable"),
  algoContradictions: document.getElementById("algoContradictions"),
  algoRecommendations: document.getElementById("algoRecommendations"),
  algoAnswers: document.getElementById("algoAnswers"),
  calcLog: document.getElementById("calcLog"),
  deepLog: document.getElementById("deepLog"),
  qaSummary: document.getElementById("qaSummary"),
  qaBody: document.getElementById("qaBody"),
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

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
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

function awardedPoint(answer) {
  return achieved(answer) ? 1 : 0;
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
    const fullName = `${c.surname || ""} ${c.name || ""}`.trim() || "Ism kiritilmagan";
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
    return `To'liq shkala: ${t.result.totalAge} oy, sigma ${t.result.sigma}`;
  }
  return `So'rovnoma turlari: ${t.result.domainAges.map((x) => x.age).join(" / ")} oy`;
}

function riskGrade(test) {
  const lagValues = (test.result.domainAges || []).map((d) => Number(d.lag ?? (test.factualAge - d.age))).filter(Number.isFinite);
  const maxLag = lagValues.length ? Math.max(...lagValues) : 0;
  const contradictionCount = (test.contradictions || []).length;
  const naCount = Number(test.naCount || 0);

  if (test.scale === "KID") {
    const sigma = Number(test.result.sigma || 0);
    if (sigma >= 96 || maxLag >= 6) return "Yuqori xavf";
    if (sigma >= 85 || maxLag >= 3 || contradictionCount > 6) return "O'rtacha xavf";
    if (naCount > 3) return "Qayta tekshirish kerak";
    return "Yaxshi holat";
  }

  const maxLevel = Math.max(0, ...((test.result.domainAges || []).map((d) => Number(d.level || 0))));
  if (maxLevel >= 96 || maxLag >= 8) return "Yuqori xavf";
  if (maxLevel >= 85 || maxLag >= 4 || contradictionCount > 6) return "O'rtacha xavf";
  if (naCount > 3) return "Qayta tekshirish kerak";
  return "Yaxshi holat";
}

function riskClass(grade) {
  if (grade === "Yuqori xavf") return "risk-danger";
  if (grade === "O'rtacha xavf" || grade === "Qayta tekshirish kerak") return "risk-warning";
  return "risk-good";
}

function answerMeta(v) {
  if (v === 1) return { text: "[1] yaqinda qila boshlagan", cls: "ans-good" };
  if (v === 2) return { text: "[2] anchadan beri qila oladi", cls: "ans-good" };
  if (v === 3) return { text: "[3] hech qachon", cls: "ans-bad" };
  return { text: "[0] javobsiz", cls: "ans-na" };
}

function parseAnswersToArray(raw, count) {
  const arr = Array(count + 1).fill(0);
  const s = String(raw || "");
  for (let i = 1; i <= count; i++) {
    const ch = s[i - 1];
    const n = Number(ch);
    arr[i] = Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
  }
  return arr;
}

function computeScoreByScale(scale, answers, child, testDate) {
  const run = { scale, answers, child, testDate };
  return scale === "KID" ? scoreKID(run) : scoreCDI(run);
}

function contradictionDetails(scale, answers) {
  const rows = scale === "KID" ? state.ref.KIDcontr : state.ref.CDIcontr;
  const lines = [];
  let count = 0;
  for (let i = 0; i + 1 < rows.length; i += 2) {
    const q1 = Number(rows[i].Num);
    const q2 = Number(rows[i + 1].Num);
    const a1 = answers[q1];
    const a2 = answers[q2];
    const bad = a1 === 3 && (a2 === 1 || a2 === 2);
    if (bad) count += 1;
    lines.push(`- ${q1}-${q2}: [${a1}] vs [${a2}] => ${bad ? "QARAMA-QARSHI" : "ok"}`);
  }
  return { count, lines };
}

function sourceTablesFor(scale, sex) {
  if (scale === "KID") {
    return [
      "Savollar: KIDqs",
      "So'rovnoma turi map: KIDdms",
      "Qarama-qarshi juftlar: KIDcontr",
      "Yosh normasi: KID_1Cogn, KID_2Mot, KID_3Lang, KID_4Self, KID_5Soc",
      "Umumiy yosh/sigma: KID_Full (p50, p85, p96, p98)",
    ];
  }
  const suffix = sex === "мужской" ? "B" : "G";
  return [
    "Savollar: CDIqs",
    "So'rovnoma turi map: CDIdms",
    "Qarama-qarshi juftlar: CDIcontr",
    `Yosh normasi: CDI_ (*${suffix}N)`,
    `Daraja: CDI_ (*${suffix}W, *${suffix}L)`,
  ];
}

function buildQuestionAudit(test) {
  const questions = test.scale === "KID" ? state.ref.KIDqs : state.ref.CDIqs;
  const dms = test.scale === "KID" ? state.ref.KIDdms : state.ref.CDIdms;
  const child = getChildById(test.childId);
  if (!child || !child.birthDate) {
    return { summary: "Ta'sirni hisoblash uchun bola ma'lumoti yetarli emas.", rowsHtml: "" };
  }

  const domainByQ = new Map(dms.map((x) => [Number(x.ID), x.Domain]));
  const answers = parseAnswersToArray(test.answers, questions.length);
  const base = computeScoreByScale(test.scale, answers, child, test.testDate);
  let unanswered = 0;
  let positiveImpact = 0;
  const rows = [];

  for (let i = 1; i <= questions.length; i++) {
    const q = questions[i - 1];
    const text = (q.Text ?? q.Question ?? "").trim();
    const ans = answers[i];
    const meta = answerMeta(ans);
    const domain = domainByQ.get(i) || q.Domain || "-";
    const givenPoint = awardedPoint(ans);
    const effects = [];
    for (const option of [0, 1, 2, 3]) {
      const sim = [...answers];
      sim[i] = option;
      const simRes = computeScoreByScale(test.scale, sim, child, test.testDate);
      if (test.scale === "KID") {
        const d0 = (base.domainAges || []).find((d) => d.name === domain);
        const d1 = (simRes.domainAges || []).find((d) => d.name === domain);
        const dt = round1((simRes.totalAge || 0) - (base.totalAge || 0));
        const dd = round1((d1?.age || 0) - (d0?.age || 0));
        effects.push(`[${option}]:${awardedPoint(option)}b Δtotal=${dt}, Δ${domain}=${dd}`);
      } else {
        const d0 = (base.domainAges || []).find((d) => d.name === domain);
        const d1 = (simRes.domainAges || []).find((d) => d.name === domain);
        const da = round1((d1?.age || 0) - (d0?.age || 0));
        const dl = Number(d1?.level ?? 0) - Number(d0?.level ?? 0);
        effects.push(`[${option}]:${awardedPoint(option)}b Δ${domain}=${da}, Δlvl=${dl}`);
      }
    }
    const alternatives = effects.join(" | ");
    let impact = "—";
    let status = ans === 0 ? "Javobsiz" : "Javob berilgan";

    if (ans === 0) {
      unanswered += 1;
      const sim = [...answers];
      sim[i] = 2;
      const simRes = computeScoreByScale(test.scale, sim, child, test.testDate);
      if (test.scale === "KID") {
        const totalDelta = round1((simRes.totalAge || 0) - (base.totalAge || 0));
        const baseDom = (base.domainAges || []).find((d) => d.name === domain);
        const simDom = (simRes.domainAges || []).find((d) => d.name === domain);
        const domDelta = round1((simDom?.age || 0) - (baseDom?.age || 0));
        impact = `+${totalDelta} oy (yakun), +${domDelta} oy (${escHtml(domain)}) [manba: KID_Full p50 + KID_* p50]`;
        if (totalDelta > 0) positiveImpact += totalDelta;
      } else {
        const baseDom = (base.domainAges || []).find((d) => d.name === domain);
        const simDom = (simRes.domainAges || []).find((d) => d.name === domain);
        const domDelta = round1((simDom?.age || 0) - (baseDom?.age || 0));
        impact = `+${domDelta} oy (${escHtml(domain)}) [manba: CDI_ N ustuni]`;
        if (domDelta > 0) positiveImpact += domDelta;
      }
    }

    rows.push(
      `<tr>
        <td>${i}</td>
        <td>${escHtml(text)}</td>
        <td>${escHtml(domain)}</td>
        <td><span class="mini-badge ${meta.cls}">${escHtml(meta.text)}</span></td>
        <td><strong>${givenPoint}</strong></td>
        <td>${alternatives}</td>
        <td>${status}</td>
        <td>${impact}</td>
      </tr>`
    );
  }

  const summary = test.scale === "KID"
    ? `Javobsiz: ${unanswered}. Alohida punktlar bo'yicha taxminiy o'sish: ~${round1(positiveImpact)} oy (chiziqli yig'ilmaydi).`
    : `Javobsiz: ${unanswered}. So'rovnoma turlari bo'yicha taxminiy o'sish: ~${round1(positiveImpact)} oy.`;
  return { summary, rowsHtml: rows.join("") };
}

function buildCalculationLog(test) {
  const questions = test.scale === "KID" ? state.ref.KIDqs : state.ref.CDIqs;
  const dms = test.scale === "KID" ? state.ref.KIDdms : state.ref.CDIdms;
  const child = getChildById(test.childId);
  if (!child || !child.birthDate) {
    return "Hisoblash logi uchun bola ma'lumoti yetarli emas.";
  }

  const answers = parseAnswersToArray(test.answers, questions.length);
  const factualAge = monthsBetween(child.birthDate, test.testDate);
  const domainByQ = new Map(dms.map((x) => [Number(x.ID), x.Domain]));
  const domainBucket = new Map();

  for (let i = 1; i <= questions.length; i++) {
    const domain = domainByQ.get(i) || questions[i - 1].Domain || "-";
    const point = awardedPoint(answers[i]);
    if (!domainBucket.has(domain)) domainBucket.set(domain, { pts: 0, items: [] });
    const rec = domainBucket.get(domain);
    rec.pts += point;
    rec.items.push(`${i}:${answers[i]}=>${point}`);
  }

  const lines = [];
  lines.push(`Test ID: ${test.id}`);
  lines.push(`Shkala: ${test.scale}`);
  lines.push(`Haqiqiy yosh = monthsBetween(${child.birthDate}, ${test.testDate}) = ${factualAge} oy`);
  lines.push("Qoida: [1]/[2] => 1 ball, [0]/[3] => 0 ball");
  lines.push("");
  lines.push("Manba jadvallar:");
  for (const s of sourceTablesFor(test.scale, child.sex)) lines.push(`- ${s}`);
  lines.push("");
  lines.push("So'rovnoma turi bo'yicha ball yig'indisi:");
  for (const [domain, info] of domainBucket.entries()) {
    lines.push(`- ${domain}: ${info.pts} ball | Savollar: ${info.items.join(", ")}`);
  }
  lines.push("");
  if (test.scale === "KID") {
    const totalPoints = answers.slice(1).reduce((n, x) => n + awardedPoint(x), 0);
    const recomputedTotalAge = round1(
      nearestAgeByPoints(state.ref.KID_Full, "p50", totalPoints, factualAge)
    );
    lines.push(`KID umumiy ball = ${totalPoints}`);
    lines.push(`KID total yosh (qayta hisob) = nearestAgeByPoints(KID_Full.p50, ${totalPoints}, ${factualAge}) = ${recomputedTotalAge} oy`);
    lines.push(`KID total yosh (saqlangan natija) = ${test.result.totalAge} oy`);
    if (Math.abs(Number(test.result.totalAge) - recomputedTotalAge) > 0.05) {
      lines.push("Eslatma: saqlangan natija bilan qayta hisob o'rtasida farq bor (eski tizimdagi rounding/migratsiya ta'siri bo'lishi mumkin).");
    }
    lines.push(`Sigma = ${test.result.sigma} (KID_Full p85/p96/p98 chegaralari asosida)`);
  } else {
    const sexSuffix = child.sex === "мужской" ? "B" : "G";
    lines.push(`CDI jins suffix: ${sexSuffix} (erkak=B, ayol=G)`);
    lines.push("Har turda yosh: nearestAgeByPoints(CDI_.*N, ball, factualAge), daraja: *W/*L");
  }
  lines.push("");
  lines.push("Risk qoidasi:");
  lines.push("- Yuqori xavf: sigma>=96 yoki katta farq");
  lines.push("- O'rtacha xavf: sigma/level o'rtacha zona yoki ko'p qarama-qarshilik");
  lines.push("- Qayta tekshirish: bo'sh javoblar > 3");
  lines.push(`Natija: ${riskGrade(test)}`);
  return lines.join("\n");
}

function buildDeepTraceLog(test) {
  const questions = test.scale === "KID" ? state.ref.KIDqs : state.ref.CDIqs;
  const dms = test.scale === "KID" ? state.ref.KIDdms : state.ref.CDIdms;
  const child = getChildById(test.childId);
  if (!child || !child.birthDate) return "Deep trace uchun bola ma'lumoti yetarli emas.";

  const answers = parseAnswersToArray(test.answers, questions.length);
  const base = computeScoreByScale(test.scale, answers, child, test.testDate);
  const factualAge = monthsBetween(child.birthDate, test.testDate);
  const domainByQ = new Map(dms.map((x) => [Number(x.ID), x.Domain]));
  const lines = [];

  lines.push("=== META ===");
  lines.push(`testId=${test.id}, scale=${test.scale}, testDate=${test.testDate}, factualAge=${factualAge}`);
  lines.push(`risk=${riskGrade(test)}, na=${test.naCount}, contradictions=${(test.contradictions || []).length}`);
  lines.push("");

  lines.push("=== MANBA JADVALLAR ===");
  for (const s of sourceTablesFor(test.scale, child.sex)) lines.push(`* ${s}`);
  lines.push("");

  lines.push("=== ASOSIY FORMULA ===");
  lines.push("* Savol balli: [1]/[2] => 1, [0]/[3] => 0");
  lines.push("* So'rovnoma turi balli = shu turdagi savollar balli yig'indisi");
  lines.push("* KID: yosh = nearestAgeByPoints(KID_*.p50), total yosh = nearestAgeByPoints(KID_Full.p50)");
  lines.push("* CDI: yosh = nearestAgeByPoints(CDI_.*N), level = W/L chegaralari");
  lines.push("");

  lines.push("=== QARAMA-QARSHILIK JUFТLAR ===");
  const ctr = contradictionDetails(test.scale, answers);
  lines.push(`Jami: ${ctr.count}`);
  for (const l of ctr.lines) lines.push(l);
  lines.push("");

  lines.push("=== SAVOL BO'YICHA TRACE (0/1/2/3) ===");
  for (let i = 1; i <= questions.length; i++) {
    const q = questions[i - 1];
    const qText = (q.Text ?? q.Question ?? "").trim();
    const domain = domainByQ.get(i) || q.Domain || "-";
    const cur = answers[i];
    lines.push(`Q${i} [${domain}] "${qText}"`);
    lines.push(`- Joriy javob: [${cur}] => ${awardedPoint(cur)} ball`);
    for (const option of [0, 1, 2, 3]) {
      const sim = [...answers];
      sim[i] = option;
      const simRes = computeScoreByScale(test.scale, sim, child, test.testDate);
      if (test.scale === "KID") {
        const d0 = (base.domainAges || []).find((d) => d.name === domain);
        const d1 = (simRes.domainAges || []).find((d) => d.name === domain);
        const dt = round1((simRes.totalAge || 0) - (base.totalAge || 0));
        const dd = round1((d1?.age || 0) - (d0?.age || 0));
        lines.push(`  option[${option}] => ${awardedPoint(option)}b | ΔtotalAge=${dt} | Δ${domain}=${dd}`);
      } else {
        const d0 = (base.domainAges || []).find((d) => d.name === domain);
        const d1 = (simRes.domainAges || []).find((d) => d.name === domain);
        const da = round1((d1?.age || 0) - (d0?.age || 0));
        const dl = Number(d1?.level ?? 0) - Number(d0?.level ?? 0);
        lines.push(`  option[${option}] => ${awardedPoint(option)}b | Δ${domain}Age=${da} | Δlevel=${dl}`);
      }
    }
    lines.push("");
  }

  lines.push("=== YAKUNIY NATIJA ===");
  if (test.scale === "KID") {
    lines.push(`totalPoints=${base.totalPoints}, totalAge=${base.totalAge}, sigma=${base.sigma}`);
  } else {
    lines.push("CDI domain natijalari:");
    for (const d of base.domainAges || []) {
      lines.push(`- ${d.name}: points=${d.points}, age=${d.age}, level=${d.level}`);
    }
  }

  return lines.join("\n");
}

function recommendationsForTest(test) {
  const rec = [];
  const grade = riskGrade(test);
  const lagValues = (test.result.domainAges || []).map((d) => Number(d.lag ?? (test.factualAge - d.age))).filter(Number.isFinite);
  const maxLag = lagValues.length ? Math.max(...lagValues) : 0;

  if (grade === "Yuqori xavf") {
    rec.push("Mutaxassis bilan tezkor uchrashuv va erta aralashuv rejasi kerak.");
    rec.push("Dinamikani nazorat qilish uchun 1-2 oyda qayta baholash.");
  } else if (grade === "O'rtacha xavf") {
    rec.push("Uy sharoiti va mutaxassis bilan rivojlantiruvchi dastur tavsiya etiladi.");
    rec.push("2-3 oyda qayta test topshirish.");
  } else if (grade === "Qayta tekshirish kerak") {
    rec.push("Bo'sh yoki noaniq javoblar ko'p, testni qayta to'ldirish tavsiya etiladi.");
  } else {
    rec.push("Natija yosh normasiga yaqin. Muntazam rivojlantiruvchi mashg'ulotlarni davom ettiring.");
    rec.push("4-6 oyda reja asosida nazorat testi.");
  }

  if (maxLag >= 4) rec.push("Mashg'ulotlarni eng ko'p ortda qolgan so'rovnoma turiga yo'naltiring.");
  if ((test.contradictions || []).length > 6) rec.push("Qarama-qarshi javoblarni ma'lumot beruvchi bilan qayta tekshiring.");
  if ((test.naCount || 0) > 3) rec.push("Keyingi testda bo'sh javoblar sonini kamaytiring.");
  return rec;
}

function renderAlgoPanel(test) {
  if (!test) {
    el.algoPanel.classList.add("hidden");
    el.resultSnapshot.classList.add("hidden");
    el.qaSummary.textContent = "";
    el.qaBody.innerHTML = "";
    el.calcLog.textContent = "";
    return;
  }
  el.algoPanel.classList.remove("hidden");
  el.resultSnapshot.classList.remove("hidden");
  const grade = riskGrade(test);
  el.algoBadge.textContent = `${test.scale} | ${grade}`;
  el.algoBadge.className = `badge ${riskClass(grade)}`;

  const gap = test.result.domainAges
    .map((d) => Number(d.lag ?? (test.factualAge - d.age)))
    .filter(Number.isFinite);
  const avgGap = gap.length ? round1(gap.reduce((a, b) => a + b, 0) / gap.length) : 0;
  const maxGap = gap.length ? round1(Math.max(...gap)) : 0;

  const topItems = [
    `Haqiqiy yosh: ${test.factualAge} oy`,
    `Bo'sh javob: ${test.naCount}`,
    `Qarama-qarshilik: ${(test.contradictions || []).length}`,
    `O'rtacha farq: ${avgGap} oy`,
    `Maks. farq: ${maxGap} oy`,
  ];
  if (test.scale === "KID") topItems.push(`Sigma: ${Number(test.result.sigma || 0)}`);
  el.algoTop.innerHTML = topItems.map((x) => `<span class="chip">${x}</span>`).join("");

  const snapshot = [
    `<strong>Sana:</strong> ${test.testDate}`,
    `<strong>Shkala:</strong> ${test.scale}`,
    `<strong>Xavf holati:</strong> <span class="mini-badge ${riskClass(grade)}">${grade}</span>`,
    test.scale === "KID"
      ? `<strong>KID yakun:</strong> ${test.result.totalAge} oy, sigma ${Number(test.result.sigma || 0)}`
      : `<strong>CDI yakun:</strong> so'rovnoma turlari bahosi ${test.result.domainAges.map((d) => d.age).join(" / ")} oy`,
  ];
  el.snapshotBody.innerHTML = snapshot.join("<br>");

  const steps = test.scale === "KID"
    ? [
        "1) Har so'rovnoma turi bo'yicha 1/2 javoblar soni ball sifatida olinadi.",
        "2) Ball p50 jadvali (KID_1..5) bilan solishtirilib so'rovnoma turi yoshi tanlanadi.",
        "3) To‘liq ball KID_Full p50 orqali umumiy yoshga o‘tkaziladi.",
        "4) Sigma: p85/p96/p98 chegaralari bo‘yicha hisoblanadi.",
        "5) NA va qarama-qarshiliklar risk bahosiga qo‘shiladi.",
      ]
    : [
        "1) Har so'rovnoma turi bo'yicha 1/2 javoblar ball hisoblanadi.",
        "2) Jinsga mos ustunlar (SO/SE/GR/FI/EX/LA + B/G) ishlatiladi.",
        "3) N ustuni bo‘yicha so'rovnoma turi yoshi, W/L bo‘yicha level aniqlanadi.",
        "4) NA va qarama-qarshiliklar risk bahosiga qo‘shiladi.",
      ];
  el.algoSteps.innerHTML = `<h4>Hisoblash logikasi (qadamlar)</h4>${steps.map((s) => `<div class=\"step-line\">${s}</div>`).join("")}`;

  const rows = test.result.domainAges || [];
  const hasLevel = rows.some((d) => typeof d.level !== "undefined");
  const head = hasLevel
    ? "<tr><th>So'rovnoma turi</th><th>Ball</th><th>Hisoblangan yosh</th><th>Farq</th><th>Daraja</th><th>Qayerdan chiqdi</th></tr>"
    : "<tr><th>So'rovnoma turi</th><th>Ball</th><th>Hisoblangan yosh</th><th>Farq</th><th>Qayerdan chiqdi</th></tr>";
  const body = rows
    .map((d) => {
      const lag = Number(d.lag ?? (test.factualAge - d.age));
      if (hasLevel) {
        return `<tr><td>${d.name}</td><td>${d.points ?? "-"}</td><td>${d.age} oy</td><td>${round1(lag)} oy</td><td>${d.level ?? "-"}</td><td>Ball -> p50; Daraja -> W/L yoki p85/p96</td></tr>`;
      }
      return `<tr><td>${d.name}</td><td>${d.points ?? "-"}</td><td>${d.age} oy</td><td>${round1(lag)} oy</td><td>Ball -> p50 jadvali</td></tr>`;
    })
    .join("");
  el.algoDomainTable.innerHTML = `<table class="table-tight"><thead>${head}</thead><tbody>${body}</tbody></table>`;

  const ctr = test.contradictions || [];
  el.algoContradictions.innerHTML = ctr.length
    ? ctr.map((p) => `<span class="pair">${p[0]}-${p[1]}</span>`).join(" ")
    : "Qarama-qarshi javob topilmadi.";

  const rec = recommendationsForTest(test);
  el.algoRecommendations.innerHTML = rec.map((x) => `<div>• ${x}</div>`).join("");
  el.algoAnswers.textContent = test.answers || "";

  const qa = buildQuestionAudit(test);
  el.qaSummary.textContent = qa.summary;
  el.qaBody.innerHTML = qa.rowsHtml || `<tr><td colspan="8">Ma'lumot yetarli emas.</td></tr>`;
  el.calcLog.textContent = buildCalculationLog(test);
  el.deepLog.textContent = buildDeepTraceLog(test);
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
  const fullName = `${c.surname || ""} ${c.name || ""}`.trim() || "Ism kiritilmagan";
  el.childName.textContent = fullName;
  el.childMeta.textContent = `Tug'ilgan sana: ${c.birthDate || "-"} | Jins: ${c.sex || "-"} | Hudud: ${c.region || "-"} | Ma'lumot beruvchi: ${c.informer || "-"}`;

  const tests = getTestsByChild(c.id);
  const high = tests.filter((t) => riskGrade(t) === "Yuqori xavf").length;
  const mid = tests.filter((t) => {
    const g = riskGrade(t);
    return g === "O'rtacha xavf" || g === "Qayta tekshirish kerak";
  }).length;
  const good = tests.filter((t) => riskGrade(t) === "Yaxshi holat").length;
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
            return `<tr data-test-id="${t.id}" class="history-row${t.id === state.selectedTestId ? " active-row" : ""}"><td>${t.testDate}</td><td>${t.scale}</td><td>${t.factualAge} oy</td><td>${testSummary(t)} <span class="mini-badge ${tagClass}">${grade}</span></td><td>${t.naCount}</td><td>${t.contradictions.length}</td></tr>`;
          }
        )
        .join("")
    : `<tr><td colspan="6">Hozircha test yo'q</td></tr>`;

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
  el.childDialogTitle.textContent = editingChild ? "Bolani tahrirlash" : "Yangi bola";
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
    alert("Ro'yxatga olish sanasi tug'ilgan sanadan oldin bo'lishi mumkin emas.");
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

  el.testTitle.textContent = `${scale} testi: ${child.surname} ${child.name}`;
  el.testMeta.textContent = `Test sanasi: ${state.run.testDate}`;
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

  el.answerHint.textContent = `${run.index}/${total}-savol. Joriy javob: ${ANSWERS[run.answers[run.index]].label}`;
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

  const domainLine = result.domainAges.map((d) => `${d.name}: ${d.age} oy`).join("\n");
  const extra = run.scale === "KID" ? `\nTo'liq shkala: ${result.totalAge} oy\nSigma: ${result.sigma}` : "";
  alert(`Test saqlandi.\n\n${domainLine}${extra}\n\nBo'sh javob: ${naCount}\nQarama-qarshilik: ${contradictions.length}`);

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
    a.download = `rcdi-export-${new Date().toISOString().slice(0, 10)}.json`;
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
  alert("Ishga tushirishda xatolik. Lokal server orqali ishga tushiring, masalan: python -m http.server 4173");
});

